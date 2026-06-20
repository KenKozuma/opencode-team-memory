# 方式4: Director Auto-Orchestration 実装計画

## 背景

Director Agent の prompt と team-memory の全ツールは揃っているが、
**自律ハンドオフを自動化するツールがない。**
現状、Director は手動で `task()` を呼び、役割切替を人間が判断する必要がある。

## ゴール

```
人間: 「JWT認証を実装して」
  → Director が自動で:
    engineer → (実装) → tester → (検証: NG?) → engineer → (修正) → tester → (OK)
    → 完了報告
  ↑ 間、人間の介在ゼロ
```

## 未実装の機能

| # | 機能 | 状態 |
|---|---|---|
| 1 | Director prompt | ✅ v1.3.1 |
| 2 | role_memory_resume (状態復元) | ✅ v1.2.1 |
| 3 | role_memory_save/load (文脈永続化) | ✅ v1.0.0 |
| 4 | **role_delegate** ツール (自律handoff) | ❌ |
| 5 | **Auto-loop** (全タスク完了まで周回) | ❌ |

## 実装スコープ

### 1. role_delegate ツール

```typescript
role_delegate: tool({
  description: "Auto-delegate to next role based on handoff state. Reads saved memory, identifies target, creates task. Returns result for Director to evaluate.",
  args: {
    from_role: tool.schema.enum(ALL_ROLES),
  },
  async execute(args) {
    // 1. from_role の context.json を読み取る
    const entry = await load(args.from_role)
    if (!entry || !entry.handoff_to) {
      return "No handoff target. Work may be complete. Check all roles."
    }

    // 2. 次のロールの Role Skill を取得
    const skillPrompt = await loadRoleSkill(entry.handoff_to)

    // 3. タスクプロンプトを生成
    const taskPrompt = buildTaskPrompt(entry, skillPrompt)

    // 4. subagent を起動して委譲
    //    ※ OpenCode plugin から task() を直接呼べない制約がある場合、
    //       プロンプト文字列を返して Director に task() を促す方式にフォールバック
    return {
      target_role: entry.handoff_to,
      task_prompt: taskPrompt,
      instruction: `Call task() with this prompt for role '${entry.handoff_to}'`
    }
  },
})
```

### 2. Director Auto-Loop プロンプト拡張

```markdown
## Auto-Orchestration Loop

### On every task completion:
1. role_memory_save(current_role, handoff_to=next_role, raw=summary)
2. role_delegate(from_role=current_role)
3. Execute the returned task
4. GOTO 1

### Stop conditions:
- No handoff_to in any role → work complete → report to user
- 10 cycles without NG resolution → report blocked to user
- User interrupts

### NEVER:
- Ask user "what should I delegate next?"
- Stop mid-loop without reporting status
```

### 3. Role Skills

```bash
.opencode/skills/
├── engineer/SKILL.md   # 実装のみ。テスト不可。仕様判断不可
├── tester/SKILL.md     # 検証のみ。修正不可。NG は engineer に戻す
├── designer/SKILL.md   # UI/UX レビューのみ。実装不可
└── director/SKILL.md   # 統括 + 上記 loop 実行
```

## 実装ファイル

| ファイル | 内容 | 行数 |
|---|---|---|
| `index.ts` | `role_delegate` ツール追加 | +50行 |
| `memory.ts` | `buildTaskPrompt()` 追加 | +20行 |
| `.opencode/skills/engineer/SKILL.md` | 新規 | +15行 |
| `.opencode/skills/tester/SKILL.md` | 新規 | +15行 |
| `.opencode/skills/designer/SKILL.md` | 新規 | +15行 |
| `.opencode/agents/director.md` | auto-loop prompt 追加 | +25行 |
| `memory.test.ts` | `buildTaskPrompt()` のテスト | +2ケース |

## 実装上の制約と対策

| 制約 | 対策 |
|---|---|
| OpenCode plugin から `task()` を直接呼べない | `role_delegate` がタスクプロンプトを返し、Director が `task()` を呼ぶ方式 |
| subagent 間の直接通信不可 | team-memory の save/load で間接通信（既存） |
| Director が loop から抜けられないリスク | 最大10サイクル制限 + 人間割り込み |

## テスト計画

```
手動テスト:
  1. Director promptでエンジニアリングタスクを与える
  2. role_delegate → engineer のタスクプロンプトが生成されるか
  3. task(prompt) で engineer subagent が起動するか
  4. engineer が role_memory_save(handoff_to="tester") するか
  5. 再度 role_delegate → tester が検出されるか
  6. 5サイクル実行 → 完了報告まで届くか

単体テスト:
  - buildTaskPrompt: handoff_toあり/なし
  - buildTaskPrompt: NG履歴を含む場合
```

## バージョン

`opencode-team-memory@1.4.0` (MINOR: `role_delegate` ツール追加)
