import assert from 'node:assert/strict';
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
