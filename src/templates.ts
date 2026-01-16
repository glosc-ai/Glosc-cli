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

    const entry = `src/${mainFileName}`;
    const runSection =
        language === "python"
            ? `## Run (Python)\n\n\n\n1) Install deps\n\n\n\n\`\`\`sh\npython -m pip install -r requirements.txt\n\`\`\`\n\n\n\n2) Run the MCP server (stdio)\n\n\n\n\`\`\`sh\npython ${entry}\n\`\`\`\n\n\n\nThis server speaks MCP over stdio. Connect using an MCP client (e.g. an editor integration).\n`
            : `## Run (TypeScript)\n\n\n\n1) Install deps\n\n\n\n\`\`\`sh\nnpm install\n\`\`\`\n\n\n\n2) Build\n\n\n\n\`\`\`sh\nnpm run build\n\`\`\`\n\n\n\n3) Run the MCP server (stdio)\n\n\n\n\`\`\`sh\nnpm start\n\`\`\`\n\n\n\nThis server speaks MCP over stdio. Connect using an MCP client (e.g. an editor integration).\n`;

    return `# ${projectName}\n\n${description || ""}\n\n## Author\n\n${
        author || ""
    }\n\n## Language\n\n${langLabel}\n\n## Entry\n\n- ${entry}\n\n## MCP Tools\n\n- get_current_time: Returns the current time (UTC, ISO 8601)\n\n${runSection}\n\n## Config\n\n- config.yml\n`;
}

function configYml(options: ProjectOptions): string {
    const { projectName, description, author, language, mainFileName } =
        options;
    return [
        `name: ${escapeYamlString(projectName)}`,
        `description: ${escapeYamlString(description)}`,
        `author: ${escapeYamlString(author)}`,
        `language: ${escapeYamlString(language)}`,
        `entry: ${escapeYamlString(`src/${mainFileName}`)}`,
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
            relativePath: `src/${options.mainFileName}`,
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
