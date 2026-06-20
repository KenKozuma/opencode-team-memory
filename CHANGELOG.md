# Changelog

## 1.4.0

- Add `role_delegate` tool — auto-detect next role and generate task prompt
- Add `buildTaskPrompt()` — construct role-aware task prompts from saved context
- Add role skills: tm-engineer, tm-tester, tm-designer
- Director auto-orchestration loop operational
- 2 new tests (29 total)

## 1.3.1

- Add Director Agent config with self-improvement protocol
- Director auto-searches ctx_search before task delegation
- Director auto-tracks reusable patterns via role_memory_reference
- Full 3-layer pseudo-memory pipeline operational

## 1.3.0

- Add `role_memory_reference` tool — track pattern reuse count
- Add `role_memory_hot_patterns` tool — list patterns at threshold
- Add `omo-skill-generate` CLI — auto-generate SKILL.md from hot patterns
- Add `trackReference()` / `findHotPatterns()` / `generateSkillMarkdown()` to memory.ts
- Patterns reaching 3+ references become OpenCode skills automatically
- 6 new tests (27 total)

## 1.2.1

- Add `role_memory_resume` tool — restore team context mid-session without restart
- Add `/resume` TUI command

## 1.2.0

- Add `omo-resume` CLI — auto-restore team context on opencode launch
- Three modes: `--always`, `--ask` (default), `--never`
- Reads latest role state from `.omo/team-memory/`
- Generates continuation prompt and passes to `opencode run`

## 1.1.0

- Add `formatContinuation()` — generates role-aware continuation prompt
- Add `experimental.chat.system.transform` hook — injects role context at session start
- Add Context-Mode compatible JSON metadata to compaction snapshots
- Sessions now auto-restore role context on restart

## 1.0.2

- Fix `scripts/preflight.sh` inclusion in npm tarball

## 1.0.1

- Add `scripts/preflight.sh` — automated installation check
- Add `/preflight` custom command for TUI

## 1.0.0

- Initial release
- `role_memory_save`, `role_memory_load`, `role_memory_clear` tools
- Compaction hook for automatic context injection
- Cross-role memory reading support
- Data versioning (`version` field in context.json)
- Toggle on/off via `.omo/.team-memory-disabled` marker file
