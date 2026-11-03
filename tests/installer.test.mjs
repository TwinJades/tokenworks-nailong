import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installer = path.join(project, 'scripts', 'install.mjs');
const pet = 'nailong-erich207';
const write = (p, value) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nailong-installer-'));
  const root = path.join(base, 'TokenWorks');
  const profile = path.join(base, 'profile');
  const product = path.join(root, 'resources', 'product');
  const runtime = path.join(product, 'd');
  const skins = path.join(runtime, 'node_modules', '@eduwork', 'dsh-desktop-pet', 'skins');
  fs.mkdirSync(skins, { recursive: true });
  write(path.join(skins, 'existing', 'skin.json'), { id: 'existing' });
  write(path.join(runtime, 'package.json'), { name: 'eduwork-product-runtime', dependencies: { existing: '1' } });
  write(path.join(product, 'composition.json'), [{ insert: [{ id: 'existing', name: 'existing' }] }]);
  write(path.join(profile, 'package.json'), { name: 'eduwork-desktop-profile', dsh: { profile: {} } });
  return { base, root, profile, runtime, product, skins };
}
function call(f, action, components, extra = []) {
  return spawnSync(process.execPath, [installer, action, '--components', components, '--root', f.root, ...extra], { encoding: 'utf8' });
}
function legacyBrand(f) {
  const brand = path.join(f.runtime, 'node_modules', '@nailong', 'tokenworks-brand');
  const link = path.join(f.profile, 'node_modules', '@nailong', 'tokenworks-brand');
  const data = Buffer.from('{"name":"@nailong/tokenworks-brand","version":"1.0.0"}');
  fs.mkdirSync(brand, { recursive: true });
  fs.writeFileSync(path.join(brand, 'package.json'), data);
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(brand, link, 'junction');
  const pkgPath = path.join(f.runtime, 'package.json');
  const pkg = read(pkgPath); pkg.dependencies['@nailong/tokenworks-brand'] = '1.0.0'; write(pkgPath, pkg);
  const compPath = path.join(f.product, 'composition.json');
  const comp = read(compPath); comp[0].insert.unshift({ id: 'nailong-brand', name: '@nailong/tokenworks-brand', config: {} }); write(compPath, comp);
  write(path.join(f.runtime, '.nailong-installer.json'), { version: 1, root: fs.realpathSync(f.root), components: { brand: { files: { 'package.json': crypto.createHash('sha256').update(data).digest('hex') }, dependency: '1.0.0', profile: fs.realpathSync(f.profile) } } });
  return { brand, link };
}
function clean(base) {
  const script = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($env:NAILONG_TEST_DIR,'OnlyErrorDialogs','SendToRecycleBin')";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, NAILONG_TEST_DIR: base }, encoding: 'utf8' });
  assert.equal(result.status, 0, `fixture retained at ${base}: ${result.stderr}`);
}

test('isolated installation, ownership, conflicts and precise uninstall', { skip: process.platform !== 'win32' }, t => {
  const f = fixture();
  t.after(() => clean(f.base));
  const pkg = path.join(f.runtime, 'package.json');
  const comp = path.join(f.product, 'composition.json');
  const state = path.join(f.runtime, '.nailong-installer.json');
  const dest = path.join(f.skins, pet);
  const initialPkg = fs.readFileSync(pkg, 'utf8');
  const initialComp = fs.readFileSync(comp, 'utf8');
  let r = call(f, 'install', pet, ['--dry-run']);
  assert.equal(r.status, 0, r.stderr); assert.equal(fs.existsSync(state), false);
  r = call(f, 'install', pet); assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(pkg, 'utf8'), initialPkg); assert.equal(fs.readFileSync(comp, 'utf8'), initialComp);
  assert.ok(fs.existsSync(dest));
  r = call(f, 'install', pet); assert.equal(r.status, 0, r.stderr);
  r = call(f, 'status', pet); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /已安装/);
  const skinFile = path.join(dest, 'skin.json'); const original = fs.readFileSync(skinFile);
  fs.appendFileSync(skinFile, ' ');
  r = call(f, 'uninstall', pet); assert.notEqual(r.status, 0);
  assert.ok(fs.existsSync(dest));
  fs.writeFileSync(skinFile, original);
  r = call(f, 'uninstall', pet); assert.equal(r.status, 0, r.stderr); assert.equal(fs.existsSync(dest), false);
  assert.ok(fs.existsSync(path.join(f.skins, 'existing')));
  assert.equal(read(pkg).dependencies.existing, '1');
});

test('brand install alone or with pets is rejected before writes, including dry run', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(); t.after(() => clean(f.base));
  const pkg = path.join(f.runtime, 'package.json');
  const comp = path.join(f.product, 'composition.json');
  const before = [pkg, comp].map(p => fs.readFileSync(p));
  for (const components of ['brand', `${pet},brand`]) for (const extra of [[], ['--dry-run']]) {
    const r = call(f, 'install', components, extra);
    assert.notEqual(r.status, 0); assert.match(r.stderr, /插件页.*GitHub.*本地/);
    assert.equal(fs.existsSync(path.join(f.runtime, '.nailong-installer.json')), false);
    assert.equal(fs.existsSync(path.join(f.skins, pet)), false);
    assert.equal(fs.existsSync(path.join(f.runtime, 'node_modules', '@nailong')), false);
    [pkg, comp].forEach((p, i) => assert.deepEqual(fs.readFileSync(p), before[i]));
  }
});

test('foreign component and invalid ids fail before any writes', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(); t.after(() => clean(f.base));
  const foreign = path.join(f.skins, pet, 'skin.json'); write(foreign, { id: 'foreign' });
  const before = fs.readFileSync(path.join(f.runtime, 'package.json'), 'utf8');
  let r = call(f, 'install', pet);
  assert.notEqual(r.status, 0); assert.equal(fs.readFileSync(path.join(f.runtime, 'package.json'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(f.runtime, '.nailong-installer.json')), false);
  assert.equal(read(foreign).id, 'foreign');
  r = call(f, 'install', 'brand,unknown', ['--profile', f.profile]); assert.notEqual(r.status, 0);
  assert.equal(fs.existsSync(path.join(f.runtime, 'node_modules', '@nailong', 'tokenworks-brand')), false);
});

test('status reports a modified managed component as failure', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(); t.after(() => clean(f.base));
  let r = call(f, 'install', pet); assert.equal(r.status, 0, r.stderr);
  fs.appendFileSync(path.join(f.skins, pet, 'skin.json'), ' ');
  r = call(f, 'status', pet);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /异常/);
});

test('legacy brand cleanup checks hashes and preserves unrelated configuration', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(); t.after(() => clean(f.base));
  const { brand, link } = legacyBrand(f);
  const comp = path.join(f.product, 'composition.json');
  const config = read(comp); config.push({ insert: [{ id: 'user-plugin', name: 'user-plugin' }] }); write(comp, config);
  const file = path.join(brand, 'package.json');
  const original = fs.readFileSync(file); fs.appendFileSync(file, ' ');
  let r = call(f, 'uninstall', 'brand', ['--profile', f.profile]);
  assert.notEqual(r.status, 0); assert.ok(fs.existsSync(link)); assert.ok(fs.existsSync(brand));
  fs.writeFileSync(file, original);
  r = call(f, 'uninstall', 'brand', ['--profile', f.profile]); assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(link), false); assert.equal(fs.existsSync(brand), false);
  assert.ok(read(comp).some(x => x.insert?.some(y => y.id === 'user-plugin')));
  assert.equal(read(path.join(f.runtime, 'package.json')).dependencies.existing, '1');
});

test('failed uninstall restores junction and preserves its target and unrelated configuration', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(); t.after(() => clean(f.base));
  const opts = ['--profile', f.profile];
  const { brand, link } = legacyBrand(f);
  let r = call(f, 'status', 'brand'); assert.equal(r.status, 0, r.stderr);
  const pkg = path.join(f.runtime, 'package.json');
  const comp = path.join(f.product, 'composition.json');
  const state = path.join(f.runtime, '.nailong-installer.json');
  const config = read(comp); config.push({ insert: [{ id: 'user-plugin', name: 'user-plugin', config: { keep: true } }] }); write(comp, config);
  const before = [pkg, comp, state].map(p => fs.readFileSync(p));
  const brandPackage = fs.readFileSync(path.join(brand, 'package.json'));
  const hook = path.join(f.base, 'fail-recycle.cjs');
  write(hook, `const cp = require('node:child_process'); const { syncBuiltinESMExports } = require('node:module'); const spawn = cp.spawnSync; cp.spawnSync = function(command, args, options) { if (options?.env?.NAILONG_RECYCLE_PATH === process.env.TEST_FAIL_PATH) { if (!require('node:fs').existsSync(process.env.TEST_TARGET_FILE)) throw new Error('junction recycle removed its target'); throw new Error('injected recycle failure'); } return spawn.apply(this, arguments); }; syncBuiltinESMExports();`);
  r = spawnSync(process.execPath, ['--require', hook, installer, 'uninstall', '--components', 'brand', '--root', f.root, ...opts], { encoding: 'utf8', env: { ...process.env, TEST_FAIL_PATH: brand, TEST_TARGET_FILE: path.join(brand, 'package.json') } });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /injected recycle failure/); assert.match(r.stderr, /已回滚本次操作/);
  assert.equal(fs.realpathSync(link).toLowerCase(), fs.realpathSync(brand).toLowerCase());
  assert.deepEqual(fs.readFileSync(path.join(brand, 'package.json')), brandPackage);
  [pkg, comp, state].forEach((p, i) => assert.deepEqual(fs.readFileSync(p), before[i]));
});

test('managed directories reject unrecorded empty directories before uninstall', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(); t.after(() => clean(f.base));
  let r = call(f, 'install', pet); assert.equal(r.status, 0, r.stderr);
  const dest = path.join(f.skins, pet);
  fs.mkdirSync(path.join(dest, 'user-empty-directory'));
  r = call(f, 'uninstall', pet);
  assert.notEqual(r.status, 0);
  assert.ok(fs.existsSync(path.join(dest, 'user-empty-directory')));
});

test('failed multi-component install rolls back files links and configuration', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(); t.after(() => clean(f.base));
  const pkg = path.join(f.runtime, 'package.json');
  const comp = path.join(f.product, 'composition.json');
  const state = path.join(f.runtime, '.nailong-installer.json');
  const before = [pkg, comp].map(p => fs.readFileSync(p));
  const hook = path.join(f.base, 'fail-write.cjs');
  write(hook, `const fs = require('node:fs'); const { syncBuiltinESMExports } = require('node:module'); const write = fs.writeFileSync; let failed = false; fs.writeFileSync = function(p, ...args) { if (!failed && p === process.env.TEST_FAIL_PATH) { failed = true; throw new Error('injected state write failure'); } return write.call(this, p, ...args); }; syncBuiltinESMExports();`);
  const r = spawnSync(process.execPath, ['--require', hook, installer, 'install', '--components', `${pet},nailong-mosterpath`, '--root', f.root], { encoding: 'utf8', env: { ...process.env, TEST_FAIL_PATH: state } });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /injected state write failure/); assert.match(r.stderr, /已回滚本次操作/);
  assert.equal(fs.existsSync(state), false);
  assert.equal(fs.existsSync(path.join(f.runtime, 'node_modules', '@nailong', 'tokenworks-brand')), false);
  assert.equal(fs.existsSync(path.join(f.profile, 'node_modules', '@nailong', 'tokenworks-brand')), false);
  assert.equal(fs.existsSync(path.join(f.skins, pet)), false);
  assert.ok(fs.existsSync(path.join(f.skins, 'existing', 'skin.json')));
  [pkg, comp].forEach((p, i) => assert.deepEqual(fs.readFileSync(p), before[i]));
});

test('multi-component preflight leaves managed and foreign components untouched', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(); t.after(() => clean(f.base));
  let r = call(f, 'install', pet); assert.equal(r.status, 0, r.stderr);
  const foreign = path.join(f.skins, 'nailong-mosterpath', 'skin.json'); write(foreign, { id: 'foreign', keep: true });
  const state = path.join(f.runtime, '.nailong-installer.json');
  const before = fs.readFileSync(state);
  r = call(f, 'install', `${pet},nailong-mosterpath`);
  assert.notEqual(r.status, 0);
  assert.deepEqual(fs.readFileSync(state), before);
  assert.equal(read(foreign).keep, true);
  assert.ok(fs.existsSync(path.join(f.skins, pet, 'skin.json')));
  assert.equal(fs.existsSync(path.join(f.runtime, 'node_modules', '@nailong', 'tokenworks-brand')), false);
  assert.equal(fs.existsSync(path.join(f.profile, 'node_modules', '@nailong', 'tokenworks-brand')), false);
});

test('explicit three-pet install and selective uninstall preserve remaining components', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(); t.after(() => clean(f.base));
  const components = ['nailong-zhengyici', 'nailong-erich207', 'nailong-mosterpath'];
  let r = call(f, 'install', components.join(',')); assert.equal(r.status, 0, r.stderr);
  for (const id of components) assert.equal(read(path.join(f.skins, id, 'skin.json')).id, id);
  r = call(f, 'uninstall', 'nailong-zhengyici'); assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(path.join(f.skins, 'nailong-zhengyici')), false);
  r = call(f, 'status', 'nailong-erich207,nailong-mosterpath'); assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(f.skins, 'existing', 'skin.json')));
  r = call(f, 'uninstall', 'nailong-erich207,nailong-mosterpath'); assert.equal(r.status, 0, r.stderr);
});
