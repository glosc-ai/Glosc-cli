export type Language = "python" | "typescript";

export type ProjectOptions = {
    projectName: string;
    description: string;
    author: string;
    language: Language;
    mainFileName: string;
    readme: boolean;
    license: boolean;
};

export type ProjectFile = {
    relativePath: string;
    content: string;
};

function gitignoreContent(language: Language): string {
    const common = [
        "# OS",
        ".DS_Store",
        "Thumbs.db",
        "Desktop.ini",
        "",
        "# Editors",
        ".vscode/",
        ".idea/",
        "*.swp",
        "",
        "# Env",
        ".env",
        ".env.*",
        "",
        "# Logs",
        "*.log",
        "",
        "# Builds / artifacts",
        "dist/",
        "build/",
        "*.zip",
        "",
    ];

    const node = [
        "# Node",
        "node_modules/",
        "npm-debug.log*",
        "yarn-debug.log*",
        "yarn-error.log*",
        "pnpm-debug.log*",
        "",
    ];

    const python = [
        "# Python",
        "__pycache__/",
        "*.py[cod]",
        "*.pyd",
        ".Python",
        ".venv/",
        "venv/",
        "ENV/",
        "env/",
        ".pytest_cache/",
        ".mypy_cache/",
        ".ruff_cache/",
        "*.egg-info/",
        "",
    ];

    return (
        common.join("\n") +
        (language === "typescript" ? node.join("\n") : python.join("\n"))
    );
}

function packagingScriptMjs(): string {
    // Keep this script dependency-free and avoid nested template literals.
    return [
        'import { spawnSync } from "node:child_process";',
        'import * as fs from "node:fs";',
        'import * as fsp from "node:fs/promises";',
        'import * as path from "node:path";',
        "",
        "function run(cmd, args, opts = {}) {",
        "  return spawnSync(cmd, args, {",
        '    stdio: ["ignore", "pipe", "pipe"],',
        '    encoding: "utf8",',
        "    shell: false,",
        "    ...opts,",
        "  });",
        "}",
        "",
        "function runInherit(cmd, args, opts = {}) {",
        "  return spawnSync(cmd, args, {",
        '    stdio: "inherit",',
        '    encoding: "utf8",',
        "    shell: false,",
        "    ...opts,",
        "  });",
        "}",
        "",
        "function normalizeRelPath(p) {",
        '  return String(p || "").replace(/\\\\/g, "/");',
        "}",
        "",
        "function readJsonIfExists(filePath) {",
        "  try {",
        "    if (!fs.existsSync(filePath)) return undefined;",
        '    const raw = fs.readFileSync(filePath, "utf8");',
        "    return JSON.parse(raw);",
        "  } catch {",
        "    return undefined;",
        "  }",
        "}",
        "",
        "function detectTypeScriptProject() {",
        '  if (fs.existsSync("tsconfig.json")) return true;',
        '  const pkg = readJsonIfExists("package.json");',
        '  const buildScript = String(pkg?.scripts?.build || "");',
        '  if (buildScript.includes("tsc")) return true;',
        "  if (pkg?.devDependencies?.typescript) return true;",
        "  return false;",
        "}",
        "",
        "function detectDistEntry() {",
        "  // default requested: /dist/index.js",
        '  const defaultEntry = "dist/index.js";',
        '  const pkg = readJsonIfExists("package.json");',
        '  const start = String(pkg?.scripts?.start || "").trim();',
        "  const m = /^node\\s+(.+)$/.exec(start);",
        '  const inferred = m && m[1] ? String(m[1]).trim() : "";',
        "  const entry = inferred || defaultEntry;",
        "  return normalizeRelPath(entry);",
        "}",
        "",
        "function ensureGitRepoRoot() {",
        '  const r = run("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd() });',
        "  if (r.status !== 0) {",
        '    const err = (r.stderr || r.stdout || "").trim();',
        "    throw new Error(",
        '      "git repo is required for packaging (to respect .gitignore).\\n" + err,',
        "    );",
        "  }",
        '  const top = String(r.stdout || "").trim();',
        '  if (!top) throw new Error("Failed to resolve git repo root");',
        "  process.chdir(top);",
        "  return top;",
        "}",
        "",
        "function gitFileList() {",
        '  const r = run("git", [',
        '    "ls-files",',
        '    "-z",',
        '    "--cached",',
        '    "--others",',
        '    "--exclude-standard",',
        "  ]);",
        "",
        "  if (r.status !== 0) {",
        '    const err = (r.stderr || r.stdout || "").trim();',
        "    throw new Error(",
        '      "git is required for packaging (and to respect .gitignore).\\n" + err,',
        "    );",
        "  }",
        "",
        '  const raw = r.stdout || "";',
        '  return raw.split("\\u0000").filter(Boolean).map(normalizeRelPath);',
        "}",
        "",
        "function shouldExcludeFromPackage(relPath) {",
        "  const p = normalizeRelPath(relPath);",
        "  if (!p) return true;",
        "  // 1) scripts/package.mjs does not need to be packaged",
        '  if (p === "scripts/package.mjs") return true;',
        "  // temp files created by this script",
        '  if (p.startsWith(".glosc-tmp/")) return true;',
        "  return false;",
        "}",
        "",
        "function uniqStable(list) {",
        "  const seen = new Set();",
        "  const out = [];",
        "  for (const item of list) {",
        "    if (seen.has(item)) continue;",
        "    seen.add(item);",
        "    out.push(item);",
        "  }",
        "  return out;",
        "}",
        "",
        "async function ensureDir(p) {",
        "  await fsp.mkdir(p, { recursive: true });",
        "}",
        "",
        "async function prepareTmpDir() {",
        '  const tmpDir = path.join(process.cwd(), ".glosc-tmp");',
        "  await fsp.rm(tmpDir, { recursive: true, force: true });",
        "  await ensureDir(tmpDir);",
        "  return tmpDir;",
        "}",
        "",
        "async function writeNulSeparatedList(tmpDir, filePaths) {",
        "  // Use NUL-separated pathspec so we can pass it to git safely (no quoting issues).",
        '  const listPath = path.join(tmpDir, "pathspec.nul");',
        "  const normalized = filePaths.map(normalizeRelPath);",
        '  const buf = Buffer.from(normalized.join("\u0000") + "\u0000", "utf8");',
        "  await fsp.writeFile(listPath, buf);",
        "  return listPath;",
        "}",
        "",
        "function gitArchiveZipFromWorkingTreeFiles(outZip, filePaths) {",
        "  // Create a temporary index so we can archive *tracked + untracked* files without",
        "  // touching the user's real index or requiring a commit.",
        '  const tmpIndex = path.join(process.cwd(), ".glosc-tmp", "index");',
        "  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };",
        "",
        "  // Add files (force-add so ignored build output like dist/index.js can be included).",
        "  const add = run(",
        '    "git",',
        "    [",
        '      "add",',
        '      "-f",',
        '      "--pathspec-from-file=.glosc-tmp/pathspec.nul",',
        '      "--pathspec-file-nul",',
        '      "--",',
        "    ],",
        "    { cwd: process.cwd(), env },",
        "  );",
        "  if (add.status !== 0) {",
        "    // Fallback for older Git versions without --pathspec-from-file.",
        "    const chunkSize = 200;",
        "    for (let i = 0; i < filePaths.length; i += chunkSize) {",
        "      const chunk = filePaths.slice(i, i + chunkSize);",
        '      const r = run("git", ["add", "-f", "--", ...chunk], { cwd: process.cwd(), env });',
        "      if (r.status !== 0) {",
        '        const err = (r.stderr || r.stdout || "").trim();',
        '        throw new Error("git add (temp index) failed\\n" + err);',
        "      }",
        "    }",
        "  }",
        "",
        '  const wt = run("git", ["write-tree"], { cwd: process.cwd(), env });',
        "  if (wt.status !== 0) {",
        '    const err = (wt.stderr || wt.stdout || "").trim();',
        '    throw new Error("git write-tree failed\\n" + err);',
        "  }",
        '  const tree = String(wt.stdout || "").trim();',
        '  if (!tree) throw new Error("git write-tree produced empty tree hash");',
        "",
        "  const ar = run(",
        '    "git",',
        '    ["archive", "--format=zip", "--output", outZip, tree],',
        "    { cwd: process.cwd() },",
        "  );",
        "  if (ar.status !== 0) {",
        '    const err = (ar.stderr || ar.stdout || "").trim();',
        '    throw new Error("git archive failed\\n" + err);',
        "  }",
        "}",
        "",
        "function timestamp() {",
        "  const d = new Date();",
        '  const pad = (n) => String(n).padStart(2, "0");',
        "  return (",
        "    String(d.getFullYear()) +",
        "    pad(d.getMonth() + 1) +",
        "    pad(d.getDate()) +",
        '    "-" +',
        "    pad(d.getHours()) +",
        "    pad(d.getMinutes()) +",
        "    pad(d.getSeconds())",
        "  );",
        "}",
        "",
        "async function main() {",
        "  ensureGitRepoRoot();",
        "  const isTs = detectTypeScriptProject();",
        "  const distEntry = detectDistEntry();",
        '  const isWin = process.platform === "win32";',
        "",
        "  // 2) For TypeScript, run build and package dist entry",
        "  if (isTs) {",
        "    const r = isWin",
        '      ? runInherit("cmd", ["/d", "/s", "/c", "npm run build"], { cwd: process.cwd() })',
        '      : runInherit("npm", ["run", "build"], { cwd: process.cwd() });',
        '    if (r.error) throw new Error("Failed to run npm: " + String(r.error?.message || r.error));',
        '    if (r.status !== 0) throw new Error("npm run build failed");',
        "    if (!fs.existsSync(distEntry)) {",
        '      throw new Error("Expected build output missing: " + distEntry);',
        "    }",
        "  }",
        "",
        "  let files = gitFileList().filter((p) => !shouldExcludeFromPackage(p));",
        "",
        "  if (isTs) {",
        "    // dist/ is typically ignored; ensure we still include the built entry",
        '    files = files.filter((p) => !p.startsWith("dist/"));',
        "    files.push(distEntry);",
        "  }",
        "",
        "  files = uniqStable(files);",
        "",
        "  if (files.length === 0) {",
        "    throw new Error(",
        '      "No files found to package. If you just created the project, make sure git is initialized and .gitignore exists.",',
        "    );",
        "  }",
        "",
        '  const outDir = path.join(process.cwd(), "dist");',
        "  await ensureDir(outDir);",
        '  const outZip = path.join(outDir, "glosc-package-" + timestamp() + ".zip");',
        "",
        "  const tmpDir = await prepareTmpDir();",
        "  try {",
        "    await writeNulSeparatedList(tmpDir, files);",
        "    gitArchiveZipFromWorkingTreeFiles(outZip, files);",
        "  } finally {",
        "    try {",
        "      await fsp.rm(tmpDir, { recursive: true, force: true });",
        "    } catch {",
        "      // ignore",
        "    }",
        "  }",
        "",
        "  const st = await fsp.stat(outZip).catch(() => undefined);",
        "  if (!st || st.size <= 0) {",
        '    throw new Error("Packaging failed: zip was not created: " + outZip);',
        "  }",
        "",
        '  console.log("Created: " + outZip);',
        "}",
        "",
        "main().catch((err) => {",
        "  console.error(String(err?.message || err));",
        "  process.exit(1);",
        "});",
    ].join("\n");
}

function entryPath(options: ProjectOptions): string {
    return options.language === "python"
        ? options.mainFileName
        : `src/${options.mainFileName}`;
}

function mcpRuntime(options: ProjectOptions): "python" | "node" {
    return options.language === "python" ? "python" : "node";
}

function mcpEntry(options: ProjectOptions): string {
    if (options.language === "python") return options.mainFileName;
    return `dist/${options.mainFileName.replace(/\.ts$/i, ".js")}`;
}

function escapeYamlString(value: unknown): string {
    const s = String(value ?? "");
    const escaped = s.replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function mitLicenseText({ author }: Pick<ProjectOptions, "author">): string {
    const year = new Date().getFullYear();
    const owner = String(author || "").trim() || "Copyright Holder";
    return `MIT License\n\nCopyright (c) ${year} ${owner}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`;
}

function projectReadme(options: ProjectOptions): string {
    const { projectName, description, author, language, mainFileName } =
        options;
    const langLabel = language === "python" ? "Python" : "TypeScript";

    const entry = entryPath(options);
    const runSection =
        language === "python"
            ? `## Run (Python)\n\n\n\n1) Install deps\n\n\n\n\`\`\`sh\npython -m pip install -r requirements.txt\n\`\`\`\n\n\n\n2) Run the MCP server (stdio)\n\n\n\n\`\`\`sh\npython ${entry}\n\`\`\`\n\n\n\nThis server speaks MCP over stdio. Connect using an MCP client (e.g. an editor integration).\n`
            : `## Run (TypeScript)\n\n\n\n1) Install deps\n\n\n\n\`\`\`sh\nnpm install\n\`\`\`\n\n\n\n2) Build\n\n\n\n\`\`\`sh\nnpm run build\n\`\`\`\n\n\n\n3) Run the MCP server (stdio)\n\n\n\n\`\`\`sh\nnpm start\n\`\`\`\n\n\n\nThis server speaks MCP over stdio. Connect using an MCP client (e.g. an editor integration).\n`;

    return `# ${projectName}\n\n${description || ""}\n\n## Author\n\n${
        author || ""
    }\n\n## Language\n\n${langLabel}\n\n## Entry\n\n- ${entry}\n\n## MCP Tools\n\n- get_current_time: Returns the current time (UTC, ISO 8601)\n\n${runSection}\n\n## Config\n\n- config.yml (see: mcp.runtime / mcp.entry)\n`;
}

function packagingPackageJson(options: ProjectOptions): string {
    const { projectName, description, author } = options;
    const pkg: Record<string, unknown> = {
        name: projectName,
        version: "0.1.0",
        description: description || "",
        author: author || "",
        private: true,
        scripts: {
            package: "node scripts/package.mjs",
        },
    };

    return JSON.stringify(pkg, null, 2) + "\n";
}

function configYml(options: ProjectOptions): string {
    const { projectName, description, author, language, mainFileName } =
        options;
    return [
        `name: ${escapeYamlString(projectName)}`,
        `description: ${escapeYamlString(description)}`,
        `icon: ${escapeYamlString("")}`,
        `language: ${escapeYamlString(language)}`,
        `author: ${escapeYamlString(author)}`,
        `mcp:`,
        `  runtime: ${escapeYamlString(mcpRuntime(options))}`,
        `  entry: ${escapeYamlString(mcpEntry(options))}`,
        `  cwd: ${escapeYamlString(".")}`,
        `  env: {}`,
        `  args: []`,
        "",
    ].join("\n");
}

function pythonMain({
    projectName,
}: Pick<ProjectOptions, "projectName" | "description">): string {
    const safeName = String(projectName || "mcp-server").replace(/"/g, '\\"');

    return `from datetime import datetime, timezone\n\nfrom mcp.server.fastmcp import FastMCP\n\n# Minimal MCP server (stdio)\n\nmcp = FastMCP("${safeName}")\n\n\n@mcp.tool()\nasync def get_current_time() -> str:\n    """Return the current time in UTC (ISO 8601)."""\n\n    return datetime.now(timezone.utc).isoformat()\n\n\ndef main():\n    mcp.run(transport="stdio")\n\n\nif __name__ == "__main__":\n    main()\n`;
}

function pythonRequirements(): string {
    return `mcp\n`;
}

function pythonPyproject({
    projectName,
    author,
}: Pick<ProjectOptions, "projectName" | "author">): string {
    const safeName = String(projectName || "glosc-project")
        .trim()
        .replace(/\s+/g, "-");

    const safeAuthor = String(author || "").replace(/"/g, '\\"');

    const authorsLine = safeAuthor.trim()
        ? `authors = [{ name = "${safeAuthor}" }]\n`
        : "";

    return `# Minimal pyproject.toml (adjust as needed)\n\n[project]\nname = "${safeName}"\nversion = "0.1.0"\ndescription = ""\n${authorsLine}requires-python = ">=3.10"\ndependencies = [\n  "mcp",\n]\n\n[build-system]\nrequires = ["setuptools>=61.0"]\nbuild-backend = "setuptools.build_meta"\n`;
}

function nodePackageJson(options: ProjectOptions): string {
    const { projectName, description, author, mainFileName } = options;
    const distEntry = `dist/${mainFileName.replace(/\.ts$/i, ".js")}`;

    const pkg: Record<string, unknown> = {
        name: projectName,
        version: "0.1.0",
        description: description || "",
        author: author || "",
        private: true,
        type: "module",
        scripts: {
            build: `esbuild src/${mainFileName} --bundle --platform=node --format=esm --target=es2022 --packages=external --sourcemap --outfile=${distEntry}`,
            start: `node ${distEntry}`,
            package: "node scripts/package.mjs",
        },
        dependencies: {
            "@modelcontextprotocol/sdk": "^1.24.3",
        },
        devDependencies: {
            esbuild: "^0.20.2",
            typescript: "^5.9.3",
            "@types/node": "^22.19.2",
        },
    };

    return JSON.stringify(pkg, null, 2) + "\n";
}

function tsConfig(): string {
    return (
        JSON.stringify(
            {
                compilerOptions: {
                    target: "ES2022",
                    module: "Node16",
                    strict: true,
                    outDir: "dist",
                    rootDir: "src",
                    esModuleInterop: true,
                    moduleResolution: "Node16",
                    types: ["node"],
                    skipLibCheck: true,
                    forceConsistentCasingInFileNames: true,
                },
                include: ["src/**/*.ts"],
            },
            null,
            2
        ) + "\n"
    );
}

function tsMain({ projectName }: Pick<ProjectOptions, "projectName">): string {
    const safeName = String(projectName || "mcp-server").replace(/"/g, '\\"');

    return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";\nimport { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";\n\nconst server = new McpServer({\n  name: "${safeName}",\n  version: "0.1.0",\n});\n\nserver.registerTool(\n  "get_current_time",\n  {\n    title: "Get Current Time",\n    description: "Return the current time in UTC (ISO 8601)",\n    inputSchema: {},\n  },\n  async () => {\n    return {\n      content: [\n        {\n          type: "text",\n          text: new Date().toISOString(),\n        },\n      ],\n    };\n  },\n);\n\nasync function main() {\n  const transport = new StdioServerTransport();\n  await server.connect(transport);\n  console.error("MCP Server running on stdio");\n}\n\nmain().catch((error) => {\n  console.error("Fatal error in main():", error);\n  process.exit(1);\n});\n`;
}

export function getProjectFiles(options: ProjectOptions): ProjectFile[] {
    const files: ProjectFile[] = [];

    files.push({
        relativePath: ".gitignore",
        content: gitignoreContent(options.language),
    });
    files.push({
        relativePath: "scripts/package.mjs",
        content: packagingScriptMjs(),
    });
    files.push({ relativePath: "config.yml", content: configYml(options) });

    if (options.readme) {
        files.push({
            relativePath: "README.md",
            content: projectReadme(options),
        });
    }

    if (options.license) {
        files.push({
            relativePath: "LICENSE",
            content: mitLicenseText(options),
        });
    }

    if (options.language === "python") {
        files.push({
            relativePath: options.mainFileName,
            content: pythonMain(options),
        });
        files.push({
            relativePath: "requirements.txt",
            content: pythonRequirements(),
        });
        files.push({
            relativePath: "pyproject.toml",
            content: pythonPyproject(options),
        });
        files.push({
            relativePath: "package.json",
            content: packagingPackageJson(options),
        });
    }

    if (options.language === "typescript") {
        files.push({
            relativePath: `src/${options.mainFileName}`,
            content: tsMain(options),
        });
        files.push({
            relativePath: "package.json",
            content: nodePackageJson(options),
        });
        files.push({ relativePath: "tsconfig.json", content: tsConfig() });
    }

    return files;
}
