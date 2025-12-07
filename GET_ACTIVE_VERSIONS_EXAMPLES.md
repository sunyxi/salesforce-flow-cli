# get-active-versions コマンドの使用例 / Usage Examples for get-active-versions

## 基本的な使い方 / Basic Usage

### 1. ファイルから Flow と目標バージョンを読み込む / Load Flows and Target Versions from File

**flows.txt:**
```text
MyScreenFlow:3
MyAutoFlow:5
RecordTriggeredFlow:2
ScheduledFlow
```

**コマンド / Command:**
```bash
sf-flow get-active-versions -f flows.txt
```

**出力例 / Example Output:**
```
📄 Loaded 4 flows from file: flows.txt
📌 3 flows have target versions specified
📊 Total unique flows to query: 4
🔍 Retrieving flow versions...

📋 Flow Versions:

Name                  | Active | Target | Latest | Status
----------------------------------------------------------------
MyScreenFlow          |      2 |      3 |      4 | ✓ ⚠
MyAutoFlow            |      5 |      5 |      6 | ✓  
RecordTriggeredFlow   |      1 |      2 |      3 | ✓ ⚠
ScheduledFlow         |      3 |      - |      3 | ✓  

Legend: ✓=Active ✗=Inactive ⚠=Needs update to target ℹ=Newer version available

📊 Summary:
   Total flows: 4
   Active: 4
   Inactive: 0
   Updates available: 2
   Needs update to target version: 2
```

## 出力形式 / Output Formats

### テーブル形式 (デフォルト) / Table Format (Default)

```bash
sf-flow get-active-versions -f flows.txt
```

### シンプル形式 / Simple Format

```bash
sf-flow get-active-versions -f flows.txt --format simple
```

**出力 / Output:**
```
MyScreenFlow: v2 (target: v3)
MyAutoFlow: v5 (target: v5)
RecordTriggeredFlow: v1 (target: v2)
ScheduledFlow: v3
```

### 詳細形式 / Detailed Format

```bash
sf-flow get-active-versions -f flows.txt --format detailed
```

**出力 / Output:**
```
📋 MyScreenFlow
   Label: My Screen Flow
   Status: Active
   Active Version: 2
   Target Version: 3
   ⚠ Needs update from v2 to v3!
   Latest Version: 4
   Description: Sample screen flow

📋 MyAutoFlow
   Label: My Auto Flow
   Status: Active
   Active Version: 5
   Target Version: 5
   ✓ Already at target version
   Latest Version: 6
```

### CSV エクスポート / CSV Export

```bash
sf-flow get-active-versions -f flows.txt -o versions.csv --format csv
```

**versions.csv:**
```csv
Name,Active Version,Target Version,Latest Version,Is Active,Has Updates,Needs Update,Label,Description
"MyScreenFlow",2,3,4,true,true,true,"My Screen Flow","Sample screen flow"
"MyAutoFlow",5,5,6,true,true,false,"My Auto Flow","Auto launched flow"
"RecordTriggeredFlow",1,2,3,true,true,true,"Record Trigger","Trigger flow"
"ScheduledFlow",3,,3,true,false,false,"Scheduled Flow","Runs daily"
```

### JSON エクスポート / JSON Export

```bash
sf-flow get-active-versions -f flows.txt -o versions.json --format json
```

**versions.json:**
```json
{
  "timestamp": "2025-12-07T14:35:00.000Z",
  "totalFlows": 4,
  "flows": [
    {
      "name": "MyScreenFlow",
      "activeVersion": 2,
      "latestVersion": 4,
      "targetVersion": 3,
      "isActive": true,
      "hasNewerVersion": true,
      "needsUpdate": true,
      "label": "My Screen Flow",
      "description": "Sample screen flow"
    },
    ...
  ]
}
```

## ユースケース / Use Cases

### ケース 1: デプロイ前の確認 / Pre-deployment Verification

```bash
# デプロイファイルと現在のバージョンを比較
# Compare deployment file with current versions
sf-flow get-active-versions -f deployment-flows.txt

# 更新が必要な Flow を特定
# Identify flows that need updates
# ⚠ マークがついている Flow を確認
# Check flows with ⚠ mark
```

### ケース 2: デプロイ後の検証 / Post-deployment Validation

```bash
# デプロイ後、目標バージョンと一致しているか確認
# After deployment, verify versions match targets
sf-flow get-active-versions -f deployment-flows.txt

# すべての Flow が目標バージョンになっていれば成功
# Success if all flows are at target version
# "Needs update to target version: 0" と表示される
# Should show "Needs update to target version: 0"
```

### ケース 3: バージョン監査 / Version Audit

```bash
# すべての Flow のバージョン情報を CSV にエクスポート
# Export all flow versions to CSV for audit
sf-flow get-active-versions --all -o audit-$(date +%Y%m%d).csv --format csv

# 特定の Flow のみを監査
# Audit specific flows only
sf-flow get-active-versions -f critical-flows.txt -o critical-audit.csv --format csv
```

### ケース 4: コマンドラインで直接指定 / Direct Command Line Specification

```bash
# コマンドラインで Flow と目標バージョンを指定
# Specify flows and target versions directly
sf-flow get-active-versions MyFlow1:3 MyFlow2:5 MyFlow3

# 出力 / Output:
# 📌 2 flows from command line have target versions specified
```

## ワークフロー例 / Workflow Example

### 完全なデプロイワークフロー / Complete Deployment Workflow

```bash
# 1. デプロイ前: 現在の状態を確認
# Before deployment: Check current state
sf-flow get-active-versions -f flows.txt

# 2. 更新が必要な Flow を確認
# Check which flows need updates
# (⚠ マークのある Flow を確認 / Check flows with ⚠ mark)

# 3. デプロイ実行
# Execute deployment
sf-flow batch-activate -f flows.txt

# 4. デプロイ後: 検証
# After deployment: Verify
sf-flow get-active-versions -f flows.txt

# 5. すべてが目標バージョンになっていることを確認
# Verify all flows are at target version
# "Needs update to target version: 0" を確認
# Check for "Needs update to target version: 0"
```

## Tips

### 目標バージョンと現在のバージョンの違いを確認 / Check Differences

```bash
# 詳細形式で確認すると、どの Flow が更新必要か一目瞭然
# Detailed format shows clearly which flows need updates
sf-flow get-active-versions -f flows.txt --format detailed | grep "Needs update"
```

### 更新が必要な Flow のみを表示 / Show Only Flows Needing Updates

現在、フィルタオプションはありませんが、出力を grep で絞り込めます:
Currently no filter option, but you can use grep:

```bash
# テーブル形式で ⚠ マークのある行のみ表示
# Show only lines with ⚠ mark in table format
sf-flow get-active-versions -f flows.txt | grep "⚠"
```

### JSON 出力から更新が必要な Flow を抽出 / Extract Flows Needing Updates from JSON

```bash
# jq を使用して needsUpdate が true の Flow を抽出
# Use jq to extract flows where needsUpdate is true
sf-flow get-active-versions -f flows.txt -o versions.json --format json
cat versions.json | jq '.flows[] | select(.needsUpdate == true) | .name'
```

## まとめ / Summary

`get-active-versions` コマンドは:
- ファイルから目標バージョンを読み込める
- 現在の有効バージョンと目標バージョンを比較表示
- 更新が必要な Flow を一目で確認できる
- 複数の出力形式をサポート
- デプロイ前後の検証に最適

The `get-active-versions` command:
- Loads target versions from files
- Compares current active versions with target versions
- Clearly shows which flows need updates
- Supports multiple output formats
- Perfect for pre/post-deployment verification
