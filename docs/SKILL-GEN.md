# omo-skill-generate

閾値超過した参照パターンを OpenCode Skill (SKILL.md) に自動変換するCLI。

## 使い方

```bash
# 特定ロールの全ホットパターンをスキル化
omo-skill-generate --role=engineer

# 特定パターンのみスキル化
omo-skill-generate --role=engineer --pattern="JWT clock skew"

# 全ロールのホットパターンをスキル化 (--all は将来実装)
```

## フロー

```
1. Agent: 過去の解決策を再利用
   → role_memory_reference(role="engineer", pattern_name="JWT clock skew", solution="use NTP sync")

2. 3回参照されると閾値到達
   → role_memory_reference が "🔥 Pattern reached threshold!" を返す

3. スキル生成
   $ omo-skill-generate --role=engineer --pattern="JWT clock skew"

4. .opencode/skills/jwt-clock-skew/SKILL.md が生成される
   → opencode 再起動で有効

5. Agent: @jwt-clock-skew で呼び出し可能
```

## 生成されるファイル例

```
.opencode/skills/jwt-clock-skew/
└── SKILL.md
```

```markdown
---
name: jwt-clock-skew
description: Auto-generated skill (3 references). JWT clock skew — use NTP sync
license: MIT
compatibility: opencode
metadata:
  source: opencode-team-memory
  role: engineer
  references: 3
---

# JWT clock skew

## Solution
use NTP sync to fix clock skew

## When to Use
This pattern has been validated 3 times by engineer.
```

## 閾値設定

デフォルト: 3回

`types.ts` の `SKILL_THRESHOLD` 定数を変更すれば調整可能。
