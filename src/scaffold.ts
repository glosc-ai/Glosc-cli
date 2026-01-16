import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { getProjectFiles, type ProjectOptions } from "./templates";

async function pathExists(p: string): Promise<boolean> {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

async function ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
}

async function writeFileEnsuringDir(
    filePath: string,
    content: string
): Promise<void> {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, "utf8");
}

function tryInitGitRepo(targetRoot: string): void {
    try {
        const version = spawnSync("git", ["--version"], {
            cwd: targetRoot,
            stdio: "ignore",
            shell: false,
        });

        if (version.status !== 0) return;

        const init = spawnSync("git", ["init"], {
            cwd: targetRoot,
            stdio: "ignore",
            shell: false,
        });

        if (init.status !== 0) return;
    } catch {
        // best-effort: do not block scaffolding if git isn't available
    }
}

export async function scaffoldProject(options: ProjectOptions): Promise<void> {
    const targetRoot = path.resolve(process.cwd(), options.projectName);

    if (await pathExists(targetRoot)) {
        throw new Error(`Target directory already exists: ${targetRoot}`);
    }

    const files = getProjectFiles(options);

    await ensureDir(targetRoot);

    for (const file of files) {
        const absPath = path.join(targetRoot, file.relativePath);
        await writeFileEnsuringDir(absPath, file.content);
    }

    tryInitGitRepo(targetRoot);

    // eslint-disable-next-line no-console
    console.log(`\nCreated project at: ${targetRoot}`);
}
