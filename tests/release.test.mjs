import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { privateReleaseFindings, secretFindings } from '../scripts/check-public-release.mjs';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const checker = join(root, 'scripts', 'check-release.mjs');
const currentVersion = readFileSync(join(root, 'VERSION'), 'utf8').trim();
const releaseCheckEnv = { ...process.env };
delete releaseCheckEnv.GITHUB_REF_TYPE;
delete releaseCheckEnv.GITHUB_REF_NAME;

test('release metadata accepts the exact semantic-version tag', () => {
  const result = spawnSync(process.execPath, [checker, `v${currentVersion}`], {
    cwd: root,
    encoding: 'utf8',
    env: releaseCheckEnv,
  });
  assert.equal(result.status, 0, result.stderr);
  assert(result.stdout.includes(`release metadata valid: v${currentVersion}`));
});

test('release metadata rejects a mismatched tag', () => {
  const result = spawnSync(process.execPath, [checker, 'v9.9.9'], {
    cwd: root,
    encoding: 'utf8',
    env: releaseCheckEnv,
  });
  assert.notEqual(result.status, 0);
  assert(result.stderr.includes(`does not match v${currentVersion}`));
});

test('release automation pins actions and gates publication on the full compatibility matrix', () => {
  for (const name of ['ci.yml', 'release.yml']) {
    const workflow = readFileSync(join(root, '.github/workflows', name), 'utf8');
    assert(!/uses:\s+actions\/(checkout|setup-node)@v\d/.test(workflow));
    assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
    assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  }
  const release = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8');
  assert(release.includes('git merge-base --is-ancestor "$EVENT_COMMIT" origin/main'));
  assert.match(release, /os:\s*\[ubuntu-latest, macos-latest\]/);
  assert.match(release, /node:\s*\[20, 22, 24\]/);
  assert.match(release, /publish:\n\s+needs: verify/);
  assert.equal((release.match(/gh release create/g) || []).length, 1);
  assert(release.includes('raw.githubusercontent.com/lennytools/lenny/$EVENT_COMMIT/scripts/install.sh'));
  assert(release.includes('--commit $EVENT_COMMIT'));
  assert(release.includes('shasum -a 256 scripts/install.sh'));
  assert(release.includes('EVENT_COMMIT=$(git rev-parse "$GITHUB_SHA^{commit}")'));
  assert(release.includes('REMOTE_TAG_COMMIT'));
  assert(release.includes('--target "$EVENT_COMMIT"'));
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert(!/raw\.githubusercontent\.com\/lennytools\/lenny\/v\d+\.\d+\.\d+\/scripts\/install\.sh/.test(readme));
  assert(readme.includes('--commit <SAME-40-CHARACTER-RELEASE-COMMIT>'));
});

test('public release scanner detects private paths and representative secrets', () => {
  const homePath = ['/Users', '/example', '/project'].join('');
  assert.deepEqual(privateReleaseFindings([['receipt.md', homePath]]),
    ['receipt.md: absolute home path']);
  const fakeAws = ['AWS_SECRET_ACCESS', '_KEY=', 'not-a-real-secret'].join('');
  const fakeGitHub = ['ghp_', 'A'.repeat(36)].join('');
  const findings = secretFindings(`diff --git a/x b/x\n+++ b/x\n+${fakeAws}\n+${fakeGitHub}\n`);
  assert(findings.includes('AWS secret key'));
  assert(findings.includes('GitHub classic token'));
  const unquoted = ['api_', 'key=', 'unquoted-secret-value'].join('');
  assert(secretFindings(`+++ b/x\n+${unquoted}\n`).includes('assigned credential'));
  const jsonApiKey = ['{"api', 'Key":"sk-', 'proj-', 'A'.repeat(16), '"}'].join('');
  const bearer = ['Authorization: Bearer ', 'sk-', 'ant-', 'B'.repeat(16)].join('');
  const stripe = ['{"STRIPE_LIVE_', 'KEY":"sk_', 'live_', 'C'.repeat(16), '"}'].join('');
  assert(secretFindings(`+++ b/x\n+${jsonApiKey}\n`).includes('model API key'));
  assert(secretFindings(`+++ b/x\n+${bearer}\n`).includes('authorization bearer token'));
  assert(secretFindings(`+++ b/x\n+${stripe}\n`).includes('Stripe secret key'));
  const terminalHome = ['/Users', '/example'].join('');
  assert.deepEqual(privateReleaseFindings([['receipt.md', terminalHome]]),
    ['receipt.md: absolute home path']);
  const lowercasePrivate = ['bradley', ' miles'].join('');
  assert.deepEqual(privateReleaseFindings([['receipt.md', lowercasePrivate]]),
    ['receipt.md: private doctrine']);
  assert.deepEqual(secretFindings(`diff --git a/x b/x\n--- a/x\n-${fakeAws}\n+safe=true\n`), []);
});

test('the standing check executes the public release scanner', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert(pkg.scripts.check.includes('node scripts/check-public-release.mjs'));
  const scanner = readFileSync(join(root, 'scripts/check-public-release.mjs'), 'utf8');
  assert(!scanner.includes('origin/main'));
});

test('public release excludes Bradley-specific council packs and company doctrine', () => {
  const skillNames = readdirSync(join(root, 'skills'));
  for (const privateSkill of ['gtm-council', 'entrepreneur-council', 'product-council']) {
    assert(!skillNames.includes(privateSkill));
  }
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  assert.equal(tracked.status, 0, tracked.stderr);
  const privateTerms = ['Bradley' + ' Miles', 'Avalon' + ' Labs', 'A' + 'IX'];
  for (const path of tracked.stdout.split('\0').filter(Boolean)) {
    const bytes = readFileSync(join(root, path));
    if (bytes.includes(0)) continue;
    const contents = bytes.toString('utf8');
    assert(!privateTerms.some((term) => contents.includes(term)), `${path} contains private doctrine`);
  }
});
