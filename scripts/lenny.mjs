#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  classifyRisk,
  doctorProject,
  installProject,
  setupProject,
  uninstallProject,
} from './lib/lenny-core.mjs';

const argv = process.argv.slice(2);
const command = argv.shift();
const currentCli = fileURLToPath(import.meta.url);
const scriptRoot = resolve(dirname(currentCli), '..');
const runningFromInstalledCore = resolve(scriptRoot, 'bin/lenny.mjs') === currentCli;
let options = {};

try {
  options = parseOptions(argv);
  validateOptions(command, options);
  const target = resolve(options.target || process.cwd());
  if (options.help) {
    help(command);
    process.exit(0);
  }
  switch (command) {
    case 'install':
      if (runningFromInstalledCore) {
        throw new Error('installed Lenny cannot reinstall itself without trusted release provenance; rerun the pinned bootstrap install command from the release notes');
      }
      {
        const source = resolve(options.source || scriptRoot);
        if (options['source-kind'] === 'release') verifyReleaseSource(source, options);
        print(await installProject({
          source,
          target,
          dryRun: Boolean(options['dry-run']),
          provenance: {
            sourceKind: options['source-kind'] || 'local-unverified',
            repository: options.repository || '',
            version: options.version || '',
            commit: options.commit || '',
          },
        }), options);
      }
      break;
    case 'setup':
      print(await setupProject({ target, force: Boolean(options.force) }), options);
      break;
    case 'doctor': {
      const result = await doctorProject({ target, deep: options.deep === 'true' });
      print(result, options);
      if (!result.ok) process.exitCode = 1;
      break;
    }
    case 'risk':
      print(await classifyRisk({
        target,
        files: listOption(options.files),
        description: String(options.description || ''),
        forceHigh: Boolean(options.high),
        reviewedCommit: String(options['reviewed-commit'] || ''),
        mergeBase: String(options['merge-base'] || ''),
      }), options);
      break;
    case 'uninstall':
      print(await uninstallProject({ target, dryRun: Boolean(options['dry-run']) }), options);
      break;
    case 'version':
      print({ ok: true, version: await installedVersion(target, scriptRoot) }, options);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      help();
      break;
    default:
      throw new Error(`unknown command: ${command}`);
  }
} catch (error) {
  if (options.json) {
    console.error(JSON.stringify({ ok: false, error: error.message }));
  } else {
    console.error(`Lenny: ${error.message}`);
  }
  process.exitCode = 1;
}

function parseOptions(args) {
  const result = {};
  while (args.length) {
    const item = args.shift();
    if (!item.startsWith('--')) throw new Error(`unexpected argument: ${item}`);
    const key = item.slice(2);
    if (['dry-run', 'force', 'json', 'high', 'help'].includes(key)) {
      result[key] = true;
    } else {
      if (!args.length) throw new Error(`${item} requires a value`);
      result[key] = args.shift();
    }
  }
  return result;
}

function listOption(value) {
  if (!value) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function verifyReleaseSource(source, options) {
  const git = (...args) => {
    const result = spawnSync('git', ['-C', source, ...args], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('release source must be an immutable Git checkout');
    return result.stdout.trim();
  };
  const commit = String(options.commit || '');
  if (git('rev-parse', 'HEAD') !== commit) throw new Error('release source HEAD does not match --commit');
  if (git('status', '--porcelain', '--untracked-files=no')) {
    throw new Error('release source contains modified tracked files');
  }
  const expected = normalizeRepository(options.repository || '');
  const actual = normalizeRepository(git('remote', 'get-url', 'origin'));
  if (!expected || expected !== actual) throw new Error('release source origin does not match --repository');
}

function normalizeRepository(value) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return String(value).replace(/\/$/, '');
  }
}

function validateOptions(commandName, options) {
  const schemas = {
    install: ['source', 'target', 'dry-run', 'source-kind', 'repository', 'version', 'commit', 'json', 'help'],
    setup: ['target', 'force', 'json', 'help'],
    doctor: ['target', 'deep', 'json', 'help'],
    risk: ['target', 'files', 'description', 'high', 'reviewed-commit', 'merge-base', 'json', 'help'],
    uninstall: ['target', 'dry-run', 'json', 'help'],
    version: ['target', 'json', 'help'],
    help: ['help'],
  };
  const allowed = schemas[commandName];
  if (!allowed) return;
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) throw new Error(`unsupported option for ${commandName}: --${key}`);
  }
}

function print(result, options) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const line of result.lines || []) console.log(line);
  if (!result.lines) console.log(result.version || JSON.stringify(result, null, 2));
}

async function installedVersion(targetPath, fallbackRoot) {
  const { readFile } = await import('node:fs/promises');
  for (const path of [resolve(targetPath, '.lenny/core/VERSION'), resolve(fallbackRoot, 'VERSION')]) {
    try {
      return (await readFile(path, 'utf8')).trim();
    } catch {}
  }
  throw new Error('Lenny version is not installed');
}

function help(commandName) {
  const commands = {
    install: 'lenny.mjs install --source PATH [--target PATH] [--dry-run]',
    setup: 'lenny.mjs setup [--target PATH] [--force]',
    doctor: 'lenny.mjs doctor [--target PATH] [--json] [--deep true]',
    risk: 'lenny.mjs risk [--target PATH] [--files a,b] [--description TEXT] [--reviewed-commit SHA --merge-base SHA] [--high] [--json]',
    uninstall: 'lenny.mjs uninstall [--target PATH] [--dry-run]',
    version: 'lenny.mjs version [--target PATH]',
  };
  if (commandName && commands[commandName]) {
    console.log(`Lenny ${commandName}\n\nUsage:\n  ${commands[commandName]}\n\nRun lenny.mjs help to see every command.`);
    return;
  }
  console.log(`Lenny\n\nUsage:\n  ${Object.values(commands).join('\n  ')}\n\nEvery command accepts --help.\n\nAfter installation, run:\n  node .lenny/core/bin/lenny.mjs setup\n  node .lenny/core/bin/lenny.mjs doctor`);
}
