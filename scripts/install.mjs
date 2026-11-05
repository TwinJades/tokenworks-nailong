import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = ['nailong-zhengyici', 'nailong-erich207', 'nailong-mosterpath'];
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
function parse(argv) {
  const action = argv.shift();
  if (!['install', 'uninstall', 'status'].includes(action)) fail('用法: install|uninstall|status --components <桌宠ID,...> [--root 路径] [--dry-run]');
  const opts = { action, dryRun: false };
  while (argv.length) {
    const key = argv.shift();
    if (key === '--dry-run') { if (opts.dryRun) fail('重复的 --dry-run'); opts.dryRun = true; continue; }
    if (!['--components', '--root'].includes(key) || opts[key.slice(2)] !== undefined || !argv.length || argv[0].startsWith('--')) fail(`无效参数: ${key}`);
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
  realDirectory(path.join(runtime, 'node_modules', '@eduwork', 'dsh-desktop-pet', 'skins'));
  return { runtime };
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
function requireSafeParents(p, boundary) {
  let cur = path.dirname(p);
  while (cur.startsWith(boundary + path.sep) || cur === boundary) {
    if (exists(cur) && fs.lstatSync(cur).isSymbolicLink()) fail(`父目录不能是链接: ${cur}`);
    if (cur === boundary) break;
    cur = path.dirname(cur);
  }
}


async function run(opts) {
  const root = path.resolve(opts.root || path.join(process.env.LOCALAPPDATA || '', 'Programs', 'TokenWorks'));
  const { runtime } = validateRoot(root);
  const canonicalRoot = fs.realpathSync(root);
  const statePath = path.join(runtime, '.nailong-installer.json');
  const state = readState(statePath, canonicalRoot);
  const stateBefore = exists(statePath) ? fs.readFileSync(statePath) : null;
  const petRoot = path.join(runtime, 'node_modules', '@eduwork', 'dsh-desktop-pet', 'skins');
  const operations = [];
  const next = structuredClone(state);
  const records = next.components;
  for (const id of opts.ids) {
    const record = state.components[id];
    const dest = path.join(petRoot, id);
    requireSafeParents(dest, runtime);
    if (opts.action === 'status') {
      if (!record) {
        console.log(`${id}: 未由本工具管理${exists(dest) ? '（存在同名文件）' : ''}`); continue;
      }
      try {
        ensureOwnedDir(dest, record);
        console.log(`${id}: 已安装`);
      } catch (e) { console.log(`${id}: 异常（${e.message}）`); process.exitCode = 1; }
      continue;
    }
    let previous = null;
    if (record) previous = ensureOwnedDir(dest, record);
    else if (exists(dest)) fail(`陌生同名目录，未写入: ${dest}`);
    if (opts.action === 'install') {
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
  if (!same(state, next)) operations.push({ kind: 'file', dest: statePath, previous: stateBefore, data: bytes(next) });
  if (!operations.length) { console.log('无需更改。'); return; }
  for (const op of operations) console.log(`${opts.dryRun ? '[预演] ' : ''}${op.kind}: ${op.dest}`);
  if (opts.dryRun) return;
  // Rollback restores only this operation's snapshots; deletions use the recycle bin.
  const undo = [];
  try {
    for (const op of operations) {
      if (op.kind === 'dir') {
        if (op.previous) { recycle(op.dest); undo.push(() => copySnapshot(op.dest, op.previous)); }
        if (op.files) { undo.push(() => recycle(op.dest)); copySnapshot(op.dest, op.files); }
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
    console.log('奶龙桌宠安装工具\n请先完全退出 TokenWorks，包括托盘。\n1. 安装\n2. 卸载\n3. 查看状态');
    const choice = (await rl.question('选择操作（空输入取消）: ')).trim();
    if (!choice) return;
    const action = { '1': 'install', '2': 'uninstall', '3': 'status' }[choice];
    if (!action) fail('无效操作');
    if (action === 'status') { await run({ action, ids, dryRun: false }); return; }
    const choices = ids;
    choices.forEach((id, i) => console.log(`${i + 1}. ${id}`));
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
