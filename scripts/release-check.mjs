#!/usr/bin/env node
// Make the exact tarball npm will receive, then prove it works the way a developer gets it:
// installed into an empty folder, no workspace, no node_modules from this repo.
//
//   pnpm release:check
//
// Leaves release/timeflic-cli-<version>.tgz; publish that file, nothing else.
// In CI, RELEASE_TAG (v<version>) must match package.json's version.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'release');
const stage = join(release, 'package');
const isWindows = process.platform === 'win32';

/** The published package.json: what npm and installers need, no workspace links or scripts. */
const PUBLISHED_FIELDS = ['name', 'version', 'description', 'keywords', 'homepage', 'bugs', 'repository', 'license', 'type', 'bin', 'files', 'engines', 'publishConfig'];
const EXPECTED_FILES = ['CHANGELOG.md', 'LICENSE', 'README.md', 'bin/timeflic.mjs', 'dist/THIRD_PARTY_LICENSES.md', 'dist/main.js', 'package.json'];

const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: isWindows, ...options });
const fail = (message) => {
  console.error(`\n✗ ${message}`);
  process.exit(1);
};
const step = (message) => console.log(`• ${message}`);

const source = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// 1. Tag and version agree (CI passes the pushed tag).
const tag = process.env.RELEASE_TAG;
if (tag && tag !== `v${source.version}`) fail(`tag ${tag} does not match package.json version ${source.version} (expected v${source.version})`);

// 2. Fresh bundle.
step('build');
run(process.execPath, [join(root, 'scripts', 'build.mjs')], { stdio: 'inherit' });

// 3. Stage exactly what gets published.
step('stage package');
rmSync(release, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
const published = Object.fromEntries(PUBLISHED_FIELDS.filter((key) => key in source).map((key) => [key, source[key]]));
writeFileSync(join(stage, 'package.json'), `${JSON.stringify(published, null, 2)}\n`);
for (const entry of ['bin', 'dist', 'README.md', 'LICENSE', 'CHANGELOG.md']) cpSync(join(root, entry), join(stage, entry), { recursive: true });

// 4. Pack and check the file list: nothing missing, nothing extra.
step('npm pack');
const [packed] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', release], { cwd: stage }));
const files = packed.files.map((file) => file.path).toSorted();
if (JSON.stringify(files) !== JSON.stringify(EXPECTED_FILES)) fail(`unexpected files in the package:\n  got      ${files.join(', ')}\n  expected ${EXPECTED_FILES.join(', ')}`);
const tarball = join(release, packed.filename);

// 5. Install the tarball into an empty folder and use it like a developer would.
step('install into an empty folder and run');
const sandbox = mkdtempSync(join(tmpdir(), 'timeflic-cli-check-'));
try {
  run('npm', ['init', '-y'], { cwd: sandbox });
  run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', tarball], { cwd: sandbox });
  const installed = JSON.parse(readFileSync(join(sandbox, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(sandbox, 'node_modules', '.package-lock.json'), 'utf8'));
  const extra = Object.keys(lock.packages).filter((path) => path !== '' && path !== 'node_modules/@timeflic/cli');
  if (extra.length > 0) fail(`the package pulled in dependencies (${extra.join(', ')}); everything must be bundled`);
  if (!installed.dependencies?.['@timeflic/cli']) fail('the tarball did not install');

  const bin = join(sandbox, 'node_modules', '.bin', isWindows ? 'timeflic.cmd' : 'timeflic');
  const cli = (...args) => run(bin, args, { cwd: sandbox });

  const version = cli('--version').trim();
  if (!version.startsWith(`@timeflic/cli ${source.version} `)) fail(`--version printed "${version}"`);
  for (const template of ['hr-attendance', 'leave-assistant', 'payroll-review', 'task-triage']) {
    cli('agent', 'init', template, '--out', `${template}.json`);
    cli('agent', 'validate', `${template}.json`);
  }
  if (!cli('agent', 'tools', '--search', 'leave').includes('leave.requests')) fail('agent tools --search leave found nothing');
  if (!cli('--help').includes('agent init <template>')) fail('--help does not list the agent commands');
  if (!existsSync(join(sandbox, 'leave-assistant.json'))) fail('init did not write a file');
  console.log(`  ${version}`);
} catch (error) {
  fail(`the installed package failed: ${error.stderr || error.stdout || error.message}`);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(`\n✓ ${packed.filename} (${(packed.size / 1024).toFixed(0)} KB packed, ${files.length} files) works when installed from npm.`);
console.log(`  Publish it with:  npm publish ${tarball}${source.version.includes('-') ? ' --tag next' : ''}`);
