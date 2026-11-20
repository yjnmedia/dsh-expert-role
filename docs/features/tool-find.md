# 工具：expert_find

- **能干什么**：在指定专家里找资料；没命中返回 `missing: true`，让模型停下来问用户，而不是硬编。
- **怎么到**：指定专家后查资料时调用。
- **怎么验**：`node --test test/find.test.js`。
- **已知坑**：返回的路径必须用 `library.expertDir(id)` 拼，两级目录后不能再拼 `root/id`。
