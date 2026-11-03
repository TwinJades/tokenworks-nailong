import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = ['brand', 'nailong-zhengyici', 'nailong-erich207', 'nailong-mosterpath'];
const brandName = '@nailong/tokenworks-brand';
const brandEntry = { id: 'nailong-brand', name: brandName, config: {} };
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const exists = p => { try { fs.lstatSync(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const bytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = message => { throw new Error(message); };

// Never traverse links inside owned directories, including when checking ownership.
function snapshot(dir) {
  const result = {};
  function walk(base, rel = '') {
    const entries = fs.readdirSync(base, { withFileTypes: true });
    if (rel && !entries.length) fail(`不允许未记录的空目录: ${base}`);
    for (const ent of entries) {
      const key = rel ? `${rel}/${ent.name}` : ent.name;
      const full = path.join(base, ent.name);
      if (ent.isSymbolicLink()) fail(`不允许目录内存在链接: ${full}`);
      if (ent.isDirectory()) walk(full, key);
      else if (ent.isFile()) result[key] = fs.readFileSync(full);
      else fail(`不支持的文件类型: ${full}`);
    }
  }
  walk(dir);
  return result;
}
function hashes(files) { return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, hash(v)])); }
function copySnapshot(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    const dest = path.join(dir, ...name.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data, { flag: 'wx' });
  }
}
function recycle(p) {
  if (!exists(p)) return;
  if (process.platform !== 'win32') fail(`回收站删除仅支持 Windows: ${p}`);
  // Arguments are passed through environment variables, never interpolated into PowerShell.
  const script = "$ErrorActionPreference='Stop'; $p=$env:NAILONG_RECYCLE_PATH; $item=Get-Item -LiteralPath $p -Force; if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { $shell=New-Object -ComObject Shell.Application; $parent=$shell.NameSpace([IO.Path]::GetDirectoryName($p)); $entry=$parent.ParseName([IO.Path]::GetFileName($p)); if ($null -eq $entry) { throw 'Cannot locate junction in Shell' }; $shell.NameSpace(10).MoveHere($entry, 20) } else { Add-Type -AssemblyName Microsoft.VisualBasic; if ($item.Attributes -band [IO.FileAttributes]::Directory) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p,'OnlyErrorDialogs','SendToRecycleBin') } else { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p,'OnlyErrorDialogs','SendToRecycleBin') } }";
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', env: { ...process.env, NAILONG_RECYCLE_PATH: p } });
  if (r.status !== 0 || exists(p)) fail(`回收站操作失败，已保留 ${p}: ${r.stderr || r.error?.message || ''}`);
}
function assertDirectory(p) {
  if (!exists(p) || !fs.statSync(p).isDirectory()) fail(`目录不存在: ${p}`);
}
function realDirectory(p) {
  assertDirectory(p);
  if (fs.lstatSync(p).isSymbolicLink()) fail(`不能使用链接目录: ${p}`);
}
function loadProfile(p) {
  realDirectory(p);
  const info = json(path.join(p, 'package.json'));
  if (info.name !== 'eduwork-desktop-profile' || !info.dsh?.profile) fail(`不是 TokenWorks 桌面 profile: ${p}`);
  return fs.realpathSync(p);
}
async function chooseProfile(explicit) {
  if (explicit) return loadProfile(path.resolve(explicit));
  const base = path.join(process.env.LOCALAPPDATA || '', 'tokenworks-electron', 'dsh', 'profiles');
  const candidates = exists(base) ? fs.readdirSync(base).map(x => path.join(base, x)).filter(p => { try { loadProfile(p); return true; } catch { return false; } }) : [];
  if (candidates.length === 1) return loadProfile(candidates[0]);
  if (!candidates.length) fail('未发现桌面 profile；请使用 --profile 指定。');
  if (!process.stdin.isTTY) fail('发现多个桌面 profile；请使用 --profile 指定。');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('选择一个桌面 profile（空输入取消）：');
    candidates.forEach((p, i) => console.log(`${i + 1}. ${p}`));
    const answer = (await rl.question('编号: ')).trim();
    if (!answer) return null;
    const n = Number(answer);
    if (!Number.isInteger(n) || n < 1 || n > candidates.length) fail('无效 profile 编号');
    return loadProfile(candidates[n - 1]);
  } finally { rl.close(); }
}
function parse(argv) {
  const action = argv.shift();
  if (!['install', 'uninstall', 'status'].includes(action)) fail('用法: install|uninstall|status --components <组件ID,...> [--root 路径] [--profile 路径] [--dry-run]');
  const opts = { action, dryRun: false };
  while (argv.length) {
    const key = argv.shift();
    if (key === '--dry-run') { if (opts.dryRun) fail('重复的 --dry-run'); opts.dryRun = true; continue; }
    if (!['--components', '--root', '--profile'].includes(key) || opts[key.slice(2)] !== undefined || !argv.length || argv[0].startsWith('--')) fail(`无效参数: ${key}`);
    opts[key.slice(2)] = argv.shift();
  }
  if (action !== 'status' && opts.components === undefined) fail('必须明确指定 --components；空选择不会安装任何组件。');
  opts.ids = opts.components === undefined ? ids : opts.components.split(',');
  if (opts.ids.some(x => !ids.includes(x)) || new Set(opts.ids).size !== opts.ids.length) fail('未知、空或重复组件 ID');
  return opts;
}
function validateRoot(root) {
  realDirectory(root);
  const product = path.join(root, 'resources', 'product');
  const runtime = path.join(product, 'd');
  realDirectory(runtime);
  if (json(path.join(runtime, 'package.json')).name !== 'eduwork-product-runtime') fail('无效 TokenWorks 安装根目录');
  const composition = json(path.join(product, 'composition.json'));
  if (!Array.isArray(composition) || !composition.some(x => Array.isArray(x.insert))) fail('无法识别 composition.json');
  realDirectory(path.join(runtime, 'node_modules', '@eduwork', 'dsh-desktop-pet', 'skins'));
  return { product, runtime };
}
function brandMatches(composition) {
  return composition.flatMap(group => Array.isArray(group.insert) ? group.insert.filter(entry => entry.id === brandEntry.id || entry.name === brandName) : []);
}
function readState(p, root) {
  if (!exists(p)) return { version: 1, root, components: {} };
  if (!fs.lstatSync(p).isFile()) fail(`安装记录不是普通文件: ${p}`);
  const state = json(p);
  if (state.version !== 1 || state.root !== root || !state.components || typeof state.components !== 'object') fail('安装记录无效或不属于此安装根目录');
  return state;
}
function ensureOwnedDir(dest, record) {
  if (!exists(dest)) fail(`已管理目录丢失: ${dest}`);
  if (!fs.lstatSync(dest).isDirectory() || fs.lstatSync(dest).isSymbolicLink()) fail(`已管理目录类型改变: ${dest}`);
  const files = snapshot(dest);
  if (!same(hashes(files), record.files)) fail(`已管理目录被修改，拒绝覆盖或卸载: ${dest}`);
  return files;
}
function checkLink(link, target) {
  if (!exists(link) || !fs.lstatSync(link).isSymbolicLink()) fail(`已管理联接丢失或类型改变: ${link}`);
  const actual = path.resolve(path.dirname(link), fs.readlinkSync(link));
  if (actual.toLowerCase() !== target.toLowerCase()) fail(`联接目标已改变: ${link}`);
}
function requireSafeParents(p, boundary) {
  let cur = path.dirname(p);
  while (cur.startsWith(boundary + path.sep) || cur === boundary) {
    if (exists(cur) && fs.lstatSync(cur).isSymbolicLink()) fail(`父目录不能是链接: ${cur}`);
    if (cur === boundary) break;
    cur = path.dirname(cur);
  }
}

async function run(opts) {
  if (opts.action === 'install' && opts.ids.includes('brand')) fail('品牌不再由此工具安装；请在 TokenWorks 插件页添加本项目的 GitHub 仓库地址或本地项目路径。');
  const root = path.resolve(opts.root || path.join(process.env.LOCALAPPDATA || '', 'Programs', 'TokenWorks'));
  const { product, runtime } = validateRoot(root);
  const canonicalRoot = fs.realpathSync(root);
  const statePath = path.join(runtime, '.nailong-installer.json');
  const state = readState(statePath, canonicalRoot);
  const stateBefore = exists(statePath) ? fs.readFileSync(statePath) : null;
  const packagePath = path.join(runtime, 'package.json');
  const compositionPath = path.join(product, 'composition.json');
  const pkg = json(packagePath), composition = json(compositionPath);
  if (!pkg.dependencies || typeof pkg.dependencies !== 'object') fail('产品依赖格式无效');
  const petRoot = path.join(runtime, 'node_modules', '@eduwork', 'dsh-desktop-pet', 'skins');
  const brandDest = path.join(runtime, 'node_modules', '@nailong', 'tokenworks-brand');
  let profile = null;
  if (opts.ids.includes('brand') && opts.action !== 'status') {
    profile = await chooseProfile(opts.profile);
    if (!profile) { console.log('已取消，未写入。'); return; }
  } else if (opts.profile) profile = loadProfile(path.resolve(opts.profile));
  const operations = [];
  const next = structuredClone(state);
  const records = next.components;
  let pkgDirty = false, compositionDirty = false;
  for (const id of opts.ids) {
    const record = state.components[id];
    const dest = id === 'brand' ? brandDest : path.join(petRoot, id);
    requireSafeParents(dest, runtime);
    if (opts.action === 'status') {
      if (!record) { console.log(`${id}: 未由本工具管理${exists(dest) ? '（存在同名文件）' : ''}`); continue; }
      try {
        ensureOwnedDir(dest, record);
        if (id === 'brand') {
          checkLink(path.join(record.profile, 'node_modules', '@nailong', 'tokenworks-brand'), dest);
          if (pkg.dependencies[brandName] !== record.dependency || !same(brandMatches(composition), [brandEntry])) fail('品牌配置已改变');
        }
        console.log(`${id}: 已安装`);
      } catch (e) { console.log(`${id}: 异常（${e.message}）`); process.exitCode = 1; }
      continue;
    }
    let previous = null;
    if (record) previous = ensureOwnedDir(dest, record);
    else if (exists(dest)) fail(`陌生同名目录，未写入: ${dest}`);
    if (id === 'brand') {
      const link = path.join(profile, 'node_modules', '@nailong', 'tokenworks-brand');
      requireSafeParents(link, profile);
      const matches = brandMatches(composition);
      if (record) {
        if (record.profile !== profile) fail('品牌已由其他 profile 管理；请指定原 profile');
        checkLink(link, dest);
        if (pkg.dependencies[brandName] !== record.dependency || !same(matches, [brandEntry])) fail('品牌配置已被修改，拒绝操作');
      } else if (exists(link) || Object.hasOwn(pkg.dependencies, brandName) || matches.length) fail('存在陌生品牌联接、依赖或 composition 条目，未写入');
      if (record) {
        operations.push({ kind: 'removeLink', dest: link, target: dest });
        operations.push({ kind: 'dir', dest, previous, files: null });
        delete pkg.dependencies[brandName]; pkgDirty = true;
        for (const group of composition) if (Array.isArray(group.insert)) group.insert = group.insert.filter(x => x.id !== brandEntry.id && x.name !== brandName);
        compositionDirty = true; delete records[id];
      }
    } else if (opts.action === 'install') {
      const source = path.join(project, 'skins', id);
      realDirectory(source);
      const files = snapshot(source);
      if (!files['skin.json'] || JSON.parse(files['skin.json']).id !== id) fail(`皮肤清单无效: ${source}`);
      if (record && same(hashes(files), record.files)) continue;
      operations.push({ kind: 'dir', dest, previous, files });
      records[id] = { files: hashes(files) };
    } else if (record) {
      operations.push({ kind: 'dir', dest, previous, files: null }); delete records[id];
    }
  }
  if (opts.action === 'status') return;
  if (pkgDirty) operations.push({ kind: 'file', dest: packagePath, previous: fs.readFileSync(packagePath), data: bytes(pkg) });
  if (compositionDirty) operations.push({ kind: 'file', dest: compositionPath, previous: fs.readFileSync(compositionPath), data: bytes(composition) });
  if (!same(state, next)) operations.push({ kind: 'file', dest: statePath, previous: stateBefore, data: bytes(next) });
  if (!operations.length) { console.log('无需更改。'); return; }
  for (const op of operations) console.log(`${opts.dryRun ? '[预演] ' : ''}${op.kind}: ${op.dest}`);
  if (opts.dryRun) return;
  // Every destructive removal goes through the recycle bin. Rollback restores only
  // snapshots taken during preflight and never removes a link's target.
  const undo = [];
  try {
    for (const op of operations) {
      if (op.kind === 'dir') {
        if (op.previous) { recycle(op.dest); undo.push(() => copySnapshot(op.dest, op.previous)); }
        if (op.files) { undo.push(() => recycle(op.dest)); copySnapshot(op.dest, op.files); }
      } else if (op.kind === 'removeLink') {
        recycle(op.dest); undo.push(() => fs.symlinkSync(op.target, op.dest, 'junction'));
      } else {
        // Existing files are updated in place; their exact contents are retained for rollback.
        undo.push(() => { if (op.previous === null) recycle(op.dest); else fs.writeFileSync(op.dest, op.previous); });
        fs.writeFileSync(op.dest, op.data);
      }
    }
  } catch (error) {
    const failures = [];
    for (const rollback of undo.reverse()) try { rollback(); } catch (e) { failures.push(e.message); }
    fail(`操作失败: ${error.message}${failures.length ? `；回滚不完整: ${failures.join('; ')}` : '；已回滚本次操作'}`);
  }
  console.log('操作完成。请完全退出 TokenWorks（包括托盘）后重新启动以刷新图库。');
}
async function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('奶龙工坊安装工具\n请先完全退出 TokenWorks，包括托盘。\n1. 安装\n2. 卸载\n3. 查看状态');
    const choice = (await rl.question('选择操作（空输入取消）: ')).trim();
    if (!choice) return;
    const action = { '1': 'install', '2': 'uninstall', '3': 'status' }[choice];
    if (!action) fail('无效操作');
    if (action === 'status') { await run({ action, ids, dryRun: false }); return; }
    const choices = action === 'install' ? ids.filter(id => id !== 'brand') : ids;
    if (action === 'install') console.log('品牌请在 TokenWorks 插件页添加项目 GitHub 仓库地址或本地项目路径。');
    choices.forEach((id, i) => console.log(`${i + 1}. ${id}${id === 'brand' ? '（旧版安装清理）' : ''}`));
    const selection = (await rl.question('输入组件编号，逗号分隔（空输入取消，不默认全选）: ')).trim();
    if (!selection) return;
    const selected = selection.split(/[,，\s]+/).map(x => choices[Number(x) - 1]);
    if (selected.some(x => !x) || new Set(selected).size !== selected.length) fail('无效或重复组件编号');
    await run({ action, ids: selected, dryRun: false });
  } finally { rl.close(); }
}
try {
  if (process.argv.length === 2) await interactive();
  else await run(parse(process.argv.slice(2)));
} catch (e) { console.error(`错误: ${e.message}`); process.exitCode = 1; }
