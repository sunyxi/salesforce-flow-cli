# Salesforce Flow CLI Tool

[English](#english) | [中文](#中文) | [日本語](#日本語)

---

## English

### Overview

A comprehensive command-line interface (CLI) tool for managing Salesforce Flows at scale. This tool provides efficient batch operations for activating, deactivating, and monitoring Flow statuses using the Salesforce Tooling API.

### Features

- 🚀 **Flow Management**: Activate/deactivate flows individually or in batches
- 📊 **Status Monitoring**: List all flows with version information and activation status  
- 🔗 **URL Generation**: Generate direct Salesforce URLs for manual operations
- 🔧 **Flow Builder URLs**: Direct links to Flow Builder for editing
- 🎯 **Smart Detection**: Automatically identifies flow types and API compatibility
- 🔐 **Multiple Auth**: Supports both OAuth and JWT authentication
- ⚡ **Batch Operations**: Process multiple flows with progress tracking
- 🛡️ **Error Handling**: Robust retry logic and detailed error reporting

### Installation

```bash
# Clone the repository
git clone https://github.com/sunyxi/salesforce-flow-cli.git
cd salesforce-flow-cli

# Install dependencies
npm install

# Setup authentication (OAuth recommended)
npm run setup-oauth
```

### Authentication Setup

#### OAuth Authentication (Recommended)
```bash
# Run the setup script
npm run setup-oauth

# Follow the prompts to configure:
# - Salesforce org URL
# - Client ID and Secret
# - Redirect URI
```

#### JWT Authentication
```bash
# Create .env file
cp .env.example .env

# Configure JWT settings in .env
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_USERNAME=your_username
SALESFORCE_PRIVATE_KEY_PATH=/path/to/private.key
```

### Usage

#### Basic Commands

```bash
# List all flows
sf-flow list

# List specific flows
sf-flow list MyScreenFlow MyAutoFlow

# Activate flows
sf-flow activate MyScreenFlow MyAutoFlow

# Deactivate flows  
sf-flow deactivate MyScreenFlow MyAutoFlow

# Generate Salesforce URLs
sf-flow generate-urls MyScreenFlow MyAutoFlow

# Generate Flow Builder URLs
sf-flow builder-urls MyScreenFlow MyAutoFlow
```

#### Advanced Usage

```bash
# Batch operations from file
sf-flow batch-activate -f flows.txt

# Filter by status
sf-flow list --status inactive

# Generate URL list for copying
sf-flow builder-urls MyScreenFlow MyAutoFlow --url-list

# Export detailed report
sf-flow generate-urls MyScreenFlow -o report.json

# Verbose output
sf-flow activate MyScreenFlow --verbose
```

### Flow Type Detection

The tool automatically detects flow types and API compatibility:

- ✅ **Screen Flows**: Can be activated via API
- ✅ **Auto-launched Flows**: Can be activated via API  
- ⚠️ **Record-Triggered Flows**: Require manual UI activation
- ⚠️ **Process Builder**: Require manual UI activation

### Examples

#### Example 1: Basic Flow Management
```bash
# Check flow status
sf-flow list MyScreenFlow MyAutoFlow

# Output:
# Name           | Type       | Status   | Ver | Latest | Updates
# MyScreenFlow   | Flow       | Inactive | 0   | 3      | Yes
# MyAutoFlow     | Flow       | Active   | 2   | 2      | No
```

#### Example 2: URL Generation
```bash
# Generate Flow Builder URLs
sf-flow builder-urls MyScreenFlow

# Output:
# 📋 MyScreenFlow
#    Status: Inactive (v0/3)
#    🔧 Flow Builder: https://instance.my.salesforce.com/builder_platform_interaction/flowBuilder.app?flowId=301xxxxx
```

### API Limitations

Some flows cannot be activated via API due to Salesforce security restrictions:

- **System Context Flows**: Record-triggered flows that run in system context
- **Process Builder**: Legacy process automation
- **Certain Auto-launched Flows**: Depending on configuration

For these flows, use the generated URLs to activate manually through the Salesforce UI.

### Error Handling

The tool provides clear error messages:

```
❌ Flow 'RecordTriggeredFlow' cannot be activated via API (system context restriction). 
   Please use Salesforce UI.
```

### Configuration

Configuration files are located in the `config/` directory:

- `default.json`: Default settings
- `flows.example.json`: Example flow list for batch operations

### Troubleshooting

#### Authentication Issues
```bash
# Check current configuration
sf-flow config

# Re-run OAuth setup
npm run setup-oauth
```

#### API Errors
- Ensure proper permissions for Tooling API access
- Check if flows exist in the target org
- Verify environment settings (sandbox vs production)

---

## 中文

### 概述

一个用于大规模管理 Salesforce Flow 的综合命令行界面（CLI）工具。该工具使用 Salesforce Tooling API 提供高效的批量操作，用于激活、停用和监控 Flow 状态。

### 功能特性

- 🚀 **Flow 管理**: 单个或批量激活/停用流程
- 📊 **状态监控**: 列出所有流程及其版本信息和激活状态
- 🔗 **URL 生成**: 生成用于手动操作的直接 Salesforce URL
- 🔧 **Flow Builder URL**: 直接链接到 Flow Builder 进行编辑
- 🎯 **智能检测**: 自动识别流程类型和 API 兼容性
- 🔐 **多种认证**: 支持 OAuth 和 JWT 认证
- ⚡ **批量操作**: 处理多个流程并显示进度跟踪
- 🛡️ **错误处理**: 强大的重试逻辑和详细的错误报告

### 安装

```bash
# 克隆仓库
git clone https://github.com/sunyxi/salesforce-flow-cli.git
cd salesforce-flow-cli

# 安装依赖
npm install

# 设置认证（推荐使用 OAuth）
npm run setup-oauth
```

### 认证设置

#### OAuth 认证（推荐）
```bash
# 运行设置脚本
npm run setup-oauth

# 按照提示配置：
# - Salesforce 组织 URL
# - 客户端 ID 和密钥
# - 重定向 URI
```

#### JWT 认证
```bash
# 创建 .env 文件
cp .env.example .env

# 在 .env 中配置 JWT 设置
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_USERNAME=your_username
SALESFORCE_PRIVATE_KEY_PATH=/path/to/private.key
```

### 使用方法

#### 基本命令

```bash
# 列出所有流程
sf-flow list

# 列出特定流程
sf-flow list 示例屏幕流程 示例自动流程

# 激活流程
sf-flow activate 示例屏幕流程 示例自动流程

# 停用流程
sf-flow deactivate 示例屏幕流程 示例自动流程

# 生成 Salesforce URL
sf-flow generate-urls 示例屏幕流程 示例自动流程

# 生成 Flow Builder URL
sf-flow builder-urls 示例屏幕流程 示例自动流程
```

#### 高级用法

```bash
# 从文件批量操作
sf-flow batch-activate -f flows.txt

# 按状态筛选
sf-flow list --status inactive

# 生成用于复制的 URL 列表
sf-flow builder-urls 示例屏幕流程 示例自动流程 --url-list

# 导出详细报告
sf-flow generate-urls 示例屏幕流程 -o report.json

# 详细输出
sf-flow activate 示例屏幕流程 --verbose
```

### 流程类型检测

工具会自动检测流程类型和 API 兼容性：

- ✅ **屏幕流程**: 可通过 API 激活
- ✅ **自动启动流程**: 可通过 API 激活
- ⚠️ **记录触发流程**: 需要手动 UI 激活
- ⚠️ **流程构建器**: 需要手动 UI 激活

### 示例

#### 示例 1: 基本流程管理
```bash
# 检查流程状态
sf-flow list 示例屏幕流程 示例自动流程

# 输出:
# 名称           | 类型       | 状态     | 版本 | 最新版本 | 更新
# 示例屏幕流程   | Flow       | 未激活   | 0    | 3        | 是
# 示例自动流程   | Flow       | 激活     | 2    | 2        | 否
```

#### 示例 2: URL 生成
```bash
# 生成 Flow Builder URL
sf-flow builder-urls 示例屏幕流程

# 输出:
# 📋 示例屏幕流程
#    状态: 未激活 (v0/3)
#    🔧 Flow Builder: https://instance.my.salesforce.com/builder_platform_interaction/flowBuilder.app?flowId=301xxxxx
```

### API 限制

由于 Salesforce 安全限制，某些流程无法通过 API 激活：

- **系统上下文流程**: 在系统上下文中运行的记录触发流程
- **流程构建器**: 传统流程自动化
- **某些自动启动流程**: 取决于配置

对于这些流程，请使用生成的 URL 通过 Salesforce UI 手动激活。

### 错误处理

工具提供清晰的错误消息：

```
❌ 流程 '记录触发流程' 无法通过 API 激活（系统上下文限制）。
   请使用 Salesforce UI。
```

### 故障排除

#### 认证问题
```bash
# 检查当前配置
sf-flow config

# 重新运行 OAuth 设置
npm run setup-oauth
```

#### API 错误
- 确保拥有 Tooling API 访问的适当权限
- 检查流程是否存在于目标组织中
- 验证环境设置（沙盒 vs 生产）

---

## 日本語

### 概要

Salesforce Flow を大規模に管理するための包括的なコマンドラインインターフェース（CLI）ツールです。このツールは Salesforce Tooling API を使用して、Flow の有効化、無効化、ステータス監視のための効率的なバッチ操作を提供します。

### 機能

- 🚀 **Flow 管理**: フローの個別またはバッチでの有効化/無効化
- 📊 **ステータス監視**: すべてのフローをバージョン情報と有効化ステータスで一覧表示
- 🔗 **URL 生成**: 手動操作用の直接 Salesforce URL を生成
- 🔧 **Flow Builder URL**: 編集用の Flow Builder への直接リンク
- 🎯 **スマート検出**: フロータイプと API 互換性を自動識別
- 🔐 **複数認証**: OAuth と JWT 認証をサポート
- ⚡ **バッチ操作**: 進行状況追跡で複数フローを処理
- 🛡️ **エラーハンドリング**: 堅牢な再試行ロジックと詳細なエラーレポート

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/sunyxi/salesforce-flow-cli.git
cd salesforce-flow-cli

# 依存関係をインストール
npm install

# 認証を設定（OAuth 推奨）
npm run setup-oauth
```

### 認証設定

#### OAuth 認証（推奨）
```bash
# 設定スクリプトを実行
npm run setup-oauth

# プロンプトに従って設定：
# - Salesforce 組織 URL
# - クライアント ID とシークレット
# - リダイレクト URI
```

#### JWT 認証
```bash
# .env ファイルを作成
cp .env.example .env

# .env で JWT 設定を構成
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_USERNAME=your_username
SALESFORCE_PRIVATE_KEY_PATH=/path/to/private.key
```

### 使用方法

#### 基本コマンド

```bash
# すべてのフローを一覧表示
sf-flow list

# 特定のフローを一覧表示
sf-flow list サンプル画面フロー サンプル自動フロー

# フローを有効化
sf-flow activate サンプル画面フロー サンプル自動フロー

# フローを無効化
sf-flow deactivate サンプル画面フロー サンプル自動フロー

# Salesforce URL を生成
sf-flow generate-urls サンプル画面フロー サンプル自動フロー

# Flow Builder URL を生成
sf-flow builder-urls サンプル画面フロー サンプル自動フロー
```

#### 高度な使用法

```bash
# ファイルからバッチ操作
sf-flow batch-activate -f flows.txt

# ステータスでフィルタ
sf-flow list --status inactive

# コピー用 URL リストを生成
sf-flow builder-urls サンプル画面フロー サンプル自動フロー --url-list

# 詳細レポートをエクスポート
sf-flow generate-urls サンプル画面フロー -o report.json

# 詳細出力
sf-flow activate サンプル画面フロー --verbose
```

### フロータイプ検出

ツールは自動的にフロータイプと API 互換性を検出します：

- ✅ **画面フロー**: API 経由で有効化可能
- ✅ **自動起動フロー**: API 経由で有効化可能
- ⚠️ **レコードトリガーフロー**: 手動 UI 有効化が必要
- ⚠️ **プロセスビルダー**: 手動 UI 有効化が必要

### 例

#### 例 1: 基本的なフロー管理
```bash
# フローステータスを確認
sf-flow list サンプル画面フロー サンプル自動フロー

# 出力:
# 名前               | タイプ     | ステータス | Ver | 最新 | 更新
# サンプル画面フロー | Flow       | 無効       | 0   | 3    | あり
# サンプル自動フロー | Flow       | 有効       | 2   | 2    | なし
```

#### 例 2: URL 生成
```bash
# Flow Builder URL を生成
sf-flow builder-urls サンプル画面フロー

# 出力:
# 📋 サンプル画面フロー
#    ステータス: 無効 (v0/3)
#    🔧 Flow Builder: https://instance.my.salesforce.com/builder_platform_interaction/flowBuilder.app?flowId=301xxxxx
```

### API 制限

Salesforce のセキュリティ制限により、一部のフローは API 経由で有効化できません：

- **システムコンテキストフロー**: システムコンテキストで実行されるレコードトリガーフロー
- **プロセスビルダー**: レガシープロセス自動化
- **特定の自動起動フロー**: 構成による

これらのフローについては、生成された URL を使用して Salesforce UI から手動で有効化してください。

### エラーハンドリング

ツールは明確なエラーメッセージを提供します：

```
❌ フロー 'レコードトリガーフロー' は API 経由で有効化できません（システムコンテキスト制限）。
   Salesforce UI をご使用ください。
```

### トラブルシューティング

#### 認証問題
```bash
# 現在の構成を確認
sf-flow config

# OAuth 設定を再実行
npm run setup-oauth
```

#### API エラー
- Tooling API アクセスの適切な権限があることを確認
- 対象組織にフローが存在することを確認
- 環境設定を検証（サンドボックス vs 本番）

---

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review Salesforce Tooling API documentation