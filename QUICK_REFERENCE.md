# クイックリファレンス / Quick Reference

## 新機能の使い方 / How to Use New Features

### 📌 個別バージョン指定 / Individual Version Specification

#### flows.txt の書き方 / How to Write flows.txt

```text
# コメント / Comments
FlowName1:3          # バージョン 3 を指定 / Specify version 3
FlowName2:5          # バージョン 5 を指定 / Specify version 5
FlowName3            # 最新版を使用 / Use latest version
```

#### 実行 / Execute

```bash
sf-flow batch-activate -f flows.txt
```

### 📊 有効バージョン取得 / Get Active Versions

#### すべての Flow / All Flows

```bash
sf-flow get-active-versions --all
```

#### CSV にエクスポート / Export to CSV

```bash
sf-flow get-active-versions --all -o versions.csv --format csv
```

#### 更新可能な Flow のみ / Only Flows with Updates

```bash
sf-flow get-active-versions --all --updates-available
```

## よくある使用パターン / Common Usage Patterns

### パターン 1: 各 Flow に異なるバージョンを指定してデプロイ
### Pattern 1: Deploy with Different Versions for Each Flow

```bash
# 1. flows.txt を作成
cat > flows.txt << EOF
AccountFlow:3
ContactFlow:5
OpportunityFlow:2
EOF

# 2. デプロイ
sf-flow batch-activate -f flows.txt --report deploy.json

# 3. 確認
sf-flow get-active-versions -f flows.txt
```

### パターン 2: 現在のバージョンをバックアップしてからデプロイ
### Pattern 2: Backup Current Versions Before Deployment

```bash
# 1. バックアップ
sf-flow get-active-versions --all -o backup.json

# 2. デプロイ
sf-flow batch-activate -f flows.txt

# 3. 問題があればバックアップから復元
# If issues, restore from backup (manually create flows.txt from backup.json)
```

### パターン 3: 更新が必要な Flow を特定して更新
### Pattern 3: Identify and Update Flows Needing Updates

```bash
# 1. 更新可能な Flow を確認
sf-flow get-active-versions --all --updates-available

# 2. 必要に応じて flows.txt を作成

# 3. 最新版に更新
sf-flow batch-activate -f flows.txt
```

## ファイル形式早見表 / File Format Quick Reference

### テキストファイル / Text File

```text
FlowName1:3
FlowName2:5
FlowName3
```

### JSON ファイル / JSON File

```json
{
  "flows": [
    { "name": "FlowName1", "version": 3 },
    { "name": "FlowName2", "version": 5 },
    { "name": "FlowName3" }
  ]
}
```

## コマンド早見表 / Command Quick Reference

| コマンド / Command | 説明 / Description |
|-------------------|-------------------|
| `sf-flow batch-activate -f flows.txt` | ファイルから Flow を有効化 / Activate flows from file |
| `sf-flow batch-activate -f flows.txt --version 3` | グローバルバージョン指定 / Specify global version |
| `sf-flow batch-activate -f flows.txt --dry-run` | ドライラン / Dry run |
| `sf-flow get-active-versions --all` | すべての Flow のバージョンを取得 / Get all flow versions |
| `sf-flow get-active-versions -f flows.txt` | 特定の Flow のバージョンを取得 / Get specific flow versions |
| `sf-flow get-active-versions --all --updates-available` | 更新可能な Flow を表示 / Show flows with updates |
| `sf-flow get-active-versions --all -o out.csv --format csv` | CSV にエクスポート / Export to CSV |

## トラブルシューティング / Troubleshooting

### Q: バージョンが見つからないエラー
### Q: Version not found error

```bash
# 利用可能なバージョンを確認
# Check available versions
sf-flow get-active-versions FlowName --format detailed
```

### Q: ファイル形式のエラー
### Q: File format error

```bash
# ファイルの内容を確認
# Check file contents
cat flows.txt

# 正しい形式:
# Correct format:
# FlowName:Version または FlowName
# FlowName:Version or FlowName
```

### Q: 一部の Flow が有効化できない
### Q: Some flows cannot be activated

```bash
# ドライランで確認
# Check with dry run
sf-flow batch-activate -f flows.txt --dry-run --show-status

# システムコンテキスト Flow は UI で有効化が必要
# System context flows need UI activation
sf-flow generate-urls FlowName
```

## ベストプラクティス / Best Practices

1. ✅ **常にバックアップを取る / Always backup**
   ```bash
   sf-flow get-active-versions --all -o backup-$(date +%Y%m%d).json
   ```

2. ✅ **ドライランで確認 / Verify with dry run**
   ```bash
   sf-flow batch-activate -f flows.txt --dry-run
   ```

3. ✅ **レポートを保存 / Save reports**
   ```bash
   sf-flow batch-activate -f flows.txt --report deploy-report.json
   ```

4. ✅ **段階的にデプロイ / Deploy incrementally**
   - サンドボックスでテスト / Test in sandbox
   - 本番環境にデプロイ / Deploy to production

5. ✅ **定期的な監査 / Regular audits**
   ```bash
   sf-flow get-active-versions --all -o audit-$(date +%Y%m%d).csv --format csv
   ```
