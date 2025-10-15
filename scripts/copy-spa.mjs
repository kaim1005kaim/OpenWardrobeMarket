import { mkdirSync, rmSync, readdirSync, statSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');
const targetDir = join(projectRoot, 'public', 'spa');

function ensureExists(path) {
  mkdirSync(path, { recursive: true });
}

function copyRecursive(source, target) {
  ensureExists(target);
  for (const entry of readdirSync(source)) {
    const srcPath = join(source, entry);
    const destPath = join(target, entry);
    if (statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  try {
    rmSync(targetDir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  ensureExists(targetDir);

  // Copy assets directory first
  copyRecursive(join(distDir, 'assets'), join(targetDir, 'assets'));

  // Copy other static files except index.html and assets directory
  for (const entry of readdirSync(distDir)) {
    if (entry === 'index.html' || entry === 'assets') continue;
    const srcPath = join(distDir, entry);
    const destPath = join(targetDir, entry);
    if (statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }

  // Rewrite index.html asset paths and write to target
  const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
  const rewritten = indexHtml.replace(/"\/assets\//g, '"/spa/assets/');
  writeFileSync(join(targetDir, 'index.html'), rewritten, 'utf8');
}

main();
