import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const checker = join(root, 'scripts', 'check-release.mjs');

test('release metadata accepts the exact semantic-version tag', () => {
  const result = spawnSync(process.execPath, [checker, 'v0.1.0'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert(result.stdout.includes('release metadata valid: v0.1.0'));
});

test('release metadata rejects a mismatched tag', () => {
  const result = spawnSync(process.execPath, [checker, 'v9.9.9'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert(result.stderr.includes('does not match v0.1.0'));
});

test('release automation pins actions and gates publication on the full compatibility matrix', () => {
  for (const name of ['ci.yml', 'release.yml']) {
    const workflow = readFileSync(join(root, '.github/workflows', name), 'utf8');
    assert(!/uses:\s+actions\/(checkout|setup-node)@v\d/.test(workflow));
    assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
    assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  }
  const release = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8');
  assert(release.includes('git merge-base --is-ancestor "$GITHUB_SHA" origin/main'));
  assert.match(release, /os:\s*\[ubuntu-latest, macos-latest\]/);
  assert.match(release, /node:\s*\[20, 22, 24\]/);
  assert.match(release, /publish:\n\s+needs: verify/);
  assert.equal((release.match(/gh release create/g) || []).length, 1);
});
