# omo-resume

前回のチーム状態を復元し、役割・handoff・NG履歴を含むプロンプトを生成して opencode を起動するCLIラッパー。

## 使い方

```bash
# opencode の代わりに使う
omo-resume

# 常に自動復元（確認なし）
omo-resume --always

# 毎回確認
omo-resume --ask

# 復元せず通常起動
omo-resume --never
```

## 動作

1. `.omo/team-memory/` から全ロールの `context.json` を読み取り
2. `last_updated` が最新のロールを特定
3. 復元プロンプトを生成（役割・handoff先・NG項目・判断・スコープ）
4. モードに応じて確認 or 自動で `opencode run` にプロンプトを渡す

## モード

| モード | 動作 |
|---|---|
| `--always` | 確認なしで自動復元 |
| `--ask` | 復元内容を表示し `[Y/n]` で確認（デフォルト） |
| `--never` | 通常の `opencode` を起動 |

環境変数 `OPENCODE_TEAM_CONTINUE` でデフォルトモードを変更可能:

```bash
export OPENCODE_TEAM_CONTINUE=always
```

## 出力例

```
========================================
 Team Continuation
========================================
 Role:     engineer
 Updated:  2026-06-20T18:30:00.000Z
 Mode:     ask
========================================

Resume with this context? [Y/n] y

# opencode が以下のプロンプトで起動
Resume team work as engineer.

## Team Continuation
### Your Role: engineer
### Handoff → tester
### Status: ng_count=2
### Critical Context
use postgres; adopt JWT; add rate limit
### Recent NG Items
- login redirect broken
- token expiry too short
### Confirmed Scope
- auth module
### Instructions
1. role_memory_load(role="engineer") to restore full context
2. Handoff target is 'tester'. Prepare accordingly.
3. Address NG items before handoff.
```

## エイリアス登録

```bash
# ~/.zshrc に追加
alias oc='omo-resume'
```

以降 `oc` でチーム状態を復元して opencode が起動する。
