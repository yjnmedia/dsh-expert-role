# 页签：专家（两级）

- **能干什么**：第一屏只列八类，点一类进去看这一类的专家卡；卡上能看分数、主题、资料数、缺口与调研进度。
- **怎么到**：页签「专家」；`jumpTo` 会先切到大类再定位专家。
- **怎么验**：`node scripts/expertctl.mjs panel --tab 资料 --shot .tmp/experts.png`，再 `--tab 大类` 看空大类。
- **已知坑**：分组必须用服务端 `taxonomy`（按成员 id），不要用 `item.level1` 兜底——以前 API 漏字段，12 位全落进「专业技术」。总入口 `expert-library` 只显示一行「入口」，不画专家卡、不计入 N 位。
