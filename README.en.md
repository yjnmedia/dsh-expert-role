# dsh-expert-role

**English** · [中文](README.md)

Domain knowledge as an on-demand expert library: one directory per expert, loaded by the model only when needed, every read recorded.

## What it does

- **Experts as skills** — each expert is a directory (`SKILL.md`, `manifest.json`, `references/`, `survey.md`) registered as a skill. The model sees one line; the body is read on demand.
- **Two-level library** — eight categories on the panel; click one to see its experts. Expert directories may sit flat or under `NN-category/`.
- **Retrieval** — local vector search with `bge-small-zh` (optional, ~95MB). Without the model it falls back to keyword matching; the plugin keeps working either way.
- **Gap handling** — questions the library cannot answer are grouped by topic, triaged (hand off / reuse / research), and only "research" asks for your approval because it costs tokens.
- **Category sessions** — eight sessions, one per category, receive the work; replies are tagged and anything needing your decision is collected on the "activity" tab.
- **Data location** — experts live under the DSH data directory by default; you can move them to any drive from Settings. Nothing leaves your machine unless you configure an external embedding service.

## Install

```bash
git clone https://github.com/yjnmedia/dsh-expert-role.git
cd dsh-expert-role
dsh plugin --profile desktop add .
```

Optional retrieval model (about 95MB, one time): put `model-fp32.onnx` and `vocab.txt` from `BAAI/bge-small-zh-v1.5` under `models/bge-small-zh/`.

## Development

```bash
npm test
npm run smoke
node scripts/expertctl.mjs doctor
```

License: MIT.
