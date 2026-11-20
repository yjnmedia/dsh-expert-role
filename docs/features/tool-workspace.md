# 工具：expert_workspace

- **能干什么**：给一个专家开独立调研工作区：写 `brief.md`，再开一个新会话跑这一轮。
- **怎么到**：用户说「开个工作区查清楚」时调用。
- **怎么验**：`node --test test/dispatch.test.js`。
- **已知坑**：工作区是目录 + 配置，不是新进程；会话登记要经宿主的 `sessionController`，`agents.create` 只建不登记。
