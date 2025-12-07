# 新機能概要 / New Features Summary

## 実装された機能 / Implemented Features

### 1. 個別バージョン指定機能 / Individual Version Specification

各 Flow に異なるバージョンを指定できるようになりました。

#### サポートされるファイル形式 / Supported File Formats

**テキストファイル (.txt)**
```text
FlowName1:3
FlowName2:5
FlowName3:2
FlowName4
```

**JSON ファイル (.json)**
```json
{
  "flows": [
    { "name": "FlowName1", "version": 3 },
    { "name": "FlowName2", "version": 5 },
    { "name": "FlowName3", "version": 2 },
    { "name": "FlowName4" }
  ]
}
```

#### 使用例 / Usage Examples

```bash
# ファイルから各 Flow に指定されたバージョンで有効化
# Activate flows with versions specified in file
sf-flow batch-activate -f flows.txt

# グローバルバージョンをフォールバックとして使用
# Use global version as fallback
sf-flow batch-activate -f flows.txt --version 4
```

**動作:**
- ファイル内でバージョンが指定された Flow: そのバージョンを使用
- バージョン未指定の Flow: 
  - `--version` オプションがある場合: そのバージョンを使用
  - `--version` オプションがない場合: 最新バージョンを使用

### 2. 有効バージョン一括取得機能 / Batch Get Active Versions

複数の Flow の現在有効なバージョンを一括で取得できます。

#### 基本コマンド / Basic Commands

```bash
# すべての Flow の有効バージョンを取得
# Get active versions of all flows
sf-flow get-active-versions --all

# 特定の Flow の有効バージョンを取得
# Get active versions of specific flows
sf-flow get-active-versions Flow1 Flow2 Flow3

# ファイルから Flow を読み込んで取得
# Get from file
sf-flow get-active-versions -f flows.txt
```

#### 出力形式 / Output Formats

1. **テーブル形式 (デフォルト) / Table Format (Default)**
   ```bash
   sf-flow get-active-versions --all
   ```

2. **シンプル形式 / Simple Format**
   ```bash
   sf-flow get-active-versions --all --format simple
   ```

3. **詳細形式 / Detailed Format**
   ```bash
   sf-flow get-active-versions --all --format detailed
   ```

4. **JSON 形式 / JSON Format**
   ```bash
   sf-flow get-active-versions --all --format json -o versions.json
   ```

5. **CSV 形式 / CSV Format**
   ```bash
   sf-flow get-active-versions --all --format csv -o versions.csv
   ```

#### フィルタリングオプション / Filtering Options

```bash
# 有効な Flow のみ / Active flows only
sf-flow get-active-versions --all --status active

# 無効な Flow のみ / Inactive flows only
sf-flow get-active-versions --all --status inactive

# 更新可能な Flow のみ / Flows with updates available
sf-flow get-active-versions --all --updates-available
```

## 実用的なワークフロー / Practical Workflows

### ワークフロー 1: バージョン管理されたデプロイ / Version-Controlled Deployment

```bash
# 1. 現在のバージョンをバックアップ
# Backup current versions
sf-flow get-active-versions --all -o backup-$(date +%Y%m%d).json

# 2. デプロイ用ファイルを作成 (flows.txt)
# Create deployment file
cat > flows.txt << EOF
MyScreenFlow:3
MyAutoFlow:5
RecordTriggeredFlow:2
EOF

# 3. ドライランで確認
# Dry run to verify
sf-flow batch-activate -f flows.txt --dry-run --show-status

# 4. デプロイ実行
# Execute deployment
sf-flow batch-activate -f flows.txt --report deploy-report.json

# 5. 結果確認
# Verify results
sf-flow get-active-versions -f flows.txt --format detailed
```

### ワークフロー 2: 更新管理 / Update Management

```bash
# 1. 更新が必要な Flow を特定
# Identify flows needing updates
sf-flow get-active-versions --all --updates-available -o needs-update.csv --format csv

# 2. 更新計画を作成 (手動で CSV を確認して flows.txt を作成)
# Create update plan (manually review CSV and create flows.txt)

# 3. 段階的に更新
# Update incrementally
sf-flow batch-activate -f flows.txt

# 4. 結果確認
# Verify results
sf-flow get-active-versions -f flows.txt
```

### ワークフロー 3: 環境間同期 / Environment Synchronization

```bash
# 1. 本番環境のバージョンを取得
# Get production versions
sf-flow get-active-versions --all -o prod-versions.json --production --format json

# 2. JSON から flows.txt を生成 (スクリプトまたは手動)
# Generate flows.txt from JSON (script or manual)

# 3. サンドボックスで同じバージョンを設定
# Set same versions in sandbox
sf-flow batch-activate -f flows.txt --sandbox

# 4. 確認
# Verify
sf-flow get-active-versions --all --sandbox
```

## コマンドリファレンス / Command Reference

### batch-activate

```bash
sf-flow batch-activate [options]

Options:
  -f, --file <path>          ファイルから Flow を読み込み
  --use-config               設定ファイルから Flow を読み込み
  --flows <flows...>         追加の Flow を指定
  --version <number>         グローバルバージョン(未指定 Flow 用)
  --validate                 実行前に Flow の存在を確認
  --ignore-not-found         見つからない Flow を無視
  --dry-run                  変更せずに実行内容を表示
  --show-status              ドライラン時に現在の状態を表示
  --report <path>            詳細レポートを生成
  --continue-on-error        エラーがあっても続行
  --show-errors              詳細なエラーメッセージを表示
```

### batch-deactivate

```bash
sf-flow batch-deactivate [options]

Options:
  -f, --file <path>          ファイルから Flow を読み込み
  --use-config               設定ファイルから Flow を読み込み
  --flows <flows...>         追加の Flow を指定
  --validate                 実行前に Flow の存在を確認
  --ignore-not-found         見つからない Flow を無視
  --force                    本番環境での強制実行
  --dry-run                  変更せずに実行内容を表示
  --show-status              ドライラン時に現在の状態を表示
  --report <path>            詳細レポートを生成
  --continue-on-error        エラーがあっても続行
  --show-errors              詳細なエラーメッセージを表示
```

### get-active-versions

```bash
sf-flow get-active-versions [flows...] [options]

Options:
  -f, --file <path>          ファイルから Flow を読み込み
  --use-config               設定ファイルから Flow を読み込み
  --all                      組織内のすべての Flow を取得
  -s, --status <status>      ステータスでフィルタ (active, inactive)
  --updates-available        更新可能な Flow のみ表示
  --format <format>          出力形式 (table, simple, detailed, json, csv, txt)
  -o, --output <path>        結果をファイルにエクスポート
```

## 技術的な詳細 / Technical Details

### ファイル解析ロジック / File Parsing Logic

1. **テキストファイル (.txt, .csv)**
   - 各行を解析
   - `:` が含まれる場合: `FlowName:Version` として解析
   - `:` がない場合: Flow 名のみとして扱う
   - `#` で始まる行はコメントとして無視

2. **JSON ファイル (.json)**
   - `{ "name": "FlowName", "version": 3 }` 形式をサポート
   - `version` フィールドは省略可能
   - 配列形式または `{ "flows": [...] }` 形式をサポート

### バージョン優先順位 / Version Priority

1. ファイル内で指定されたバージョン (最優先)
2. `--version` オプションで指定されたグローバルバージョン
3. 最新バージョン (デフォルト)

### エラーハンドリング / Error Handling

- 無効なバージョン番号: 警告を表示してスキップ
- 存在しない Flow: `--validate` オプションで事前チェック可能
- API 制限: システムコンテキスト Flow は UI での有効化が必要

## 互換性 / Compatibility

- 既存の機能との完全な後方互換性
- 既存のファイル形式 (Flow 名のみ) も引き続きサポート
- 新しいファイル形式と既存形式の混在が可能

## 今後の拡張可能性 / Future Extensibility

- CSV ファイルでの詳細な Flow メタデータ管理
- バージョン間の差分表示機能
- 自動ロールバック機能
- スケジュールされたデプロイ機能
