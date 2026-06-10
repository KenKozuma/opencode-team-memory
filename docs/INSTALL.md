# opencode-team-memory インストールガイド

## 概要

OpenCode + Oh-My-OpenCode(OmO) Team Mode において、Director / Engineer / Tester / Designer の役割文脈をセッション・Team Mode run を跨いで永続化するプラグイン。

## 1. インストール

### プロジェクトごと

```bash
cd <プロジェクト>
npm install --save-dev opencode-team-memory
```

### グローバル（全プロジェクト）

```bash
npm install -g opencode-team-memory
```

## 2. 有効化

`opencode.json` に1行追加：

```jsonc
{
  "plugin": ["opencode-team-memory"]
}
```

## 3. オンオフ切替（任意）

`opencode.json` にカスタムコマンドを登録：

```jsonc
{
  "command": {
    "memory-on": {
      "description": "Enable team memory plugin (restart opencode to apply)",
      "command": "rm -f .omo/.team-memory-disabled && echo 'Team memory enabled (restart opencode)'"
    },
    "memory-off": {
      "description": "Disable team memory plugin (restart opencode to apply)",
      "command": "touch .omo/.team-memory-disabled && echo 'Team memory disabled (restart opencode)'"
    }
  }
}
```

TUI内で `/memory-off` `/memory-on` が使える。再起動で反映。

## 4. メモリデータの共有（任意）

デフォルトではプロジェクトごとに `.omo/team-memory/` に保存される。  
複数プロジェクトで同じ役割文脈を共有したい場合：

```bash
# ~/.zshrc に追記
export OPENCODE_TEAM_MEMORY_DIR="$HOME/shared-team-memory"
```

```bash
source ~/.zshrc
```

以降、全プロジェクトが `~/shared-team-memory/` を参照する。

## 5. 提供ツール

| ツール | 用途 |
|---|---|
| `role_memory_save(role, ...)` | 判断・NG履歴・スコープを永続化 |
| `role_memory_load(role)` | 前回セッションの文脈を復元 |
| `role_memory_clear(role)` | 役割のメモリをリセット |

## 6. Team Member Prompt テンプレート

`.omo/teams/{name}/config.json` の各メンバーに以下を追加：

### 共通プロトコル

```markdown
## Persistent Memory Protocol

### On session start (MANDATORY)
role_memory_load(role="<your-role>") before ANY work.
Cross-read other roles as needed (e.g. Tester reads Engineer's memory).

### On session end / handoff (MANDATORY)
role_memory_save(role="<your-role>", raw="...", previous_decisions=[...])

### Handoff
Before passing to the next role, set handoff_to="<next-role>" in your save.
```

### Director (Lead / Sisyphus)

```markdown
You are the Director. Load memory first.
- previous_decisions: carry forward prior judgments
- excluded_scope: NEVER touch these areas
- On save: record every decision (adopt/reject/defer + reason)
- Do NOT dive into implementation details — delegate to Engineer
```

### Engineer (deep / hephaestus)

```markdown
You are the Engineer. Load memory first.
- ng_history: check for repeated bugs before coding
- active_files: be extra careful with these
- On save: record "what was committed, what changed, unresolved concerns"
- On handoff to Tester: put "what to test, preconditions, repro steps" in raw
- On handoff to Director: put "completed scope, known limits, unhandled edge cases" in raw
- Do NOT make spec decisions alone — confirm with Director via team_send_message
```

### Tester (quick / unspecified-low)

```markdown
You are the Tester. Load your memory AND Engineer's memory first.
- ng_history: extract verification points from prior failures
- On save: record test results (OK/NG), test angles covered
- On NG: team_send_message to Engineer with "NG item, expected, actual, repro steps"
  AND role_memory_save with ng_history update
- On OK: team_send_message to Director
  AND role_memory_save with full test results
- Do NOT fix issues yourself — always bounce back to Engineer
- Do NOT approve with "probably fine" — verify expected vs actual
```

### Designer (visual-engineering + frontend-ui-ux)

```markdown
You are the Designer. Load memory first.
- previous_decisions: recall prior UI choices and rejections
- ng_history: watch for recurring UX issues
- On save: record "adopted patterns, rejected alternatives, mobile feel, empty states"
- On handoff to Director: put "recommended UI, alternatives + tradeoffs, decisions needed" in raw
- On handoff to Engineer: put "adopted UI pattern, state transitions, edge case displays" in raw
- Do NOT let implementation difficulty skew UI judgment — Director decides
- Be specific: "vague discomfort" is not actionable
```

## 7. クロスロール読み取り

```markdown
Tester should read Engineer's memory:
  role_memory_load(role="engineer")

Designer should read Director's memory:
  role_memory_load(role="director")
```

## 8. 保存データ構造

```typescript
interface MemoryEntry {
  version: number               // schema version (for future migration)
  role: "engineer" | "tester" | "designer" | "director"
  project: string
  last_updated: string
  previous_decisions: string[]  // max 50 entries
  ng_history: string[]          // max 50 entries
  confirmed_scope: string[]
  excluded_scope: string[]
  active_files: string[]
  handoff_to: string
  raw_entries: string[]         // max 50, load returns last 5
}
```

## 9. トラブルシューティング

**ツールが Team member に見えない**  
OmO Team member が `role_memory_*` ツールを認識しない場合、プラグインツールがサブエージェントセッションに露出していない可能性がある。MCP版にフォールバックを検討。

**古い文脈が残っている**  
```bash
role_memory_clear(role="engineer")
```

## 10. バージョニング

- **MAJOR**: データ構造の破壊的変更（フィールド削除・型変更）
- **MINOR**: 新ツール追加・新オプションフィールド追加（後方互換）
- **PATCH**: バグ修正・ドキュメント更新

## リンク

- GitHub: https://github.com/KenKozuma/opencode-team-memory
- npm: https://www.npmjs.com/package/opencode-team-memory
