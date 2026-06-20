# Changelog

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
