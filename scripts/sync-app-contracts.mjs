#!/usr/bin/env node

import { mkdir, copyFile, rm, readdir, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const artifactPath = path.join(rootDir, "artifacts/contracts/Swap2p.sol/Swap2p.json");
const typechainDir = path.join(rootDir, "typechain-types");
const appDir = path.join(rootDir, "app");
const generatedDir = path.join(appDir, "lib/swap2p/generated");
const typechainDestDir = path.join(generatedDir, "typechain");
const abiDestPath = path.join(generatedDir, "Swap2p.json");

async function ensureExists(targetPath, description) {
  try {
    await stat(targetPath);
  } catch {
    throw new Error(`sync-app-contracts: Missing ${description} at ${targetPath}. Run "npm run compile" first.`);
  }
}

async function emptyDir(dirPath) {
  await rm(dirPath, { recursive: true, force: true });
  await mkdir(dirPath, { recursive: true });
}

async function copyDir(srcDir, destDir) {
  const entries = await readdir(srcDir, { withFileTypes: true });
  await mkdir(destDir, { recursive: true });

  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDir(src, dest);
      continue;
    }

    await copyFile(src, dest);
  }
}

async function writeGeneratedIndex() {
  const content = `export { default as swap2pArtifact } from "./Swap2p.json";\nexport * from "./typechain";\n`;
  await writeFile(path.join(generatedDir, "index.ts"), content, "utf8");
}

async function main() {
  await ensureExists(appDir, "Next.js app directory");
  await ensureExists(artifactPath, "Swap2p artifact");
  await ensureExists(typechainDir, "typechain output");

  await mkdir(generatedDir, { recursive: true });
  await copyFile(artifactPath, abiDestPath);

  await emptyDir(typechainDestDir);

  await copyDir(typechainDir, typechainDestDir);

  await writeGeneratedIndex();

  const message = [
    `Copied Swap2p artifact to ${path.relative(rootDir, abiDestPath)}`,
    `Copied typechain typings to ${path.relative(rootDir, typechainDestDir)}`,
  ].join("\n");

  console.log(message);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
