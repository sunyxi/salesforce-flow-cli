# 新機能の使用例 / New Features Usage Examples

## 1. 指定バージョンでのフロー有効化 / Activate Flows with Specific Version

### 基本的な使用方法 / Basic Usage

```bash
# 単一のフローを指定バージョンで有効化
# Activate a single flow with specific version
sf-flow activate MyFlow --version 3

# ファイルから各フローに異なるバージョンを指定して有効化
# Activate flows with different versions from file
sf-flow batch-activate -f flows.txt
```

### ファイル形式 / File Formats

#### テキストファイル (.txt)
```text
# 各フローに異なるバージョンを指定
# Specify different versions for each flow
MyScreenFlow:3
MyAutoFlow:5
RecordTriggeredFlow:2

# バージョン未指定のフローは最新版を使用
# Flows without version will use latest
ScheduledFlow
```

#### JSON ファイル (.json)
```json
{
  "flows": [
    { "name": "MyScreenFlow", "version": 3 },
    { "name": "MyAutoFlow", "version": 5 },
    { "name": "RecordTriggeredFlow", "version": 2 },
    { "name": "ScheduledFlow" }
  ]
}
```

### グローバルバージョンとの組み合わせ / Combining with Global Version

```bash
# ファイル内で指定されたバージョンを優先、
# 未指定のフローには --version を適用
# File versions take priority, --version applies to unspecified flows
sf-flow batch-activate -f flows.txt --version 4
```

この場合:
- MyScreenFlow → v3 (ファイルで指定 / specified in file)
- MyAutoFlow → v5 (ファイルで指定 / specified in file)
- RecordTriggeredFlow → v2 (ファイルで指定 / specified in file)
- ScheduledFlow → v4 (--version で指定 / specified by --version)

### ユースケース / Use Cases

1. **ロールバック / Rollback**
   ```bash
   # 問題が発生した場合、以前のバージョンに戻す
   # Roll back to previous version if issues occur
   sf-flow batch-activate --flows MyFlow --version 2
   ```

2. **段階的デプロイ / Staged Deployment**
   ```bash
   # 本番環境で特定のバージョンをデプロイ
   # Deploy specific version to production
   sf-flow batch-activate -f production-flows.txt --version 5 --production
   ```

3. **テスト環境での検証 / Testing in Sandbox**
   ```bash
   # サンドボックスで特定バージョンをテスト
   # Test specific version in sandbox
   sf-flow batch-activate -f test-flows.txt --version 4 --sandbox
   ```

## 2. 有効バージョンの一括取得 / Batch Get Active Versions

### 基本的な使用方法 / Basic Usage

```bash
# すべてのフローの有効バージョンを取得
# Get active versions of all flows
sf-flow get-active-versions --all

# 特定のフローの有効バージョンを取得
# Get active versions of specific flows
sf-flow get-active-versions Flow1 Flow2 Flow3

# ファイルから読み込んで取得
# Get from file
sf-flow get-active-versions -f flows.txt
```

### 出力フォーマット / Output Formats

1. **テーブル形式 (デフォルト) / Table Format (Default)**
   ```bash
   sf-flow get-active-versions --all --format table
   ```
   出力例 / Example output:
   ```
   Name                  | Active | Latest | Status
   ---------------------------------------------------
   MyScreenFlow          |      3 |      3 | ✓  
   MyAutoFlow            |      2 |      4 | ✓ ⚠
   RecordTriggeredFlow   |      0 |      2 | ✗  
   ```

2. **シンプル形式 / Simple Format**
   ```bash
   sf-flow get-active-versions --all --format simple
   ```
   出力例 / Example output:
   ```
   MyScreenFlow: v3
   MyAutoFlow: v2
   RecordTriggeredFlow: v0
   ```

3. **詳細形式 / Detailed Format**
   ```bash
   sf-flow get-active-versions --all --format detailed
   ```

4. **JSON形式 / JSON Format**
   ```bash
   sf-flow get-active-versions --all --format json -o versions.json
   ```

5. **CSV形式 / CSV Format**
   ```bash
   sf-flow get-active-versions --all --format csv -o versions.csv
   ```

### フィルタリング / Filtering

1. **有効なフローのみ / Active Flows Only**
   ```bash
   sf-flow get-active-versions --all --status active
   ```

2. **無効なフローのみ / Inactive Flows Only**
   ```bash
   sf-flow get-active-versions --all --status inactive
   ```

3. **更新可能なフローのみ / Flows with Updates Available**
   ```bash
   sf-flow get-active-versions --all --updates-available
   ```

### ユースケース / Use Cases

1. **バージョン監査 / Version Audit**
   ```bash
   # すべてのフローのバージョン情報をエクスポート
   # Export version information for all flows
   sf-flow get-active-versions --all -o audit-$(date +%Y%m%d).csv --format csv
   ```

2. **更新が必要なフローの特定 / Identify Flows Needing Updates**
   ```bash
   # 更新可能なフローをリストアップ
   # List flows with available updates
   sf-flow get-active-versions --all --updates-available --format simple
   ```

3. **環境間の比較 / Compare Between Environments**
   ```bash
   # 本番環境のバージョン情報を保存
   # Save production versions
   sf-flow get-active-versions --all -o prod-versions.json --production
   
   # サンドボックスのバージョン情報を保存
   # Save sandbox versions
   sf-flow get-active-versions --all -o sandbox-versions.json --sandbox
   
   # 手動で比較
   # Compare manually
   ```

4. **デプロイ前の確認 / Pre-deployment Verification**
   ```bash
   # デプロイ前に現在のバージョンを記録
   # Record current versions before deployment
   sf-flow get-active-versions -f deployment-flows.txt -o pre-deploy.json
   
   # デプロイ実行
   # Execute deployment
   sf-flow batch-activate -f deployment-flows.txt --version 5
   
   # デプロイ後の確認
   # Verify after deployment
   sf-flow get-active-versions -f deployment-flows.txt -o post-deploy.json
   ```

## 3. 組み合わせ例 / Combined Examples

### ワークフロー例 1: 安全なデプロイ / Workflow Example 1: Safe Deployment

```bash
# 1. 現在のバージョンを記録
# Record current versions
sf-flow get-active-versions -f flows.txt -o backup-versions.json

# 2. ドライランで確認
# Dry run to verify
sf-flow batch-activate -f flows.txt --version 3 --dry-run --show-status

# 3. 実際にデプロイ
# Execute deployment
sf-flow batch-activate -f flows.txt --version 3 --report deploy-report.json

# 4. デプロイ後の確認
# Verify after deployment
sf-flow get-active-versions -f flows.txt --format detailed
```

### ワークフロー例 2: 更新管理 / Workflow Example 2: Update Management

```bash
# 1. 更新が必要なフローを特定
# Identify flows needing updates
sf-flow get-active-versions --all --updates-available -o needs-update.txt --format simple

# 2. 更新可能なフローを確認
# Review flows that can be updated
sf-flow get-active-versions -f needs-update.txt --format detailed

# 3. 最新バージョンに更新
# Update to latest version
sf-flow batch-activate -f needs-update.txt

# 4. 更新結果を確認
# Verify update results
sf-flow get-active-versions -f needs-update.txt --format table
```

### ワークフロー例 3: 環境同期 / Workflow Example 3: Environment Sync

```bash
# 1. 本番環境のバージョンを取得
# Get production versions
sf-flow get-active-versions --all -o prod.json --production

# 2. サンドボックスで同じバージョンを設定
# Set same versions in sandbox
# (手動で prod.json を確認して必要なバージョンを特定)
# (Manually review prod.json to identify required versions)

# 3. サンドボックスで特定バージョンを有効化
# Activate specific versions in sandbox
sf-flow batch-activate -f flows.txt --version 3 --sandbox

# 4. 確認
# Verify
sf-flow get-active-versions -f flows.txt --sandbox
```

## 4. トラブルシューティング / Troubleshooting

### バージョンが見つからない / Version Not Found

```bash
# エラー: Flow does not have version X
# 利用可能なバージョンを確認
# Check available versions
sf-flow get-active-versions MyFlow --format detailed
```

### システムコンテキストの制限 / System Context Restrictions

```bash
# 一部のフローは API 経由で有効化できません
# Some flows cannot be activated via API
# 代わりに URL を生成して手動で有効化
# Generate URLs for manual activation instead
sf-flow generate-urls RecordTriggeredFlow
```

## 5. ベストプラクティス / Best Practices

1. **常にバックアップを取る / Always Take Backups**
   ```bash
   sf-flow get-active-versions --all -o backup-$(date +%Y%m%d).json
   ```

2. **ドライランを使用 / Use Dry Run**
   ```bash
   sf-flow batch-activate -f flows.txt --version 3 --dry-run
   ```

3. **詳細なレポートを保存 / Save Detailed Reports**
   ```bash
   sf-flow batch-activate -f flows.txt --report deploy-report.json
   ```

4. **段階的にデプロイ / Deploy Incrementally**
   ```bash
   # まずサンドボックスでテスト
   # Test in sandbox first
   sf-flow batch-activate -f flows.txt --version 3 --sandbox
   
   # 次に本番環境
   # Then production
   sf-flow batch-activate -f flows.txt --version 3 --production --force
   ```

5. **定期的な監査 / Regular Audits**
   ```bash
   # 週次でバージョン情報をエクスポート
   # Export version info weekly
   sf-flow get-active-versions --all -o weekly-audit-$(date +%Y%m%d).csv --format csv
   ```
