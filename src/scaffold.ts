import * as fs from "node:fs/promises";
import * as path from "node:path";
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

    // eslint-disable-next-line no-console
    console.log(`\nCreated project at: ${targetRoot}`);
}
