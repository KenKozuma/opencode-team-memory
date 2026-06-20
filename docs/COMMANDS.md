# コマンドリファレンス

## opencode-team-memory

### TUI カスタムコマンド

| コマンド | 動作 | 即時反映 |
|---|---|---|
| `/preflight` | RTK / Context-Mode / team-memory の導入状態をチェック | ✅ |
| `/memory-off` | プラグインを無効化（マーカーファイル作成） | ❌ 要 `opencode` 再起動 |
| `/memory-on` | プラグインを有効化（マーカーファイル削除） | ❌ 要 `opencode` 再起動 |

### 詳細

#### `/preflight`

```bash
bash $(npm root -g)/opencode-team-memory/scripts/preflight.sh
```

実行時点の状態を表示。以下を確認:

| チェック | OK条件 |
|---|---|
| RTK binary | `brew install rtk` 済み |
| RTK version | `rtk --version` が応答 |
| Context-Mode npm | `npm ls -g context-mode` 成功 |
| Context-Mode CLI | `context-mode` コマンド存在 |
| team-memory npm | `npm ls -g opencode-team-memory` 成功 |
| team-memory config | `~/.config/opencode/opencode.json` に plugin 登録あり |
| メモリ分離 | `OPENCODE_TEAM_MEMORY_DIR` 未設定（プロジェクト単位） |
| opencode.json | プロジェクトに設定ファイルあり |

#### `/memory-off`

```bash
touch .omo/.team-memory-disabled
```

`<project>/.omo/.team-memory-disabled` を作成。次回 opencode 起動時、プラグインがこのファイルを検出し、全ツール・フックを登録せずに終了する。

- メモリデータ（`.omo/team-memory/`）は削除されない
- 別プロジェクトには影響しない

#### `/memory-on`

```bash
rm -f .omo/.team-memory-disabled
```

マーカーファイルを削除。次回 opencode 起動時、プラグインが通常通り全ツール・フックを登録する。

- `-f` はファイルが存在しない場合のエラー抑制

---

## RTK

### CLI

```bash
rtk --version    # バージョン確認
rtk gain         # トークン節約統計
rtk gain --graph # 過去30日の節約グラフ
rtk discover     # 未最適化コマンドの検出
```

### OpenCode 統合

```bash
rtk init -g --opencode    # グローバルプラグインとして登録
rtk init -g --uninstall   # 削除
```

登録後、Agent が実行する bash コマンドが自動的に `rtk` でラップされる（例: `git status` → `rtk git status`）。

---

## Context-Mode

### CLI

```bash
context-mode --version  # バージョン確認
context-mode upgrade    # 最新に更新
context-mode doctor     # 診断
```

### TUI コマンド

| コマンド | 動作 |
|---|---|
| `ctx stats` | トークン節約量・ツール別内訳 |
| `ctx doctor` | 診断（ランタイム・フック・FTS5） |
| `ctx upgrade` | 最新版に更新 |
| `ctx purge` | 全インデックス削除 |
| `ctx search <query>` | 保存されたコンテキストを検索 |

### OpenCode 統合

```jsonc
// opencode.json
{ "plugin": ["context-mode"] }
```

```bash
# AGENTS.md をコピー（ルーティングルール）
cp "$(npm root -g)/context-mode/configs/opencode/AGENTS.md" AGENTS.md
```

---

## インストール手順（新規プロジェクト）

```bash
# 1. RTK
brew install rtk
rtk init -g --opencode

# 2. Context-Mode
npm install -g context-mode

# 2a. opencode.json に追加
echo '{ "plugin": ["opencode-team-memory", "context-mode"] }' > opencode.json

# 2b. AGENTS.md コピー
cp "$(npm root -g)/context-mode/configs/opencode/AGENTS.md" AGENTS.md

# 3. team-memory
npm install -g opencode-team-memory

# 3a. グローバル設定に追加（初回のみ）
# ~/.config/opencode/opencode.json の plugin 配列に "opencode-team-memory" を追加

# 4. 確認
opencode  # 起動
/preflight

# 4a. TUI内で
ctx stats
# Agentに「role_memory_save」と言ってツール認識を確認
```
