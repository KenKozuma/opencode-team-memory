# team-memory v1.1 実装計画

## 背景

### 現在導入済み

| コンポーネント | バージョン | 役割 |
|---|---|---|
| RTK | 0.42.4 | bash出力 60-90% トークン削減 |
| Context-Mode | latest | tool出力 98% 削減 + セッション継続インフラ |
| opencode-team-memory | 1.0.0 | 役割別の判断・NG履歴・スコープ永続化 |

### 現状の限界

- OmO Team Mode の member は run 終了で消滅する
- 次セッション開始時、Agent は自分がどの役割か認識できない
- Tester→Engineer の handoff を次 run に自動引き継ぎできない
- 人間が `ulw` と指示しないと Team が再編成されない

## 目標

**人間が opencode を起動するだけで、Agent が前回の役割・状態を自律的に認識し、
作業を再開できるようにする。**

## 技術方針

Context-Mode が提供する2つのフックに役割状態を注入する:

1. `experimental.session.compacting` — compaction 前に役割状態を snapshot に含める
2. `experimental.chat.system.transform` — 次セッション開始時に役割 + 状態をシステムプロンプトに注入

## 設計

### データフロー

```
run中:
  role_memory_save(role="engineer", handoff_to="tester", ...)
      ↓
  Context-Mode SQLite にもインデックス (ctx_index)
      ↓
  compaction発火
      ↓
  team-memory: formatCompact() → output.context.push()
  Context-Mode: FTS5 snapshot 構築
      ↓
  セッション終了

次回起動:
  chat.system.transform 発火
      ↓
  Context-Mode: 前回snapshot読み込み
  team-memory: role_memory_load() 全ロール
      ↓
  system prompt に注入:
    [TEAM CONTINUATION]
    Previous team detected.
    Role: engineer
    Handoff from: director
    Handoff to: tester
    Pending: 実装修了、テスト依頼待ち
    Last 3 decisions: ...
    Last 2 NG: ...
    Load role memory before starting.
```

### 注入プロンプトテンプレート

```markdown
## Team Continuation (opencode-team-memory)

Previous session detected. You were operating as part of a team.

### Your Role
{role}

### Handoff Chain
{handoff_from} → you → {handoff_to}

### Current Status
{last_action}
NG count: {ng_count}

### Critical Context (from previous decisions)
{decisions_summary}

### Recent NG Items (fix these first)
{ng_summary}

### Scope
Confirmed: {confirmed_scope}
Excluded (DO NOT TOUCH): {excluded_scope}

### Instructions
1. role_memory_load(role="{role}") to restore full context
2. Resume work based on handoff state
3. If handoff_to is set, prepare output for next role
```

## 実装スコープ

### ファイル

| ファイル | 変更内容 |
|---|---|
| `index.ts` | compactionフック拡張: role状態をContext-Mode形式で注入 |
| `index.ts` | `chat.system.transform` フック追加: 次セッションに役割注入 |
| `memory.ts` | `formatContinuation()` 新規: 復元用プロンプト生成 |
| `types.ts` | `ContinueState` 型追加 |
| `memory.test.ts` | `formatContinuation()` のテスト追加 |
| `README.md` | v1.1機能のドキュメント追加 |
| `CHANGELOG.md` | v1.1リリースノート |

### 型追加

```typescript
// types.ts に追加
export interface ContinueState {
  role: Role
  handoff_from?: string
  handoff_to?: string
  last_action: string
  ng_count: number
  confirmed_scope: string[]
  excluded_scope: string[]
  decisions_summary: string
  ng_summary: string
}
```

### 関数追加

```typescript
// memory.ts に追加
export function formatContinuation(
  role: Role,
  entry: MemoryEntry | null,
): string {
  if (!entry) return ""

  const decisions = entry.previous_decisions.slice(-3).join("; ")

  return [
    "## Team Continuation",
    "",
    `### Your Role: ${role}`,
    entry.handoff_to ? `### Handoff → ${entry.handoff_to}` : "",
    entry.ng_history.length > 0
      ? `### Recent NG Items (${entry.ng_history.length})\n${entry.ng_history.slice(-2).join("\n")}`
      : "",
    `### Critical Context\n${decisions}`,
    ``,
    "### Instructions",
    `1. role_memory_load(role="${role}") before starting`,
    "2. Resume based on handoff state above",
    "",
  ].filter(Boolean).join("\n")
}
```

### フック追加

```typescript
// index.ts に追加

// compaction 時に役割状態を Context-Mode に渡す
"experimental.session.compacting": async (_input, output) => {
  for (const role of ALL_ROLES) {
    const entry = await load(role)
    if (entry) {
      output.context.push(formatCompact(entry))
      // Context-Mode 互換: FTS5 インデックス用の構造化データ
      output.context.push(
        JSON.stringify({
          source: "opencode-team-memory",
          role: entry.role,
          handoff_to: entry.handoff_to,
          ng_count: entry.ng_history.length,
          decisions: entry.previous_decisions.slice(-3),
        })
      )
    }
  }
},

// 次セッション開始時に役割注入
"experimental.chat.system.transform": async (_input, output) => {
  const states: ContinueState[] = []
  for (const role of ALL_ROLES) {
    const entry = await load(role)
    if (entry) {
      states.push({
        role,
        handoff_to: entry.handoff_to,
        last_action: entry.raw_entries.slice(-1)[0] || "unknown",
        ng_count: entry.ng_history.length,
        confirmed_scope: entry.confirmed_scope,
        excluded_scope: entry.excluded_scope,
        decisions_summary: entry.previous_decisions.slice(-3).join("; "),
        ng_summary: entry.ng_history.slice(-2).join("; "),
      })
    }
  }

  if (states.length > 0) {
    // 最も最近更新されたロールを現在のロールとみなす
    output.transform = (systemPrompt: string) => {
      const block = states.map(s => formatContinuation(s.role, null))
        .filter(Boolean).join("\n\n")
      return `${systemPrompt}\n\n${block}`
    }
  }
}
```

## テスト計画

```typescript
// memory.test.ts 追加

describe("formatContinuation", () => {
  test("generates continuation prompt with handoff", () => {
    const entry = makeEntry({
      role: "engineer",
      handoff_to: "tester",
      ng_history: ["login redirect broken", "token expiry too short"],
      previous_decisions: ["use postgres", "adopt JWT", "add rate limit"],
    })
    const out = formatContinuation("engineer", entry)
    expect(out).toContain("engineer")
    expect(out).toContain("→ tester")
    expect(out).toContain("login redirect broken")
    expect(out).toContain("rate limit")
  })

  test("returns empty for null entry", () => {
    expect(formatContinuation("engineer", null)).toBe("")
  })

  test("no handoff when empty", () => {
    const entry = makeEntry({ role: "tester", handoff_to: "" })
    const out = formatContinuation("tester", entry)
    expect(out).not.toContain("Handoff →")
  })

  test("no NG section when no NG history", () => {
    const entry = makeEntry({ role: "designer", ng_history: [] })
    const out = formatContinuation("designer", entry)
    expect(out).not.toContain("NG Items")
  })
})
```

## バージョン

`opencode-team-memory@1.1.0` (MINOR)

## 前提条件

- RTK 導入済み
- Context-Mode 導入済み
- opencode-team-memory v1.0.0 導入済み
- opencode 再起動後に3点セットの動作確認が取れていること

## 事前動作確認手順

### 1. opencode 再起動

```bash
opencode
```

### 2. Context-Mode 動作確認

TUI内で:

```
ctx stats
```

**期待出力**: トークン節約量、ツール別内訳が表示される。  
表示されなければ Context-Mode 未導入または AGENTS.md 未反映。

### 3. RTK 動作確認

別ターミナルで:

```bash
rtk gain
```

**期待出力**: `No tracking data yet`（初回は未使用なのでこれで正常。インストールは完了している）

実際の動作確認は opencode 内で `git status` を実行し、出力が短くなっていることで判断する。  
出力が通常通り長い場合は `rtk init -g --opencode` を再実行。

### 4. team-memory ツール確認

TUI内で Agent に以下を入力:

```
role_memory_saveとrole_memory_loadというツールは使えるか？
```

Agent がツールを認識して呼び出せるかで判断する。  
認識されない場合は `.opencode/plugins/` のシンボリックリンクと `opencode.json` の `plugin` 配列を確認。

### 判定基準

| # | 確認項目 | OK条件 |
|---|---|---|
| 2 | Context-Mode | `ctx stats` が応答する |
| 3 | RTK | `rtk gain` が実行できる（tracking data ゼロでもOK） |
| 4 | team-memory | Agent が `role_memory_*` ツールを認識する |

3点すべて OK → v1.1 実装着手。
