# 変更サマリー / Change Summary

## 実装日 / Implementation Date
2025-12-07

## 概要 / Overview

Salesforce Flow CLI ツールに以下の2つの主要機能を追加しました:

1. **個別バージョン指定機能**: 各 Flow に異なるバージョンを指定して有効化
2. **有効バージョン一括取得機能**: 複数の Flow の現在有効なバージョンを一括取得

---

## 変更されたファイル / Modified Files

### 1. コアロジック / Core Logic

#### `src/core/api/flow-client.js`
- **変更内容**: `activateFlow` メソッドに `targetVersion` パラメータを追加
- **影響**: 特定のバージョンを指定して Flow を有効化できるようになった
- **後方互換性**: ✅ 既存の呼び出しは引き続き動作 (デフォルトで最新版を使用)

#### `src/core/batch/processor.js`
- **変更内容**: `activateFlowsWithVersions` メソッドを追加
- **機能**: Flow ごとに異なるバージョンを指定して一括有効化
- **既存メソッド**: `activateFlows` は引き続き利用可能

### 2. コマンド / Commands

#### `src/commands/batch.js`
- **主な変更**:
  - `loadFlowsFromFile` 関数を更新して `FlowName:Version` 形式をサポート
  - Flow データを `{ name, version }` オブジェクトとして処理
  - グローバル `--version` オプションとファイル内バージョンの優先順位を実装
- **サポートされる形式**:
  - テキスト: `FlowName:3`
  - JSON: `{ "name": "FlowName", "version": 3 }`

#### `src/commands/get-active-versions.js` (新規)
- **機能**: 
  - Flow の有効バージョンを一括取得
  - 複数の出力形式をサポート (table, simple, detailed, json, csv, txt)
  - フィルタリング機能 (active/inactive, updates-available)
- **オプション**:
  - `--all`: すべての Flow を取得
  - `--status`: ステータスでフィルタ
  - `--updates-available`: 更新可能な Flow のみ表示
  - `--format`: 出力形式を指定
  - `-o, --output`: ファイルにエクスポート

### 3. メインエントリーポイント / Main Entry Point

#### `src/index.js`
- **追加されたコマンド**:
  - `get-active-versions`: 有効バージョン取得コマンド
- **更新されたオプション**:
  - `batch-activate --version`: グローバルバージョン指定
  - `batch-deactivate --version`: 将来の拡張用

---

## 新しいファイル / New Files

### ドキュメント / Documentation

1. **`NEW_FEATURES.md`**
   - 新機能の詳細説明
   - 実用的なワークフロー例
   - コマンドリファレンス

2. **`QUICK_REFERENCE.md`**
   - クイックリファレンスガイド
   - よくある使用パターン
   - トラブルシューティング

3. **`USAGE_EXAMPLES.md`**
   - 詳細な使用例
   - ユースケース別のサンプル
   - ベストプラクティス

### サンプルファイル / Sample Files

1. **`examples/flows.txt`**
   - テキスト形式のサンプル
   - コメント付きの説明

2. **`examples/flows.json`**
   - JSON 形式のサンプル
   - バージョン指定の例

### 更新されたドキュメント / Updated Documentation

1. **`README.md`**
   - 英語、中文、日本語の3言語で新機能を追加
   - ファイル形式のセクションを追加
   - 使用例を更新

---

## 機能詳細 / Feature Details

### 機能 1: 個別バージョン指定

#### ファイル形式

**テキストファイル (.txt, .csv)**
```text
FlowName1:3
FlowName2:5
FlowName3
```

**JSON ファイル (.json)**
```json
{
  "flows": [
    { "name": "FlowName1", "version": 3 },
    { "name": "FlowName2", "version": 5 },
    { "name": "FlowName3" }
  ]
}
```

#### バージョン優先順位

1. ファイル内で指定されたバージョン (最優先)
2. `--version` オプションで指定されたグローバルバージョン
3. 最新バージョン (デフォルト)

#### 使用例

```bash
# 各 Flow に異なるバージョンを指定
sf-flow batch-activate -f flows.txt

# グローバルバージョンをフォールバックとして使用
sf-flow batch-activate -f flows.txt --version 4
```

### 機能 2: 有効バージョン一括取得

#### 基本的な使用方法

```bash
# すべての Flow
sf-flow get-active-versions --all

# 特定の Flow
sf-flow get-active-versions Flow1 Flow2 Flow3

# ファイルから
sf-flow get-active-versions -f flows.txt
```

#### 出力形式

- **table**: テーブル形式 (デフォルト)
- **simple**: シンプルな一覧
- **detailed**: 詳細情報
- **json**: JSON 形式
- **csv**: CSV 形式
- **txt**: プレーンテキスト

#### フィルタリング

```bash
# 有効な Flow のみ
sf-flow get-active-versions --all --status active

# 更新可能な Flow のみ
sf-flow get-active-versions --all --updates-available
```

---

## テスト状況 / Testing Status

### 構文チェック / Syntax Check
- ✅ `src/index.js`
- ✅ `src/commands/batch.js`
- ✅ `src/commands/get-active-versions.js`
- ✅ `src/core/api/flow-client.js`
- ✅ `src/core/batch/processor.js`

### 互換性テスト / Compatibility Test
- ✅ 既存のファイル形式 (Flow 名のみ) は引き続き動作
- ✅ 既存のコマンドは変更なし
- ✅ 新しいオプションは省略可能

---

## 後方互換性 / Backward Compatibility

### ✅ 完全な後方互換性を維持

1. **既存のファイル形式**
   - Flow 名のみのファイルは引き続き動作
   - 新しい形式と混在可能

2. **既存のコマンド**
   - すべての既存コマンドは変更なし
   - 新しいオプションは省略可能

3. **既存の API**
   - `activateFlow(flowName)` は引き続き動作
   - `activateFlow(flowName, version)` で拡張

---

## 使用上の注意 / Usage Notes

### 推奨事項

1. **バックアップ**: デプロイ前に必ず現在のバージョンをバックアップ
   ```bash
   sf-flow get-active-versions --all -o backup.json
   ```

2. **ドライラン**: 本番環境での実行前にドライランで確認
   ```bash
   sf-flow batch-activate -f flows.txt --dry-run
   ```

3. **段階的デプロイ**: サンドボックスでテストしてから本番環境にデプロイ

### 制限事項

1. **システムコンテキスト Flow**: API 経由で有効化できない Flow は UI での操作が必要
2. **バージョン番号**: 存在しないバージョンを指定するとエラー
3. **権限**: Tooling API へのアクセス権限が必要

---

## 今後の改善案 / Future Improvements

1. **バージョン間の差分表示**: Flow のバージョン間の変更内容を表示
2. **自動ロールバック**: デプロイ失敗時の自動ロールバック機能
3. **スケジュールデプロイ**: 指定時刻でのデプロイ実行
4. **依存関係チェック**: Flow 間の依存関係を考慮したデプロイ順序の最適化
5. **バージョン履歴**: Flow のバージョン変更履歴の追跡

---

## サポート / Support

問題が発生した場合:
1. `QUICK_REFERENCE.md` のトラブルシューティングセクションを確認
2. `--verbose` オプションで詳細なログを確認
3. GitHub Issues で報告

---

## まとめ / Summary

この更新により、Salesforce Flow CLI ツールは以下が可能になりました:

✅ 各 Flow に異なるバージョンを指定して一括有効化
✅ 複数の Flow の有効バージョンを一括取得
✅ 複数の出力形式でのエクスポート
✅ 柔軟なフィルタリングとバージョン管理

すべての変更は後方互換性を維持しており、既存のワークフローに影響を与えません。
