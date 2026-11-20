#!/usr/bin/env node
// 检查同一份资料是否被两个专家同时登记（一条资料只能有一个主归属）。
// 用法: node scripts/check-ownership.mjs [专家库根目录]
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const root = process.argv[2] ?? process.env.DSH_EXPERT_ROOT ?? join(homedir(), 'AIExperts');

const seen = new Map();
const problems = [];
let dirs = [];
try {
  dirs = await readdir(root, { withFileTypes: true });
} catch (error) {
  console.error(`读不到专家库：${root}（${error.code ?? error.message}）`);
  process.exit(2);
}

let experts = 0;
let files = 0;
for (const entry of dirs) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
  const dir = join(root, entry.name);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  } catch {
    continue;
  }
  experts += 1;
  for (const topic of manifest.topics ?? []) {
    for (const file of topic.files ?? []) {
      files += 1;
      const key = String(file).replace(/\//g, '\\').toLowerCase();
      const owner = `${entry.name}/${topic.id}`;
      const prev = seen.get(key);
      if (!prev) {
        seen.set(key, owner);
        continue;
      }
      // 同一个专家内被两个主题同时引用（比如结论文件既在「结论速查」又挂在自己的主题下）不算问题；
      // 那是同一份资料的两种入口，真正的红线是同一条资料归了两个专家。
      const sameExpert = prev.split('/')[0].toLowerCase() === entry.name.toLowerCase();
      if (!sameExpert) problems.push(`重复归属：${file}\n  已有：${prev}\n  再次：${owner}`);
    }
  }
}

console.log(`专家 ${experts} 个，登记资料 ${files} 条，去重后 ${seen.size} 条`);
if (problems.length) {
  console.error(`\n发现 ${problems.length} 处重复：\n`);
  for (const line of problems) console.error(line);
  process.exit(1);
}
console.log('没有重复归属。');
