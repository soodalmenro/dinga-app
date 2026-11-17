import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const verify = args.includes('--verify');
const outIndex = args.indexOf('--out-dir');
const out = resolve(root, outIndex < 0 ? 'dist' : args[outIndex + 1]);
if (!out.startsWith(root + '/') && !out.startsWith(root + '\\')) throw new Error('Output must stay inside the app checkout');
const licenseDir = join(root, 'public/licenses');
const archiveName = 'dinga-corresponding-source.zip';
const upstreamName = 'chordino-0.6.0-source.zip';
const upstreamSha = 'e9139f5ac4d2a6c74abbfea5d3de203fb32393f429a4ec4b62d46e90f64429ff';
const sourceArchive = join(licenseDir, archiveName);
const manifestPath = join(licenseDir, 'source-manifest.json');
const sha = value => createHash('sha256').update(value).digest('hex');
const posix = value => value.replaceAll('\\', '/');
const reject = /(^|\/)(\.env[^/]*|\.git|\.aws|\.ssh|\.codex|\.agents|\.npmrc|\.netrc|\.pypirc|id_rsa|id_ed25519|\.vercel|node_modules|qa|evaluations?|evaluation-data|evaluation-results|credentials?[^/]*|secrets?[^/]*)(\/|$)|\.(pem|key|p12|pfx)$/i;
const generated = new Set(['public/licenses/' + archiveName, 'public/licenses/source-manifest.json']);
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap(name => {
    const path = join(dir, name), item = lstatSync(path), rel = posix(relative(root, path));
    if (item.isSymbolicLink()) throw new Error('Source input must not be a symbolic link: ' + rel);
    if (reject.test(rel)) throw new Error('Excluded/private source input encountered: ' + rel);
    if (generated.has(rel)) return [];
    return item.isDirectory() ? walk(path) : [rel];
  });
}
function inputs() {
  const fixed = ['index.html', 'package.json', 'package-lock.json', 'vite.config.js', 'vercel.json', 'README.md', 'docs/CHORDINO_LICENSE.md'];
  for (const name of fixed) if (!existsSync(join(root, name))) throw new Error('Missing source input: ' + name);
  return [...fixed, ...walk(join(root, 'src')), ...walk(join(root, 'public')), ...walk(join(root, 'scripts'))].sort();
}
function hashes(files, base = root) {
  return Object.fromEntries(files.map(name => [name, sha(readFileSync(join(base, name)))]));
}
function buildFiles(dir) {
  return readdirSync(dir).sort().flatMap(name => {
    if (name === 'licenses') return [];
    const path = join(dir, name), item = lstatSync(path);
    if (item.isSymbolicLink()) throw new Error('Build must not contain symlinks');
    return item.isDirectory() ? buildFiles(path) : [posix(relative(out, path))];
  });
}
function exec(command, commandArgs, cwd = root) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', windowsHide: true, cwd });
  if (result.error || result.status !== 0) throw new Error(command + ': ' + (result.error?.message || result.stderr));
  return result.stdout;
}
if (!existsSync(join(out, 'index.html'))) throw new Error('Build first: npm run build');
if (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).license !== 'GPL-3.0-or-later') throw new Error('Declare the distributed app code GPL-3.0-or-later in package.json before packaging');
if (sha(readFileSync(join(licenseDir, upstreamName))) !== upstreamSha) throw new Error('Pinned upstream source SHA-256 mismatch');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const locked = lock.packages?.['node_modules/chordino.js'];
if (locked?.version !== '0.6.0' || locked?.integrity !== 'sha512-TYzoQoONeIsdKuv550V/MisRm4/5Od1qS5pGDRFd4eOmtiZDH2iJyRpN9cP05tJYf/g9Nu1bFr9smE2NKtnapA==') throw new Error('Lockfile must pin the verified chordino.js npm release');
const pkg = JSON.parse(readFileSync(join(root, 'node_modules/chordino.js/package.json'), 'utf8'));
if (pkg.version !== '0.6.0') throw new Error('Installed chordino.js must be exactly 0.6.0');
const upstreamEntries = exec('tar', ['-tf', join(licenseDir, upstreamName)]);
for (const required of ['src/build.sh', 'src/chordextract.c', 'src/js/chord-live-worker.ts', 'src/nnls-chroma/COPYING', 'src/kissfft/LICENSES/BSD-3-Clause', 'src/vamp-sdk-COPYING', 'BUILD.md', 'package-lock.json']) {
  if (!upstreamEntries.includes('/' + required + '\n') && !upstreamEntries.includes('/' + required + '\r\n')) throw new Error('Incomplete upstream source: ' + required);
}
const files = inputs();
const sourceHashes = hashes(files);
const buildHashes = hashes(buildFiles(out), out);
if (verify) {
  const recorded = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (JSON.stringify(recorded.sources) !== JSON.stringify(sourceHashes)) throw new Error('Source changed after source package generation; rebuild then regenerate');
  if (JSON.stringify(recorded.buildFiles) !== JSON.stringify(buildHashes)) throw new Error('Built app changed after source package generation');
  if (sha(readFileSync(sourceArchive)) !== recorded.archiveSha256) throw new Error('Source ZIP hash mismatch');
  for (const name of [archiveName, 'source-manifest.json', 'index.html', 'GPL-2.0.txt', 'GPL-3.0.txt', 'THIRD_PARTY_NOTICES.txt', upstreamName]) {
    if (sha(readFileSync(join(licenseDir, name))) !== sha(readFileSync(join(out, 'licenses', name)))) throw new Error('Published license file differs: ' + name);
  }
  console.log('Verified current app sources, upstream SHA-256, source archive, and built files.');
  process.exit(0);
}
const stage = mkdtempSync(join(tmpdir(), 'dinga-source-'));
try {
  for (const name of files) {
    const target = join(stage, name);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, name), target);
  }
  writeFileSync(join(stage, 'SOURCE_BUILD.md'), '# Dinga corresponding source\n\nApp: npm ci && npm run build (Node 20.19+ or 22.12+).\nThe source app modules, asset inputs, package-lock and build configuration are included.\nThe app integrates unmodified chordino.js 0.6.0; npm ci retrieves the pinned published binaries.\nFor the preferred upstream C/TypeScript sources and build instructions, extract public/licenses/' + upstreamName + '.\nUpstream BUILD.md and src/build.sh describe rebuilding its binaries with Emscripten 6.0.3, npm ci, npm run build.\nExisting artwork/model files and third-party components retain their respective rights and notices; no blanket artwork relicensing is asserted.\nDo not infer real-instrument recognition accuracy from the software license or this source archive.\n');
  // Native bsdtar on Windows supports ZIP through -a. Unix uses the standard zip utility.
  const zipPath = join(stage, 'source.zip');
  if (process.platform === 'win32') exec('tar', ['-a', '-cf', zipPath, '-C', stage, ...readdirSync(stage)]);
  else exec('zip', ['-q', '-r', zipPath, ...readdirSync(stage)], stage);
  cpSync(zipPath, sourceArchive);
  const manifest = {
    format: 1, generatedAt: new Date().toISOString(),
    sourceUrl: '/licenses/' + archiveName,
    archiveSha256: sha(readFileSync(sourceArchive)),
    upstream: { package: 'chordino.js', version: '0.6.0', commit: 'ea8e2110fa2197a662588ef1f2db2550d93cc90d', url: 'https://codeload.github.com/recifra/chordino.js/zip/ea8e2110fa2197a662588ef1f2db2550d93cc90d', sha256: upstreamSha, npmIntegrity: 'sha512-TYzoQoONeIsdKuv550V/MisRm4/5Od1qS5pGDRFd4eOmtiZDH2iJyRpN9cP05tJYf/g9Nu1bFr9smE2NKtnapA==' },
    node: process.version, sources: sourceHashes, buildFiles: buildHashes
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  mkdirSync(join(out, 'licenses'), { recursive: true });
  for (const name of readdirSync(licenseDir)) cpSync(join(licenseDir, name), join(out, 'licenses', name));
  console.log('Prepared /licenses/' + archiveName + ' (' + files.length + ' source inputs); run this script with --verify before deploying.');
} finally {
  if (realpathSync(stage).startsWith(realpathSync(tmpdir()))) rmSync(stage, { recursive: true, force: true });
}
