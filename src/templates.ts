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
        "function hasCommand(cmd) {",
        '  if (process.platform === "win32") {',
        '    const r = run("where", [cmd]);',
        "    return r.status === 0;",
        "  }",
        '  const check = "command -v " + cmd + " >/dev/null 2>&1";',
        '  const r = run("sh", ["-lc", check]);',
        "  return r.status === 0;",
        "}",
        "",
        "function escapePsSingleQuotes(value) {",
        '  return String(value || "").replace(/\'/g, "\'\'");',
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
        '  return raw.split("\\u0000").filter(Boolean);',
        "}",
        "",
        "async function ensureDir(p) {",
        "  await fsp.mkdir(p, { recursive: true });",
        "}",
        "",
        "async function writeTempFileList(filePaths) {",
        '  const tmpDir = path.join(process.cwd(), ".glosc-tmp");',
        "  await ensureDir(tmpDir);",
        '  const listPath = path.join(tmpDir, "zip-file-list.txt");',
        '  await fsp.writeFile(listPath, filePaths.join("\\n"), "utf8");',
        "  return listPath;",
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
        "  const files = gitFileList();",
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
        "  const listPath = await writeTempFileList(files);",
        "",
        "  try {",
        '    if (hasCommand("powershell")) {',
        "      const listEsc = escapePsSingleQuotes(listPath);",
        "      const outEsc = escapePsSingleQuotes(outZip);",
        "      const psCommand = [",
        '        "$paths = Get-Content -LiteralPath \\\'" + listEsc + "\\\';",',
        '        "Compress-Archive -LiteralPath $paths -DestinationPath \\\'" + outEsc + "\\\' -Force -CompressionLevel Optimal;",',
        '      ].join(" ");',
        "      const psArgs = [",
        '        "-NoProfile",',
        '        "-ExecutionPolicy",',
        '        "Bypass",',
        '        "-Command",',
        "        psCommand,",
        "      ];",
        '      const r = run("powershell", psArgs, { cwd: process.cwd() });',
        '      if (r.status !== 0) throw new Error((r.stderr || r.stdout || "").trim());',
        '    } else if (hasCommand("pwsh")) {',
        "      const listEsc = escapePsSingleQuotes(listPath);",
        "      const outEsc = escapePsSingleQuotes(outZip);",
        "      const psCommand = [",
        '        "$paths = Get-Content -LiteralPath \\\'" + listEsc + "\\\';",',
        '        "Compress-Archive -LiteralPath $paths -DestinationPath \\\'" + outEsc + "\\\' -Force -CompressionLevel Optimal;",',
        '      ].join(" ");',
        '      const psArgs = ["-NoProfile", "-Command", psCommand];',
        '      const r = run("pwsh", psArgs, { cwd: process.cwd() });',
        '      if (r.status !== 0) throw new Error((r.stderr || r.stdout || "").trim());',
        '    } else if (hasCommand("zip")) {',
        '      const r = spawnSync("zip", ["-q", "-r", outZip, "-@"], {',
        "        cwd: process.cwd(),",
        '        input: files.join("\\n"),',
        '        stdio: ["pipe", "pipe", "pipe"],',
        '        encoding: "utf8",',
        "      });",
        '      if (r.status !== 0) throw new Error((r.stderr || r.stdout || "").trim());',
        "    } else {",
        "      throw new Error(",
        '        "No zip backend found. Install Git + PowerShell (Windows) or `zip` (macOS/Linux), then rerun.",',
        "      );",
        "    }",
        "  } finally {",
        "    try {",
        "      await fsp.rm(path.dirname(listPath), { recursive: true, force: true });",
        "    } catch {",
        "      // ignore",
        "    }",
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
            build: "tsc -p .",
            start: `node ${distEntry}`,
            package: "node scripts/package.mjs",
        },
        dependencies: {
            "@modelcontextprotocol/sdk": "^1.24.3",
        },
        devDependencies: {
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
