# 页签：自检

- **能干什么**：最近查资料里「可能有问题」的条目：一份没找到、分数太低、前两名太近、跨专家。
- **怎么到**：页签「自检」。
- **怎么验**：`node scripts/expertctl.mjs panel --tab 自检 --shot .tmp/audit.png`。
- **已知坑**：数据源是 `.trace/retrieval.jsonl`，只记查询与命中，不存资料内容。
