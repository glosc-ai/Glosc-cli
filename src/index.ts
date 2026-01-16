import prompts from "prompts";
import * as path from "node:path";
import * as os from "node:os";
import { scaffoldProject } from "./scaffold";

type Language = "python" | "typescript";

type ProjectOptions = {
    projectName: string;
    description: string;
    author: string;
    language: Language;
    mainFileName: string;
    readme: boolean;
    license: boolean;
};

type ParsedArgs = {
    defaults: boolean;
    language?: string;
    mainFileName?: string;
    description?: string;
    author?: string;
    readme?: boolean;
    license?: boolean;
    projectName?: string;
};

function parseArgs(argv: string[]): ParsedArgs {
    const result: ParsedArgs = {
        defaults: false,
        language: undefined,
        mainFileName: undefined,
        description: undefined,
        author: undefined,
        readme: undefined,
        license: undefined,
        projectName: undefined,
    };

    const args = Array.from(argv);

    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (!a) continue;

        if (a === "--defaults" || a === "--yes" || a === "-y") {
            result.defaults = true;
            continue;
        }

        if (a === "--no-readme") {
            result.readme = false;
            continue;
        }

        if (a === "--readme") {
            result.readme = true;
            continue;
        }

        if (a === "--no-license") {
            result.license = false;
            continue;
        }

        if (a === "--license") {
            result.license = true;
            continue;
        }

        if (a === "--language" && i + 1 < args.length) {
            result.language = args[++i];
            continue;
        }

        if (a === "--main" && i + 1 < args.length) {
            result.mainFileName = args[++i];
            continue;
        }

        if (a === "--description" && i + 1 < args.length) {
            result.description = args[++i];
            continue;
        }

        if (a === "--author" && i + 1 < args.length) {
            result.author = args[++i];
            continue;
        }

        if (!a.startsWith("-") && !result.projectName) {
            result.projectName = a;
            continue;
        }
    }

    return result;
}

function normalizeLanguage(value: unknown): Language | undefined {
    const v = String(value || "")
        .trim()
        .toLowerCase();
    if (v === "py" || v === "python") return "python";
    if (v === "ts" || v === "typescript") return "typescript";
    if (v === "js" || v === "javascript") {
        throw new Error(
            "JavaScript template has been removed. Use --language typescript (or omit --language) instead."
        );
    }
    return undefined;
}

function normalizeMainFileName(
    language: Language,
    mainFileNameRaw: unknown
): string {
    const trimmed = String(mainFileNameRaw || "").trim();
    const defaultExt = language === "python" ? ".py" : ".ts";
    const base =
        trimmed.length > 0
            ? trimmed
            : language === "python"
            ? "main.py"
            : "index.ts";

    if (path.extname(base)) return base;
    return `${base}${defaultExt}`;
}

function getDefaultAuthor(): string {
    const candidates = [
        process.env.GIT_AUTHOR_NAME,
        process.env.GIT_COMMITTER_NAME,
        process.env.USER,
        process.env.USERNAME,
        process.env.LOGNAME,
    ];

    for (const c of candidates) {
        const v = String(c || "").trim();
        if (v) return v;
    }

    try {
        const u = os.userInfo();
        const name = String(u?.username || "").trim();
        if (name) return name;
    } catch {
        // ignore
    }

    return "Your Name";
}

async function run(): Promise<void> {
    const argv = process.argv.slice(2);
    const args = parseArgs(argv);

    if (args.defaults) {
        if (!args.projectName) {
            throw new Error(
                "Project name is required (e.g. `npm create glosc@latest my-app -- --defaults`)"
            );
        }

        const language = normalizeLanguage(args.language) || "typescript";

        const options: ProjectOptions = {
            projectName: String(args.projectName).trim(),
            description: String(
                args.description || "A brief description of your project"
            ).trim(),
            author: String(args.author || getDefaultAuthor()).trim(),
            language,
            mainFileName: normalizeMainFileName(language, args.mainFileName),
            readme: args.readme !== undefined ? Boolean(args.readme) : true,
            license: args.license !== undefined ? Boolean(args.license) : true,
        };

        await scaffoldProject(options);
        return;
    }

    // allow `npm create ... <name>` to prefill
    prompts.override({
        projectName: args.projectName,
        author: args.author,
    });

    let selectedLanguage: Language | undefined;

    const response = await prompts(
        [
            {
                type: "text",
                name: "projectName",
                message: "Project name:",
                validate: (value: string) => {
                    const name = String(value || "").trim();
                    if (!name) return "Project name is required";
                    if (name.includes("/") || name.includes("\\"))
                        return "Project name cannot include path separators";
                    return true;
                },
            },
            {
                type: "text",
                name: "description",
                message: "Description:",
                initial: "A brief description of your project",
            },
            {
                type: "text",
                name: "author",
                message: "Author:",
                initial: getDefaultAuthor(),
            },
            {
                type: "select",
                name: "language",
                message: "Use Language:",
                choices: [
                    { title: "Python", value: "python" },
                    { title: "TypeScript", value: "typescript" },
                ],
                onState: (state: { value: Language }) => {
                    selectedLanguage = state.value;
                },
            },
            {
                type: (prev: Language) => (prev ? "text" : null),
                name: "mainFileName",
                message: "Main File Name:",
                initial: (prev: Language) =>
                    prev === "python" ? "main.py" : "index.ts",
                validate: (value: string, values?: { language?: Language }) => {
                    const name = String(value || "").trim();
                    if (!name) return "Main file name is required";
                    const ext = path.extname(name);
                    const currentLanguage =
                        values?.language || selectedLanguage;
                    if (!currentLanguage) return true;
                    const expected =
                        currentLanguage === "python" ? ".py" : ".ts";
                    if (ext && ext !== expected)
                        return `Main file should end with ${expected}`;
                    return true;
                },
            },
            {
                type: "confirm",
                name: "readme",
                message: "Readme:",
                initial: true,
            },
            {
                type: "confirm",
                name: "license",
                message: "License (MIT):",
                initial: true,
            },
        ],
        {
            onCancel: () => {
                process.exitCode = 1;
                return false;
            },
        }
    );

    if (!response || !response.projectName) {
        process.exitCode = 1;
        return;
    }

    const options: ProjectOptions = {
        projectName: String(response.projectName).trim(),
        description: String(response.description || "").trim(),
        author: String(response.author || "").trim(),
        language: response.language as Language,
        mainFileName: normalizeMainFileName(
            response.language as Language,
            response.mainFileName
        ),
        readme: Boolean(response.readme),
        license: Boolean(response.license),
    };

    await scaffoldProject(options);
}

run().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
});
