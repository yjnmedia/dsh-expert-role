# 工具：expert_ingest

- **能干什么**：把一份资料搬进某个专家：读标题与首段、写进索引与清单，原位置不再保留。
- **怎么到**：用户说「把这个整理进资料库」时调用。
- **怎么验**：`node --test test/ingest.test.js`；入库后跑 `node scripts/expertctl.mjs doctor`，登记应当齐全。
- **已知坑**：入库 = 文件 + `references/index.md` + `manifest.json` 三处都要写；只写一处检索不到，`docs-registration` 测试会红。
