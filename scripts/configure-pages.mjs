import { readFile, writeFile } from 'node:fs/promises';
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--repo' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_.-]+$/.test(args[1]) || /\/(?:\.|\.\.)$/.test(args[1])) {
  console.error('Usage: node scripts/configure-pages.mjs --repo owner/repo'); process.exit(1);
}
const [owner, repo] = args[1].split('/');
const url = `https://${owner.toLowerCase()}.github.io/${repo.toLowerCase() === owner.toLowerCase() + '.github.io' ? '' : repo + '/'}`;
const file = new URL('../README.md', import.meta.url);
const source = await readFile(file, 'utf8');
const block = /<!-- preview-link:start -->[\s\S]*?<!-- preview-link:end -->/;
if (!block.test(source)) throw new Error('README preview-link block missing');
await writeFile(file, source.replace(block, `<!-- preview-link:start -->\n**[点击预览](${url})** · Pages 需要按发布指南启用；设置链接不代表已上线。\n<!-- preview-link:end -->`));
console.log(`Configured preview link: ${url}`);
