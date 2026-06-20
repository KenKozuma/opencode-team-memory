# Pseudo Self-Learning: Best Effort 設計

## 実装状態: ✅ 完了 (v1.3.1)

| 機能 | 実装箇所 |
|---|---|
| 意味記憶 (判断・NG履歴) | role_memory_save/load (v1.0.0) |
| エピソード記憶 (FTS5全文検索) | Context-Mode + compaction hook JSON metadata (v1.1.0) |
| 手続き記憶 (自発的検索指示) | Director Agent prompt (v1.3.1) |
| 参照カウント追跡 | role_memory_reference (v1.3.0) |
| ホットパターン検出 | role_memory_hot_patterns (v1.3.0) |
| スキル自動生成 | omo-skill-generate (v1.3.0) |

## ゴール

Hermes の自己学習（経験→スキル自動生成）を Context-Mode + team-memory で擬似的に再現する。

## 戦略: 3層の記憶

```
Layer 1: team-memory (意味記憶)
  role_memory_save/load → 役割別の判断・NG履歴・スコープ

Layer 2: Context-Mode (エピソード記憶)
  ctx_search → 過去セッションの全文検索
  ctx_index  → 重要な発見を FTS5 に登録

Layer 3: Director Prompt (手続き記憶)
  「問題が発生したら、まず ctx_search で過去の類似事例を探せ」
```

## 実装

### 1. Director Prompt 拡張

```markdown
## Self-Improvement Protocol

### Before EVERY task delegation:
1. ctx_search("similar error or pattern") 
   → find past solutions from FTS5 index
2. role_memory_load(role="target_role")
   → check NG history for repeated issues
3. If past solution found: include it in task prompt
4. If no past solution: note as "first encounter"

### After task completion:
1. If task FAILED:
   → ctx_index THE SOLUTION once it's found
   → Format: "SOLUTION: [problem] → [root cause] → [fix]"

2. If task SUCCEEDED with new pattern:
   → ctx_index THE PATTERN
   → Format: "PATTERN: [what] → [how] → [where applied]"

### Learning over time:
- Day 1: ctx_index("PATTERN: auth JWT best practice is...")
- Day 5: ctx_search("JWT") → hits Day 1's pattern
- Day 5: Director uses past pattern, saves time
```

### 2. Context-Mode 連携ツール追加

`role_memory_save` 呼び出し時に自動で Context-Mode にもインデックスする:

```typescript
// index.ts role_memory_save の execute に追加
async execute(args) {
  const m = await save(args as SaveInput)

  // Context-Mode FTS5 にもインデックス (best-effort)
  try {
    const { execSync } = await import("node:child_process")
    const meta = JSON.stringify({
      role: m.role,
      handoff_to: m.handoff_to,
      decisions: m.previous_decisions.slice(-3),
      ng: m.ng_history.slice(-2),
    })
    execSync(`context-mode ctx_index --source "team-memory-${m.role}"`, {
      input: meta,
      timeout: 2000,
    })
  } catch {
    // Context-Mode not available — skip silently
  }

  return formatSaveResult(m)
}
```

### 3. 評価指標

```
自己学習の成熟度:

Day 1: Director「初めてのJWTエラー。手探りで修正」
       → ctx_index("SOLUTION: JWT expiry → check clock skew → use NTP")

Day 5: Director「JWTエラー。ctx_search("JWT expiry")」
       → 「Day 1の解決策: clock skew → NTP。それを試す」
       → 自律的に過去の解決策を再利用

Day 20: Director「JWT関連の問題はすべて clock skew パターン。
         今後は自動でチェックするルールとして保存」
       → ctx_index("RULE: always check clock skew before JWT debugging")
```

## 実装ファイル

| ファイル | 変更 | 行数 |
|---|---|---|
| `.opencode/agents/director.md` | Self-Improvement Protocol 追加 | +30行 |
| `index.ts` | role_memory_save に ctx_index 連携 | +15行 |
| `docs/SELF-LEARNING.md` | 設計ドキュメント | このファイル |

## 限界

```
できないこと:
  ✗ 経験からの自律的スキル生成（Hermes の中核）
  ✗ 人間の介入なしでの判断改善
  ✗ 未知の問題に対する推論ベースの解決

できること:
  ✓ 過去の解決策の検索と再利用
  ✓ NGパターンの蓄積と自動参照
  ✓ 成功パターンの FTS5 登録による知識ベース構築
  ✓ 時間経過で価値が上がる（データが増えるほど検索ヒット率向上）
```
