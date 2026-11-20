# 页签：调用记录

- **能干什么**：看谁在什么会话里叫了哪位专家、读了哪份资料；子会话并进父会话显示。
- **怎么到**：页签「调用记录」。
- **怎么验**：`node scripts/expertctl.mjs panel --tab 调用记录 --shot .tmp/trace.png`。
- **已知坑**：记录来自 `.trace/trace.jsonl`；子会话如果被单列成一条，说明身份没标对。
