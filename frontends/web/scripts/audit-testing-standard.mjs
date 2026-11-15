import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const deprecatedTestScriptPattern = /^test:(node|browser|playwright|vitest)(:|$)/;

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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function relativeTo(frontendRoot, targetPath) {
  return path.relative(frontendRoot, targetPath).replace(/\\/g, '/');
}

export async function auditFrontendTestingStandard(options = {}) {
  const frontendRoot = options.frontendRoot ?? process.cwd();
  const findings = [];
  const packageRoots = await findPackageRoots(frontendRoot);

  for (const packageRoot of packageRoots) {
    const packageName = relativeTo(frontendRoot, packageRoot);
    const packageJson = await readJson(path.join(packageRoot, 'package.json'));
    const scripts = packageJson.scripts ?? {};
    const hasTestsDirectory = await pathExists(path.join(packageRoot, 'tests'));
    const hasTestsReadme = await pathExists(path.join(packageRoot, 'tests', 'README.md'));
    const hasVitestConfig =
      (await pathExists(path.join(packageRoot, 'vitest.config.js')))
      || (await pathExists(path.join(packageRoot, 'vitest.config.ts')));
    const hasPlaywrightConfig = await pathExists(path.join(packageRoot, 'playwright.config.js'));

    if (!hasTestsDirectory) {
      findings.push(`${packageName}: missing tests/ directory`);
    }
    if (!hasTestsReadme) {
      findings.push(`${packageName}: missing tests/README.md`);
    }
    if (!scripts['test']) {
      findings.push(`${packageName}: missing test script`);
    }
    if (!scripts['test:unit']) {
      findings.push(`${packageName}: missing test:unit script`);
    } else if (!String(scripts['test:unit']).includes('vitest')) {
      findings.push(`${packageName}: test:unit should be backed by Vitest`);
    }
    if (hasPlaywrightConfig) {
      if (!scripts['test:integration']) {
        findings.push(`${packageName}: missing test:integration script`);
      } else if (!String(scripts['test:integration']).includes('playwright')) {
        findings.push(`${packageName}: test:integration should be backed by Playwright`);
      }
    }
    if (hasVitestConfig && !scripts['test:unit']) {
      findings.push(`${packageName}: vitest config exists without test:unit script`);
    }

    Object.keys(scripts)
      .filter((scriptName) => deprecatedTestScriptPattern.test(scriptName))
      .sort()
      .forEach((scriptName) => {
        findings.push(`${packageName}: deprecated test alias ${scriptName}`);
      });
  }

  return findings;
}
