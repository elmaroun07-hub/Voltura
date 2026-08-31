# S2 — The Desktop Commander plugin

**BLOCK / GATE** — S2 (the Desktop Commander plugin) / Gate S2
**DATE** — 2026-08-31
**AUTHOR** — Houssain El Marouni
**BRANCH** — `claude/audit-dc-plugin-s2`, off `main` at `0a9c24e` (see §0.2)
**TYPE** — read-only reconnaissance, halted at the §0.1 environment gate
**RULING AUTHORITY** — self-ruled, mechanical criteria per §4

---

## §0.1 — Environment gate: FAILED. Block halted here.

**The machine.** An ephemeral remote Linux container — `Linux vm 6.18.44-fc-v22 x86_64`,
Ubuntu 24.04.4, hostname `vm`, uid 0, repository cloned fresh at `2026-08-30 17:57 UTC`. It is
**not** the operator's local machine and holds no part of his Claude Desktop or local Claude
Code installation.

**The subject.** **The Desktop Commander plugin is not present on this machine, so §2 was not
attempted.**

That is the whole ruling. §0.1 directs that absence here is not a finding about the plugin,
and this block does not convert it into one.

---

## §0.2 — One ambiguity resolved, recorded rather than chosen silently

The block says the branch goes *"off the current tip of the repository you are run in."* The
repository's checkout was sitting on `claude/audit-desktop-commander-s1-vof892`, whose S1 ruling
is **unmerged and under an open draft PR**. Branching there would have pulled S1's file into this
branch and muddied that PR's diff with an unrelated block. Read as the repository's tip —
`origin/main` at `0a9c24e` — S2 stands independent of S1's review. Recorded because the phrase
admits both readings.

---

## Gate evidence — every path checked, none checked silently

| Path checked | Result |
|---|---|
| `/mnt/skills/plugins/` — the exact path §0 cites for the six skills | **DOES NOT EXIST** (`ls` → `No such file or directory`) |
| `/mnt/skills/` | exists; contains exactly two entries, `examples/` (60) and `public/` — **no `plugins/`**. `public/` holds `docx`, `file-reading`, `frontend-design`, `pdf`, `pdf-reading`, `pptx`, `product-self-knowledge`, `xlsx` — none from the batch of ten |
| `/root/.claude/plugins/` | exists and is **empty — 0 bytes total** (`du -sb` → `0`). One 0-byte bucket marker, `sha256 e3b0c442…7852b855` (the empty-file digest). No plugin, no manifest |
| `/home/claude/.claude/plugins/`, `/home/user/.claude/plugins/`, `/root/.claude/marketplaces/`, `/root/.config/claude/plugins/` | **ALL DO NOT EXIST** |
| `/root/.claude.json` (sha256[0:16] `3d894f4be840a18f`) | **no `plugin` or `marketplace` key** at top level or under the single project entry |
| Filesystem-wide, by name: `desktop-commander`, `ai-tools-setup`, `computer-health-check`, `obsidian-vault` | 5 hits, **all self-referential** — git refs for the S1 audit branch and S1's own ruling file. Zero plugin files |
| Filesystem-wide, the other nine of the batch: `accoil`, `searchfit`, `techwolf`, `ai-firstify`, `qodo`, `product-tracking` | **zero hits** |
| Any `plugin:skill`-style directory (`-type d -name '*:*'`) | **zero** |

Installed skills here are the ten synced account skills plus one local — none of them a plugin
skill. Locators are paths and content digests; **no PID appears in this ruling** (C4).

---

## Not established, and what would establish it

Every S2 question. All four are properties of plugin files that exist only on the operator's
local machine, which this container cannot observe and C3/C5 forbid reaching.

| Question | State | What would establish it |
|---|---|---|
| **S2.1** — does the plugin declare an MCP server? | **NOT ESTABLISHED** | On the local machine: the plugin's own `plugin.json` / `.mcp.json` / manifest in its installed directory, read directly. A `mcpServers` block with a `command` means the plugin add wired the server; its absence across those files means skills only |
| **S2.2** — hooks, commands, sub-agents, executables | **NOT ESTABLISHED** | `hooks/` and `hooks.json` in the plugin directory, plus `find <plugin-dir> -type f -perm -u+x` |
| **S2.3** — provenance of the batch of ten | **NOT ESTABLISHED** | The local marketplace/plugin config naming each source, plus `stat` mtimes on the ten install directories |
| **S2.4** — trigger-surface overlap | **NOT ESTABLISHED** | The `description:` frontmatter of each installed skill, compared against the operator's memory rules |

**None of these is "no".** Not "the plugin ships no MCP server", not "there are no hooks" — the
files were never in reach (C7).

**The one thing S2 does establish, and it is not nothing:** whatever the plugin grants, **it
grants none of it here.** No plugin skill, hook, command, or bundled executable exists in this
execution environment, so nothing from the batch of ten can act inside this container.

---

## §4 Gate S2 — self-ruled

| # | Criterion | State |
|---|---|---|
| 1 | §0.1 answered first, machine identified | **PASS** — gate run before all else; halted on failure |
| 2 | S2.1 in one sentence, backed by files read | **PASS by refusal with reason** — no plugin files exist to read; answering from the vendor's description would be the laundering S1 §0 forbids |
| 3 | Every plugin directory listed with full path and result | **PASS** — 8 rows above, none silent |
| 4 | Durable locators, zero PID-based | **PASS** — paths and sha256 digests only |
| 5 | All ten covered in a one-line table | **N/A — §2 not reached.** Recorded as not-run, not as passed |
| 6 | No secret value | **PASS** — `.claude.json` read as key names only; nothing rendered |
| 7 | Zero writes outside this file; nothing installed, enabled, disabled, terminated | **PASS** — one file added on a fresh branch off `main` |
| 8 | Not-established written as such, with what would establish it | **PASS** — four items above |
| 9 | No check-in scheduled (C6) | **PASS** — and the S1 check-in armed before C6 existed has been cancelled and PR #2 unwatched |

**RULING — HALTED AT GATE, NOT CLOSED.** S2's questions remain open and are answerable only by
a reader on the operator's own machine. A fresh remote session will fail this same gate; running
S2 again here would produce this file again.
