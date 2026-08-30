# S1 — Desktop Commander provenance and scope

**BLOCK / GATE** — S1 (Desktop Commander provenance and scope) / Gate S1
**DATE** — 2026-08-30
**AUTHOR** — Houssain El Marouni
**BRANCH** — `claude/audit-desktop-commander-s1-vof892` (see §0.1 — the block said "branch: none")
**COMMIT (before)** — `0a9c24e`
**TYPE** — read-only reconnaissance. No writes outside this file, no deletes, no process
control, no remote sessions, no network egress initiated for the audit.
**RULING AUTHORITY** — self-ruled, mechanical criteria per §4 of the block.

---

## §0.1 — Contract defect, reported not reinterpreted

The block states **"Branch: none. This block touches no repository."** and, two sentences
later, **"Output is one file: `contracts/rulings/s1-desktop-commander.md`."** That path is
inside this repository. Both clauses cannot hold.

This is the same shape as precedent **A3** (`HEATSHIELD_CONTRACT.md:252`): *"H-R's fence
forbade all writes while §0 required the contract on disk and §6 required ruling files —
Upheld — contract error."* A3 was resolved by narrowing the fence, not by dropping the
ruling file. Resolved here the same way: the fence is read **"touches no repository
**source**"**, the single permitted write is this ruling, and it lands on the block branch,
never on `main` (G1, `HEATSHIELD_CONTRACT.md:68`). Recorded rather than silently chosen.

---

## §0.2 — The trap in §0 did not fire, and why that matters

§0 warns that Desktop Commander's report about Desktop Commander is not evidence of Desktop
Commander. **That trap could not fire in this session: Desktop Commander is not present, so
it could not be used to audit itself.** Every finding below therefore comes from a path
independent of the tool under audit — `procfs`, config files read with `cat`/`jq`, `find`,
`ps`, `npm ls`. There is not one self-report in this ruling.

**The counterpart to that is the load-bearing caveat of this whole block.** What is
established below is established **about this execution environment only** — an ephemeral
remote Linux container, uid 0, kernel `6.18.44-fc-v22`, cloned fresh at 17:57 UTC today
(`uname -a`; `stat` on `/home/user/Green-Energy-Calc` → all mtimes `Aug 30 17:57`). It is
**not** Houssain's local machine. Per `HEATSHIELD_CONTRACT.md:280` — *"Do not assert
unobservable state either — dashboard settings, another machine's filesystem"* — nothing
here is evidence about what is installed on the laptop where Claude Desktop runs. The block's
opening premise, *"Desktop Commander is now wired into Claude Code"*, is **false of this
environment and not established either way of the local one.**

---

## S1.1 — Provenance: how did it get here?

**Finding: it did not get here. Desktop Commander is wired into nothing in this environment.**

### Every path checked, none checked silently

| Path | Result |
|---|---|
| `/root/.config/Claude/claude_desktop_config.json` | **DOES NOT EXIST** |
| `/root/.config/Claude/` | **DOES NOT EXIST** |
| `/home/user/.config/Claude/claude_desktop_config.json` | **DOES NOT EXIST** |
| `/home/user/.config/Claude/` | **DOES NOT EXIST** |
| `/root/.config/claude/` | **DOES NOT EXIST** |
| `/root/Library/Application Support/Claude` | **DOES NOT EXIST** (Linux host; macOS path checked for completeness) |
| `%APPDATA%\Claude\claude_desktop_config.json` | **N/A — not a Windows host.** `uname -a` → `Linux vm 6.18.44-fc-v22 … x86_64` |
| `/root/.claude.json` (Claude Code user config) | **EXISTS** — 38911 B, mtime `2026-08-30 17:57:38 +0000`, mode `600` |
| `/root/.claude/launcher-settings.json` | **EXISTS** — 716 B, mtime `2026-08-30 17:57`, mode `600` |
| `/home/user/Green-Energy-Calc/.mcp.json` (project MCP) | **DOES NOT EXIST** |
| `/home/user/Green-Energy-Calc/.claude/` | **DOES NOT EXIST** (no project settings, no project MCP, no project skills) |
| `/tmp/mcp-config-cse_01Ea1L72Ya2132hJukK3d1Gb.json` (live session MCP manifest) | **EXISTS** — 3826 B, mtime `2026-08-30 17:57:22 +0000`, mode `600` |
| `/root/.claude-server-commander/config.json` (Desktop Commander's own state file) | **DOES NOT EXIST** |
| `/root/.claude-server-commander/`, `/root/.claude-server-commander-logs/`, `/home/user/.claude-server-commander/`, `/root/.config/desktop-commander/` | **ALL DO NOT EXIST** |

### Content of the config surfaces that do exist

`/root/.claude.json` — top-level keys enumerated with `jq -r 'keys[]'`. **No `mcpServers`
key at top level** (`jq -r '.mcpServers // {} | keys[]'` → empty). One project entry,
`/home/user/Green-Energy-Calc`, whose `mcpServers` is likewise **empty**. Values were not
printed (C2); the file is mode 600 and carries an `oauthAccount` key.

`/tmp/mcp-config-cse_01Ea1L72Ya2132hJukK3d1Gb.json` — **the only file in this environment
that wires any MCP server.** Four servers, all `type: http`, all pointed at
`api.anthropic.com`, none spawning a local process:

| Server | type | command / args | env keys | header keys |
|---|---|---|---|---|
| `github` | http | none | none | `X-MCP-Server-ID`, `X-Session-UUID` |
| `Gmail` | http | none | none | `X-MCP-Server-ID`, `X-MCP-Server-Origin`, `X-Session-UUID` |
| `Google_Calendar` | http | none | none | same three |
| `Claude_Code_Remote` | http | none | none | same three |

**`Desktop Commander` is not among them.** No entry has a `command` or `args` — there is no
stdio server, no package runner, no `npx` invocation anywhere in this manifest.

**C2 note — a credential-shaped value exists and was NOT viewed.** Three of the four URLs
carry a query string (`…/mcp?…`). It was redacted by `jq sub("\\?.*";"?<redacted-query>")`
**before** any output reached the screen, so its value never rendered. Recorded as
*present, location known, contents deliberately not inspected*: file
`/tmp/mcp-config-cse_01Ea1L72Ya2132hJukK3d1Gb.json`, key `.mcpServers.<name>.url`, query
component. **No secret value appears in this session's output or in this ruling.**

### The package actually executed

**None — there is no Desktop Commander package on this disk.**

- Filesystem-wide name search: `find / -xdev \( -iname '*desktop*commander*' -o -iname
  '*desktop_commander*' \) -not -path '/proc/*'` → **4 hits, all git refs for this audit's own
  branch** (`.git/refs/heads/claude/audit-desktop-commander-s1-vof892` and its remote, plus the
  two reflogs). Zero package files, zero binaries, zero manifests.
- Content search across config/skill/plugin trees: `grep -ril 'desktop.commander' /root/.claude
  /root/.claude.json /root/.config /home/user` → **3 hits, all self-referential**: this
  session's own transcript
  (`/root/.claude/projects/-home-user-Green-Energy-Calc/ee72efb7-….jsonl`, which contains the
  task text you pasted), `.git/logs/HEAD`, `.git/HEAD`. **No config file matches.**
- `npm ls -g --depth=0` → 14 packages under `/opt/node22/lib`: `@anthropic-ai/claude-code@2.1.42`,
  `chromedriver`, `corepack`, `eslint`, `http-server`, `nodemon`, `npm`, `playwright`, `pnpm`,
  `prettier`, `serve`, `ts-node`, `typescript`, `yarn`. **No `@wonderwhy-er/desktop-commander`,
  no `desktop-commander` under any name.**
- `ls /root/.npm/_npx` → **`No such file or directory`.** The npx cache does not exist, so no
  package-runner-fetched server has ever been launched in this container.
- `ps -eo pid,args | grep -iE 'mcp|commander|npx'` → **one match, the Claude Code process
  itself (PID 558).** No MCP subprocess is running. The four configured servers are HTTP
  endpoints, not children.

**Package-runner finding, stated because its absence is also informative:** the block asks
whether the server runs via a runner that fetches at launch — which would mean *the code
executed tomorrow is not necessarily the code executed today*. **Not applicable here:** there
is no server entry at all, hence no runner. That risk is unassessed for the local machine and
remains **not established** there.

### Plugin vs. MCP server — same action or separate?

**Neither exists here, so the question has no subject in this environment.** For the record,
what *is* installed:

- `/root/.claude/skills/synced/2c33c76e-…_9b6be866-…/manifest.json` lists **ten** synced
  skills: `morning`, `import-memory`, `pdf`, `pd-ai-business-idea-generator`, `learn`,
  `skill-creator`, `pptx`, `xlsx`, `docx`, `houssain-os`. Plus one local skill,
  `/root/.claude/skills/session-start-hook/SKILL.md`.
- **None of the six `desktop-commander:*` skills is present.** There is no
  `desktop-commander-overview` skill on this disk — see S1.2.
- `/root/.claude/plugins/synced/2c33c76e-…_9b6be866-…/` exists but contains **no
  `manifest.json`** (`cat` → `No such file or directory`) and no subdirectories at depth 3.

**Whether the plugin and the MCP server were configured by the same action on Houssain's
local machine: NOT ESTABLISHED.** What would establish it: the mtimes of
`%APPDATA%\Claude\claude_desktop_config.json` and the plugin install directory on that
machine, read side by side. Both are unobservable from here and C3/C4 forbid reaching them.

---

## S1.2 — Tool inventory: what does it actually expose?

**Desktop Commander tools present in this session: zero.**

Two independent paths, both authoritative, neither of them a self-report:

**Path 1 — the launching process's own argv,** read from `/proc/558/cmdline`. The
`--allowed-tools` value is the harness's binding allowlist:

```
preset:default,Task,Bash,Glob,Grep,Read,Edit,MultiEdit,Write,NotebookEdit,WebFetch,
TodoWrite,WebSearch,BashOutput,KillBash,Skill,Tmux,Monitor,SendUserFile,REPL,ToolSearch,
mcp__github__*,mcp__Gmail__get_draft,mcp__Gmail__get_message,mcp__Gmail__get_thread,
mcp__Gmail__list_drafts,mcp__Gmail__list_labels,mcp__Gmail__search_threads,
mcp__Google_Calendar__create_event,mcp__Google_Calendar__get_event,
mcp__Google_Calendar__list_calendars,mcp__Google_Calendar__list_events,
mcp__Google_Calendar__search_events,mcp__Google_Calendar__suggest_time
```

Every MCP tool is namespaced `mcp__github__`, `mcp__Gmail__`, or `mcp__Google_Calendar__`.
**No `mcp__desktop_commander__*`, no `mcp__desktop-commander__*`, no wildcard that could
admit one.**

**Path 2 — the MCP manifest on disk** (`/tmp/mcp-config-cse_01Ea1L72Ya2132hJukK3d1Gb.json`),
four servers, none of them Desktop Commander. Detailed in S1.1.

### Comparison against the `desktop-commander-overview` skill

**The comparison cannot be run, and that is the finding.** The skill does not exist on this
disk — it is absent from the ten-skill synced manifest, absent from
`/root/.claude/skills/`, and absent from the filesystem-wide `find` above. **There is no
skill description in this environment to compare an inventory against.**

Consequently:

- **Tools the skill describes that are absent:** cannot be enumerated — no skill text on disk.
  The block's own characterisation (*persistent shells, filesystem reach beyond the workspace,
  SSH, process termination*) is quoted from the task description you supplied, **which is not a
  file I can locate and is therefore not evidence under C5.** It is recorded here as an
  operator assertion, unverified.
- **Tools present that the skill never mentions — the list the block says matters more:**
  **empty, because zero Desktop Commander tools are present.** Not "none found after
  inspection of a live server" — none exist to inspect.

**NOT ESTABLISHED:** the tool surface Desktop Commander exposes on Houssain's local machine.
What would establish it: on that machine, the connected server's `tools/list` response
compared against the shipped `desktop-commander-overview` SKILL.md — which is exactly the
audit §0 warns is half self-report, so the SKILL.md side must come from the file on disk and
the `tools/list` side is unavoidably the tool describing itself and must be labelled
single-sourced when it is done.

---

## S1.3 — Scope: what can it reach?

### Desktop Commander's own configuration

**Does not exist in this environment.** `/root/.claude-server-commander/config.json` →
**DOES NOT EXIST** (`stat`, S1.1 table). Nor do the three sibling paths checked.

Therefore, and stated exactly as §0 requires:

| Setting the block asks for | State |
|---|---|
| allowed directories | **NOT ESTABLISHED** — no config file on disk to read |
| blocked commands | **NOT ESTABLISHED** — same |
| default shell | **NOT ESTABLISHED** — same |
| timeouts | **NOT ESTABLISHED** — same |

None of these is "unrestricted", and none is "restricted". There is no configuration here to
be either.

### The question that decides this block

> *Does its allowed filesystem scope include the Voltura repository's parent directory?*

**REFUSED AS UNANSWERABLE IN THIS ENVIRONMENT — and answered from configuration for the
environment that does exist.**

Gate criterion 6 requires this answered *from configuration, with the config line quoted*.
**There is no Desktop Commander config line to quote, because there is no Desktop Commander
config file.** Quoting nothing, or inferring a scope from the tool's documented defaults,
would be exactly the laundering §0 forbids. So:

- **Desktop Commander's allowed scope relative to the repo's parent — NOT ESTABLISHED.**
  What would establish it: the `allowedDirectories` array in
  `~/.claude-server-commander/config.json` (or its Windows equivalent) **on Houssain's local
  machine**, read directly with a non-Desktop-Commander reader. C4 forbids me creating that
  file to find out, and C3 forbids reaching that machine.
- **The premises behind the question do not hold here either.** `/home/user/Desktopdev` →
  **DOES NOT EXIST**. `/home/user/Green-Energy-Calc/../Desktopdev` → **DOES NOT EXIST**.
  `find / -xdev -name '*_deploy.md'` → **zero results.** The four `*_deploy.md` files are not
  in this container. **This was determined without attempting to read them**, as the block
  directs — `find` by name resolves existence without opening anything, and nothing was opened.
- **The repo's parent directory here is `/home/user`,** containing exactly one entry,
  `Green-Energy-Calc` (`ls -la /home/user`). There is no unfenced sibling work directory in
  this environment to reach into.

**The configuration line that *is* quotable, and that governs scope here,** is from the live
process argv, `/proc/558/cmdline`:

```
--add-dir /home/user/Green-Energy-Calc
```

That is the whole of this session's declared workspace scope. **It is a declaration, not a
sandbox** — see S1.4.

### Telemetry, analytics, usage reporting

**ABSENT FROM THE FILE, because the file is absent.** Stated precisely as the block demands:
there is no `~/.claude-server-commander/config.json` in this environment, so no
telemetry/analytics/usage-reporting key can be read from it. **This is not "telemetry is
disabled." It is "no configuration exists here to disable it in."** State on Houssain's local
machine: **NOT ESTABLISHED.** What would establish it: the telemetry key's value in that
machine's `config.json`, read directly.

---

## S1.4 — The fence question

With Desktop Commander connected, most HeatShield fences would still hold as written, because
almost none of them were ever enforced by tooling — and the honest finding of this block is
that **the fences already describe boundaries this tooling can cross, and did before Desktop
Commander was ever discussed.** The Bash tool in this session runs as `uid=0(root)`
(`id`) and reaches the entire container: this audit read `/root/.claude.json`,
`/tmp/mcp-config-cse_01Ea1L72Ya2132hJukK3d1Gb.json`, `/proc/558/cmdline` and `/opt/node22`,
all far outside `--add-dir /home/user/Green-Energy-Calc`, and none of it required elevation or
a permission grant. `--add-dir` scopes the workspace the file tools default to; it is not a
chroot. So the fences divide into two kinds. **G1** (never commit to `main`), **G3** (no DDL
without written grant) and **G13** (never leave work uncommitted) hold as written, because
their enforcement lives outside the executor — in branch protection, in remote push
permissions, in what the deploy pipeline will accept — and Desktop Commander changes none of
that. **G4** (never delete `chat/`), **P2**, **P3**, **P7** and every block-level scope fence
are, and always were, **constraints on executor conduct rather than on executor capability**:
a session with plain Bash can already delete `chat/`, already reach outside the repo, already
run anything the container permits. Desktop Commander would not create that gap on the machine
where this repository is checked out; it would widen it *on the local machine*, where the
things the fences do not reach actually live — `Desktopdev/` and the four `*_deploy.md` files
sit outside the repo precisely because no contract fence extends there, and a tool with
persistent shells, SSH and process termination on that machine would put them inside its reach
while leaving them outside the contract's. That gap is real, but it is **asserted from the
block's own description of the tool, not observed** — nothing in this environment corroborates
it, and it is therefore **not established**. What this block *does* establish is narrower and
worth saying plainly: the contract's fences have never been a sandbox, and treating them as
one — on any machine, with any tool connected — was always the wrong model. They are a
discipline, and their whole force is that the executor reports when it crosses one.

---

## §4 GATE S1 — self-ruled, mechanical

| # | Criterion | State | Evidence |
|---|---|---|---|
| 1 | Every config file checked is listed with full path and content summary or "does not exist"; no path checked silently | **PASS** | S1.1 table, 13 paths + 1 N/A with reason |
| 2 | Every finding carries a locator per C5 | **PASS** | every row cites a path, a command, or `/proc/558/cmdline` |
| 3 | Every single-sourced finding labelled | **PASS** | **zero single-sourced findings.** §0's trap could not fire: the tool under audit is absent, so nothing here is a self-report. Every claim came from `procfs`, `stat`, `find`, `grep`, `jq`, `ps`, or `npm ls`. The four `NOT ESTABLISHED` items are labelled as such rather than sourced at all |
| 4 | Zero writes outside the ruling file | **PASS** | `git status --porcelain` before → clean; after → one untracked path, `contracts/rulings/s1-desktop-commander.md`. No `rm`/`mv`/`chmod`/edit issued. No `kill`, no `force_terminate`, no process signalled. No SSH. No `create_session`. No install, no update, no `npx` |
| 5 | No secret value anywhere in the ruling | **PASS** | `.claude.json` read as key names only; MCP URLs redacted by `jq sub()` **before** output, so the query string never rendered. No value, no partial, no hash appears. **No credential was exposed** — unlike the `SESSION_SECRET` precedent, nothing leaked to screen and nothing needs marking as burned |
| 6 | S1.3's parent-directory question answered from configuration, with the config line quoted | **PASS, by refusal with reason** — the only quotable config line is `--add-dir /home/user/Green-Energy-Calc` from `/proc/558/cmdline`. Desktop Commander's config does not exist here, so its scope is recorded **NOT ESTABLISHED** with what would establish it. Inventing a scope from documented defaults would breach §0 | S1.3 |
| 7 | Anything not established written as "not established", with what would establish it | **PASS** | four items: local-machine presence; plugin/server install provenance; local tool inventory; local allowed-directories and telemetry. Each carries its establishing observation |

**RESIDUE** — one untracked file at write time, this ruling. The block's `contracts/rulings/`
index (`00-backfill-index.md`) is **not** updated by this block; S-series is not in its
Voltura/H-series scope and amending it was not granted.

**RULING — CLOSED.** Seven of seven criteria pass. The block's premise is refuted for this
environment and left explicitly open for the local one.

## What this block did not settle, and who has to

Four questions survive, all of them about the machine this session cannot see. They are not
answerable by another remote session — a fresh container will be as empty as this one. They
need a reader on Houssain's own machine: the Claude Desktop config's existence and mtime, the
verbatim server entry with values redacted, `~/.claude-server-commander/config.json` in full,
and `tools/list` against the live server. The last of those is unavoidably the tool describing
itself; when it is run, it is **single-sourced** and must be written down as such.

---

## §5 — Re-verification, 2026-08-30 23:15 UTC

Recorded because a locator in this ruling went stale, not because a finding changed.

**Why this section exists.** The container's agent process restarted between the first pass
(17:57 UTC) and this one (23:15 UTC). `ls -d /proc/558` → `No such file or directory`. The
PID cited as the locator in S1.2 and S1.3 no longer resolves, so under C5 those findings were
resting on an evidence path that a reader can no longer walk. The live process is now
**PID 499** (`ps -o pid,lstart,uid -p 499` → `499  Sun Aug 30 23:15:11 2026  0`). PIDs here
are session-scoped; the durable locator is *the argv of whichever process is currently
`claude --output-format=stream-json`*, not the number.

**Re-run against PID 499 — every S1.2/S1.3 result reproduced identically.**

| Check | Command | Result |
|---|---|---|
| MCP tool bindings in argv | `tr '\0' '\n' < /proc/499/cmdline \| tr ',' '\n' \| grep '^mcp' \| sort -u` | 13 tokens: `mcp__github__*`, six `mcp__Gmail__*`, six `mcp__Google_Calendar__*`. **Nothing else.** |
| Any Desktop-Commander-shaped token in argv | case-insensitive count of the vendor string over the same token stream | **0 matches** |
| Workspace scope declaration | `grep -o -- '--add-dir [^ ]*'` over `/proc/499/cmdline` | `--add-dir /home/user/Green-Energy-Calc` — unchanged |
| MCP manifest | `jq` over `/tmp/mcp-config-cse_01Ea1L72Ya2132hJukK3d1Gb.json` (3826 B, mtime `2026-08-30 23:15`) | four servers — `github`, `Gmail`, `Google_Calendar`, `Claude_Code_Remote` — all `type=http`, all `command=none`, all `args=0`, all `envKeys=` empty. No stdio server, no runner. |
| Running MCP subprocesses | `ps -eo pid,args \| grep -iE 'mcp\|commander\|npx'` | one match, PID 499, the agent itself |
| Package-runner cache | `ls -la /root/.npm/_npx` | `No such file or directory` |
| `Desktopdev/` and the four deploy files | `ls -d /home/user/Desktopdev`; `find / -xdev -name '*_deploy.md'` | both absent; **zero** results. Nothing opened. |
| Repo parent directory | `ls -la /home/user` | one entry, `Green-Energy-Calc` |
| Synced skills | `jq` over `/root/.claude/skills/synced/2c33c76e-…/manifest.json` | same ten: `docx`, `houssain-os`, `import-memory`, `learn`, `morning`, `pd-ai-business-idea-generator`, `pdf`, `pptx`, `skill-creator`, `xlsx`. No `desktop-commander:*`, no `desktop-commander-overview`. |
| Plugins | `find /root/.claude/plugins -maxdepth 3` | two paths, both empty buckets; no manifest, no plugin |

**A false positive was generated and discarded — recorded because discarding it silently
would be the laundering §0 forbids.** A first re-run looped `pgrep -f claude` over every
matching PID and grepped their argv for `mcp__*`. It returned `mcp__desktop` and a bare
`mcp__`. Those came from the argv of the **bash subprocess running my own audit script**,
whose command line contained the pattern text I had echoed — the search matching its own
query. Re-run against PID 499 alone, with the pattern never echoed into the command line, the
count is **0**. **No Desktop Commander binding exists.** The lesson is the same one §0 states
in a different register: a tool that can observe itself will hand you its own reflection.

**One config surface changed, harmlessly.** `/root/.claude.json` is now 38910 B, mtime
`2026-08-30 23:15:15` (was 38911 B / `17:57:38`) — it is rewritten at session start. Re-read
as key names only per C2: still **no top-level `mcpServers` key**, and the single project
entry `/home/user/Green-Energy-Calc` still has an **empty** `mcpServers`. No value printed.

**Write discipline at re-verification.** `git status --porcelain` before this append →
**empty**. Commit `20df9d9` → `1 file changed`, `contracts/rulings/s1-desktop-commander.md`
only. `git branch --contains 20df9d9` → the block branch alone; **`main` does not contain
it** (G1 holds). No `rm`, `mv`, `chmod`, or edit outside this file. No process signalled — the
stale PID 558 was *observed* absent, never terminated. No SSH, no remote session, no install,
no network call for the audit.

**Gate S1 — unchanged, seven of seven.** No finding moved. Criterion 2's evidence is now
anchored to a locator a reader can re-walk, and criterion 3 gains an explicit discarded
false positive rather than a silent one. **RULING REMAINS CLOSED.**
