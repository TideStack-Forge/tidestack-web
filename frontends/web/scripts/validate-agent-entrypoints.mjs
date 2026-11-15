import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

function isExternalLink(target) {
  return target.startsWith('http://')
    || target.startsWith('https://')
    || target.startsWith('mailto:')
    || target.startsWith('#');
}

function stripLinkDecorators(target) {
  return target.split('#', 1)[0].split('?', 1)[0];
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findPackageRoots(frontendRoot) {
  const entries = await readdir(frontendRoot, { withFileTypes: true });
  const packageRoots = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageRoot = path.join(frontendRoot, entry.name);
    if (await pathExists(path.join(packageRoot, 'package.json'))) {
      packageRoots.push(packageRoot);
    }
  }

  return packageRoots.sort();
}

async function collectRequiredFiles(repoRoot, frontendRoot) {
  const files = [
    path.join(repoRoot, 'AGENTS.md'),
    path.join(repoRoot, 'CLAUDE.md'),
    path.join(repoRoot, 'GEMINI.md'),
    path.join(frontendRoot, 'AGENTS.md'),
    path.join(frontendRoot, 'CLAUDE.md'),
    path.join(frontendRoot, 'GEMINI.md'),
    path.join(frontendRoot, 'README.md'),
    path.join(frontendRoot, 'TESTING.md'),
  ];

  const packageRoots = await findPackageRoots(frontendRoot);
  for (const packageRoot of packageRoots) {
    files.push(path.join(packageRoot, 'AGENTS.md'));
    files.push(path.join(packageRoot, 'CLAUDE.md'));
    files.push(path.join(packageRoot, 'GEMINI.md'));

    if (await pathExists(path.join(packageRoot, 'tests'))) {
      files.push(path.join(packageRoot, 'tests', 'README.md'));
    }
  }

  return files;
}

async function collectMarkdownLinkFindings(auditedFiles, repoRoot, missingRequiredFiles) {
  const findings = [];

  for (const filePath of auditedFiles) {
    if (!(await pathExists(filePath))) {
      continue;
    }

    const content = await readFile(filePath, 'utf8');
    const directory = path.dirname(filePath);

    for (const match of content.matchAll(markdownLinkPattern)) {
      const rawTarget = match[1];
      if (isExternalLink(rawTarget)) {
        continue;
      }

      const target = stripLinkDecorators(rawTarget);
      if (!target) {
        continue;
      }

      const resolvedTarget = path.resolve(directory, target);
      if (missingRequiredFiles.has(resolvedTarget)) {
        continue;
      }

      if (await pathExists(resolvedTarget)) {
        continue;
      }

      findings.push(
        `Broken markdown link in ${path.relative(repoRoot, filePath)}: ${rawTarget}`,
      );
    }
  }

  return findings;
}

export async function auditFrontendAgentEntrypoints(options = {}) {
  const repoRoot = options.repoRoot ?? path.resolve(process.cwd(), '..');
  const frontendRoot = options.frontendRoot ?? path.join(repoRoot, 'frontends', 'web');
  const findings = [];
  const missingRequiredFiles = new Set();
  const requiredFiles = await collectRequiredFiles(repoRoot, frontendRoot);

  for (const filePath of requiredFiles) {
    if (await pathExists(filePath)) {
      continue;
    }

    missingRequiredFiles.add(filePath);
    findings.push(`Missing required file: ${path.relative(repoRoot, filePath)}`);
  }

  const linkFindings = await collectMarkdownLinkFindings(
    requiredFiles,
    repoRoot,
    missingRequiredFiles,
  );
  return findings.concat(linkFindings);
}

async function main() {
  const frontendRoot = process.cwd();
  const repoRoot = path.resolve(frontendRoot, '..', '..');
  const findings = await auditFrontendAgentEntrypoints({ repoRoot, frontendRoot });

  if (findings.length === 0) {
    console.log('Frontend agent entrypoints look good.');
    return;
  }

  for (const finding of findings) {
    console.error(`- ${finding}`);
  }

  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryFile && currentFile === entryFile) {
  await main();
}
