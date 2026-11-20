# 工具：lookup_expert_knowledge

- **能干什么**：按问题检索全库资料，返回 3–5 份 + 路径 + 相似度；分数低或分差小会说「不太确定」。
- **怎么到**：模型在需要查资料时调用；等价命令 `node scripts/expertctl.mjs search "问题"`。
- **怎么验**：`node scripts/expertctl.mjs search "阅读器 正文行高怎么定"`，看第一条是不是 reader 的字号行高表。
- **已知坑**：检索数据源是 manifest 的 `titles/summaries/queries` 与文件内容，**只在 index.md 登记搜不到**。
