# Salesforce Flow CLI

A powerful command-line tool for bulk management of Salesforce Flows, supporting activation, deactivation, and status monitoring across multiple environments.

## 🚀 Features

- **Bulk Operations**: Activate/deactivate multiple flows simultaneously
- **Multiple Auth Methods**: JWT Bearer Token Flow and OAuth 2.0 support
- **Environment Safety**: Built-in production environment protections
- **Robust Error Handling**: Automatic retry logic with exponential backoff
- **Flexible Input**: Support for JSON, TXT, and CSV flow lists
- **Progress Tracking**: Real-time progress bars and detailed reporting
- **Comprehensive Logging**: Structured logging with multiple output formats
- **Dry Run Mode**: Preview changes without making modifications

## 📋 Prerequisites

- Node.js 14.0.0 or higher
- Salesforce Connected App with appropriate permissions
- Private key file for JWT authentication (recommended)

## 🔧 Installation

### From Source

```bash
git clone <repository-url>
cd salesforce-flow-cli
npm install
npm link  # Optional: for global access
```

### Direct Usage

```bash
node src/index.js --help
```

## ⚙️ Configuration

### Environment Variables

Set the following environment variables for authentication:

```bash
# JWT Authentication (Recommended)
export SF_CLIENT_ID="your_connected_app_client_id"
export SF_USERNAME="your_salesforce_username"
export SF_PRIVATE_KEY_PATH="/path/to/your/private_key.pem"
export SF_SANDBOX="true"  # or "false" for production

# OAuth Authentication (Alternative)
export SF_AUTH_METHOD="oauth"
export SF_CLIENT_SECRET="your_client_secret"
export SF_PASSWORD="your_password"
export SF_SECURITY_TOKEN="your_security_token"

# Optional Configuration
export SF_MAX_CONCURRENT="3"
export SF_RATE_LIMIT_DELAY="1000"
export SF_MAX_RETRIES="3"
export SF_LOG_LEVEL="info"
```

### Configuration File

Create a `config/default.json` file in your project:

```json
{
  "auth": {
    "method": "jwt",
    "clientId": "${SF_CLIENT_ID}",
    "username": "${SF_USERNAME}",
    "privateKeyPath": "${SF_PRIVATE_KEY_PATH}",
    "sandbox": true
  },
  "batch": {
    "maxConcurrent": 3,
    "rateLimitDelay": 1000,
    "maxRetries": 3,
    "timeoutSeconds": 300
  },
  "logging": {
    "level": "info",
    "format": "structured",
    "outputFile": "flow-operations.log"
  }
}
```

## 🎯 Usage

### Basic Commands

#### Activate Flows

```bash
# Activate single flow
sf-flow activate MyFlow

# Activate multiple flows
sf-flow activate Flow1 Flow2 Flow3

# Activate with validation
sf-flow activate MyFlow --validate

# Ignore missing flows
sf-flow activate Flow1 MissingFlow --ignore-not-found
```

#### Deactivate Flows

```bash
# Deactivate flows (requires --force in production)
sf-flow deactivate MyFlow --force

# Deactivate multiple flows
sf-flow deactivate Flow1 Flow2 --force

# Validate before deactivation
sf-flow deactivate MyFlow --validate --force
```

#### List Flows

```bash
# List all flows
sf-flow list

# List specific flows
sf-flow list Flow1 Flow2

# Filter by type
sf-flow list --type screen
sf-flow list --type record
sf-flow list --type scheduled

# Filter by status
sf-flow list --status active
sf-flow list --status inactive

# Output formats
sf-flow list --format json
sf-flow list --format csv
sf-flow list --format table
```

### Batch Operations

#### From File

Create a flow list file (`flows.json`):

```json
{
  "flows": [
    "Customer_Onboarding_Flow",
    "Order_Processing_Flow",
    "Account_Validation_Flow"
  ]
}
```

Or a simple text file (`flows.txt`):

```text
Customer_Onboarding_Flow
Order_Processing_Flow
Account_Validation_Flow
```

Execute batch operations:

```bash
# Batch activate from file
sf-flow batch-activate --file flows.json

# Batch deactivate from file
sf-flow batch-deactivate --file flows.txt --force

# Dry run to preview changes
sf-flow batch-activate --file flows.json --dry-run

# Generate detailed report
sf-flow batch-activate --file flows.json --report activation-report.json
```

#### From Configuration

```bash
# Use flows defined in configuration
sf-flow batch-activate --use-config

# Combine file and config
sf-flow batch-activate --file flows.json --use-config

# Add additional flows
sf-flow batch-activate --use-config --flows ExtraFlow1 ExtraFlow2
```

### Advanced Options

#### Environment Control

```bash
# Force sandbox environment
sf-flow list --sandbox

# Force production environment (use with caution)
sf-flow list --production

# Use custom config file
sf-flow activate MyFlow --config /path/to/config.json
```

#### Output Control

```bash
# Verbose output
sf-flow activate MyFlow --verbose

# Quiet mode
sf-flow activate MyFlow --quiet

# Continue on errors
sf-flow batch-activate --file flows.json --continue-on-error
```

#### Safety Features

```bash
# Validate flows exist before processing
sf-flow batch-activate --file flows.json --validate

# Show current status during dry run
sf-flow batch-deactivate --file flows.json --dry-run --show-status

# Show detailed error messages
sf-flow batch-activate --file flows.json --verbose --show-errors
```

## 📁 File Formats

### JSON Format

```json
{
  "flows": [
    "Flow_Name_1",
    "Flow_Name_2"
  ],
  "environments": {
    "production": {
      "flows_to_activate": ["Prod_Flow_1"],
      "flows_to_deactivate": ["Legacy_Flow"]
    },
    "sandbox": {
      "flows_to_activate": ["Test_Flow_1"],
      "flows_to_deactivate": ["Old_Test_Flow"]
    }
  }
}
```

### Text/CSV Format

```text
# Comments are supported (lines starting with #)
Flow_Name_1
Flow_Name_2
Flow_Name_3

# Grouped flows
Account_Validation_Flow
Opportunity_Approval_Flow
Lead_Assignment_Flow
```

## 🔐 Authentication Setup

### 认证方式设置 / Authentication Methods

本工具支持两种Salesforce认证方式：JWT Bearer Token Flow（推荐）和OAuth 2.0 Flow。

This tool supports two Salesforce authentication methods: JWT Bearer Token Flow (recommended) and OAuth 2.0 Flow.

#### JWT Bearer Token Flow (推荐 / Recommended)

这是最安全和推荐的认证方式，适合自动化部署和CI/CD环境。

This is the most secure and recommended authentication method, suitable for automated deployments and CI/CD environments.

**步骤1: 创建Connected App / Step 1: Create Connected App**

1. 登录Salesforce / Login to Salesforce
2. 进入 **Setup** → **App Manager** → **New Connected App** / Go to **Setup** → **App Manager** → **New Connected App**
3. 启用OAuth Settings / Enable OAuth Settings
4. 启用"Use digital signatures" / Enable "Use digital signatures"
5. 上传您的证书 / Upload your certificate
6. 添加OAuth Scopes: `api`, `refresh_token`, `offline_access` / Add OAuth Scopes: `api`, `refresh_token`, `offline_access`

**步骤2: 生成私钥和证书 / Step 2: Generate Private Key and Certificate**

```bash
# 生成私钥 / Generate private key
openssl genpkey -algorithm RSA -out private_key.pem -keylen 2048

# 生成证书 / Generate certificate
openssl req -new -x509 -key private_key.pem -out cert.crt -days 365
```

**macOS 用户注意 / macOS Users Note:**

如果您在macOS中遇到OpenSSL命令错误，请使用以下替代命令：

If you encounter OpenSSL command errors on macOS, use these alternative commands:

```bash
# macOS 生成私钥 / macOS Generate private key
openssl genrsa -out private_key.pem 2048

# macOS 生成证书 / macOS Generate certificate
openssl req -new -x509 -key private_key.pem -out cert.crt -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

**或者使用更简单的方法 / Or use a simpler method:**

```bash
# 使用 Homebrew 安装 OpenSSL (如果尚未安装) / Install OpenSSL via Homebrew (if not installed)
brew install openssl

# 然后使用完整路径 / Then use the full path
/usr/local/opt/openssl/bin/openssl genpkey -algorithm RSA -out private_key.pem -keylen 2048
/usr/local/opt/openssl/bin/openssl req -new -x509 -key private_key.pem -out cert.crt -days 365
```

**步骤3: 上传证书 / Step 3: Upload Certificate**

- 将生成的`cert.crt`文件上传到您的Connected App / Upload the generated `cert.crt` file to your Connected App
- 记录Consumer Key (Client ID) / Note the Consumer Key (Client ID)

**步骤4: 设置环境变量 / Step 4: Set Environment Variables**

```bash
export SF_CLIENT_ID="your_consumer_key"
export SF_USERNAME="your_username"
export SF_PRIVATE_KEY_PATH="/path/to/private_key.pem"
export SF_SANDBOX="true"  # 或 "false" 用于生产环境 / or "false" for production
```

#### OAuth 2.0 Flow (替代方式 / Alternative Method)

**步骤1: 创建Connected App / Step 1: Create Connected App**

1. 启用OAuth Settings / Enable OAuth Settings
2. 记录Consumer Key和Consumer Secret / Note Consumer Key and Consumer Secret
3. 添加OAuth Scopes: `api`, `refresh_token` / Add OAuth Scopes: `api`, `refresh_token`

**步骤2: 设置环境变量 / Step 2: Set Environment Variables**

```bash
export SF_AUTH_METHOD="oauth"
export SF_CLIENT_ID="your_consumer_key"
export SF_CLIENT_SECRET="your_consumer_secret"
export SF_USERNAME="your_username"
export SF_PASSWORD="your_password"
export SF_SECURITY_TOKEN="your_security_token"
```

### 配置文件设置 / Configuration File Setup

您也可以创建配置文件来管理认证信息。在项目根目录创建 `config/default.json`：

You can also create a configuration file to manage authentication information. Create `config/default.json` in the project root:

```json
{
  "auth": {
    "method": "jwt",
    "clientId": "${SF_CLIENT_ID}",
    "username": "${SF_USERNAME}",
    "privateKeyPath": "${SF_PRIVATE_KEY_PATH}",
    "sandbox": true
  },
  "batch": {
    "maxConcurrent": 3,
    "rateLimitDelay": 1000,
    "maxRetries": 3,
    "timeoutSeconds": 300
  },
  "logging": {
    "level": "info",
    "format": "structured",
    "outputFile": "flow-operations.log"
  }
}
```

### 可选配置 / Optional Configuration

您还可以设置以下可选的环境变量：

You can also set the following optional environment variables:

```bash
# 批处理配置 / Batch processing configuration
export SF_MAX_CONCURRENT="3"
export SF_RATE_LIMIT_DELAY="1000"
export SF_MAX_RETRIES="3"

# 日志配置 / Logging configuration
export SF_LOG_LEVEL="info"
```

### 安全注意事项 / Security Considerations

1. **私钥安全 / Private Key Security**: 确保私钥文件权限设置正确，只有您能访问 / Ensure private key file permissions are set correctly, only you can access
2. **环境变量 / Environment Variables**: 不要在代码中硬编码敏感信息 / Don't hardcode sensitive information in code
3. **生产环境 / Production Environment**: 在生产环境中使用时要特别小心，确保有适当的权限控制 / Be especially careful when using in production, ensure proper permission controls

### 验证配置 / Verify Configuration

设置完成后，您可以使用以下命令验证配置：

After setup, you can verify the configuration using the following commands:

```bash
# 测试连接 / Test connection
node src/index.js list --quiet

# 检查配置 / Check configuration
node src/index.js config

# 启用调试日志 / Enable debug logging
node src/index.js activate MyFlow --verbose
```

## 🛡️ Safety Features

### Production Environment Protection

- **Force Flag Required**: Deactivation in production requires `--force` flag
- **Confirmation Prompts**: Clear warnings before destructive operations
- **Environment Indicators**: Visual indicators for sandbox vs production

### Error Handling

- **Automatic Retries**: Configurable retry logic for transient errors
- **Rate Limiting**: Built-in rate limiting to respect API limits
- **Graceful Degradation**: Continue processing other flows if some fail

### Validation

- **Flow Existence Check**: Validate flows exist before processing
- **Status Verification**: Check current flow status
- **Dry Run Mode**: Preview changes without execution

## 📊 Logging and Monitoring

### Log Levels

- `error`: Error messages only
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debugging information
- `verbose`: Maximum detail

### Log Formats

- `structured`: JSON format for parsing
- `simple`: Human-readable format
- `colorized`: Console output with colors

### Log Files

- `flow-operations.log`: Main log file
- `flow-operations.error.log`: Error-specific logs
- `flow-operations.exceptions.log`: Unhandled exceptions
- `flow-operations.rejections.log`: Promise rejections

## 🔧 Troubleshooting

### Common Issues

1. **Authentication Errors**
   ```
   Error: JWT authentication failed: invalid_client_id
   ```
   - Verify SF_CLIENT_ID is correct
   - Ensure Connected App is deployed
   - Check private key format

2. **Permission Errors**
   ```
   Error: insufficient access rights on cross-reference id
   ```
   - Verify user permissions
   - Check profile/permission set assignments
   - Ensure API access is enabled

3. **Flow Not Found**
   ```
   Error: Flow 'MyFlow' not found
   ```
   - Verify flow API name (not label)
   - Check if flow exists in target org
   - Use `sf-flow list` to see available flows

4. **Rate Limiting**
   ```
   Error: REQUEST_RUNNING_TOO_LONG
   ```
   - Reduce `maxConcurrent` setting
   - Increase `rateLimitDelay`
   - Use smaller batch sizes

### Debug Mode

```bash
# Enable debug logging
sf-flow activate MyFlow --verbose

# Check configuration
sf-flow config

# Test connection
sf-flow list --quiet
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `npm test`
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Check the troubleshooting section above
- Review logs for detailed error information
- Ensure proper authentication setup
- Verify Salesforce permissions

For additional support, please refer to the Salesforce Tooling API documentation and Connected App setup guides.