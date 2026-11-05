import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
    assert.notEqual(r.status, 0); assert.match(r.stderr, /组件 ID/);
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
  r = call(f, 'install', 'unknown'); assert.notEqual(r.status, 0);
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


test('managed directories reject unrecorded empty directories before uninstall', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(); t.after(() => clean(f.base));
  let r = call(f, 'install', pet); assert.equal(r.status, 0, r.stderr);
  const dest = path.join(f.skins, pet);
  fs.mkdirSync(path.join(dest, 'user-empty-directory'));
  r = call(f, 'uninstall', pet);
  assert.notEqual(r.status, 0);
  assert.ok(fs.existsSync(path.join(dest, 'user-empty-directory')));
});

test('failed multi-component install rolls back skin files and installation record', { skip: process.platform !== 'win32' }, t => {
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

