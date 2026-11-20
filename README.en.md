# Expert Role (dsh-expert-role)

**English** · [中文](README.md)

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![version](https://img.shields.io/github/package-json/v/yjnmedia/dsh-expert-role)](package.json)
[![dsh](https://img.shields.io/badge/DSH-%E2%89%A50.2-4B5563)](https://github.com/deepseek-ai/deepseek-harness)

[中文](README.md) · **English**

**Domain knowledge as an on-demand expert library: one folder per expert, loaded only when needed, every read logged.**

The model's built-in knowledge does not cover new domains (AI image generation, short drama, your internal tool), while the material sits scattered across dozens of folders. This plugin turns "material for one domain plus the research that produced it" into an **expert**, registered as a skill. The model usually sees only one summary line, and reads the body plus reference files only when the work actually needs it. What was read and when is written to the activity log.

## Quick start

1. Install the plugin and restart DSH. A new "Expert Library" entry appears in the left menu.
2. In a conversation say: *"create an AI image expert and file the material under `D:\research\image` into it"*. The model creates the skeleton, moves the material in, and registers the skill.
3. Ask your question. Whether the model loads that expert depends on the calling mode — by default it only consults when you name it.

The plugin does three things only: **turn material into a loadable skill**, **keep the research process in the same folder**, **log every read**.

## Install

```bash
git clone https://github.com/yjnmedia/dsh-expert-role.git
cd dsh-expert-role
dsh plugin --profile desktop add .
```

The same three commands work in Windows PowerShell. Restart DSH afterwards; the "Expert Library" entry is inserted among your existing menu items, so its position depends on the other plugins you have. Built for the DSH 0.2 series.

## Point it at a library folder

A library is an ordinary folder. The plugin reads its location from `DSH_EXPERT_ROOT`:

```powershell
setx DSH_EXPERT_ROOT "D:\AIExperts"
```

Without it the default is `~/AIExperts` (on Windows `C:\Users\<you>\AIExperts`). The panel reloads every 5 seconds, so a change shows up without restarting.

## What a library looks like

```
<library root>/
├── settings.json          # calling mode, research mode, panel language
├── index.md               # which experts exist
└── ai-image/
    ├── SKILL.md           # what the model actually reads (name, description, when to use)
    ├── manifest.json      # title, topics, file titles, review dates
    ├── references/
    │   ├── index.md       # topic → file → one-line summary
    │   └── <slug>/…       # the material itself
    ├── survey.md          # research plan, steps, progress
    ├── 资料对照.md         # Chinese name ↔ English folder (kept for the human reader)
    └── 资料快捷方式/        # shortcuts with Chinese names
```

Material is **moved** into the library, not copied; the old location gets a README pointing here.

## Panel

- **Overview** — how much material is used, which experts get used, what is still unread, recent activity.
- **Experts** — one card per expert: rating, topics, sources, what it is for, last use.
- **Activity** — per conversation: who called which expert. Research sub-sessions are hidden (they create material, they are not usage).
- **Settings** — when the model may consult the library, how research runs, panel language (follow system / 中文 / English).

## Tools the model can call

| Tool | What it does |
| --- | --- |
| `expert_list` | List experts with rating and progress |
| `expert_create` | Create an expert skeleton; never overwrites an existing one |
| `expert_plan` | Write or partially update the research plan |
| `expert_record` | Record one step; serial mode rejects skipping ahead without `force` |
| `expert_next` | Return the next unfinished step as a ready-to-use subtask prompt |
| `expert_dispatch` | Really dispatch parallel research sub-sessions |
| `expert_workspace` | Open a separate workspace conversation for research |
| `expert_ingest` | File one source into the library (move, infer metadata, mark auto-filled) |
| `expert_find` | Find which material answers a question; says "not covered" instead of guessing |
| `expert_mode` | Switch calling mode |
| `expert_status` | Show the full state of one expert |
| `lookup_expert_knowledge` | Entry point used by the model: question → which files to read |

## Calling modes

| Mode | Behaviour |
| --- | --- |
| `auto` | The model decides when a question is related |
| `on-request` (default) | Only when you say "call / ask / check some expert" |
| `off` | Never consulted automatically; creating and researching still work |

Switching modes rewrites `settings.json` only; no restart needed.

## Research modes

| Mode | Behaviour |
| --- | --- |
| `parallel` | Dispatch several research sub-sessions, then merge and de-duplicate |
| `serial` (default) | Research one step at a time, adjusting direction after each |
| `workspace` | Open a separate conversation dedicated to research |

## Rating: five stars

The first four stars are about content only; usage matters only for the fifth.

| Stars | Meaning |
| --- | --- |
| ★☆☆☆☆ | Starting: a skeleton |
| ★★☆☆☆ | Usable: enough topics and sources |
| ★★★☆☆ | Reliable: broad, current, well indexed |
| ★★★★☆ | Authoritative: nearly complete coverage |
| ★★★★★ | Exemplary: authoritative **and** actually used in ≥2 conversations |

The panel explains the rating per dimension and what to do next.

## Tests

```bash
node --test test/*.test.js        # 79 tests
node scripts/host-smoke.mjs       # host side with a fake ctx
node scripts/client-smoke.mjs     # client bundle with a fake loader
node scripts/render-smoke.mjs     # renders every tab, zh and en
SMOKE_EN=1 node scripts/render-smoke.mjs
```

## Limits

- The model is not forced to consult an expert; calling modes only shape the prompt and the pre-step check.
- Material names and descriptions stay in the language you filed them in — only the panel chrome is translated.
- No cloud sync: the library is a local folder.

## License

MIT © 2026 yjnmedia
