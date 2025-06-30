const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

class ConfigManager {
    constructor(options = {}) {
        this.configName = options.configName || 'sf-flow-config';
        this.configDir = options.configDir || this.getDefaultConfigDir();
        this.config = {};
        this.loadConfig();
    }

    getDefaultConfigDir() {
        // Use platform-specific config directory
        const platform = os.platform();
        const homeDir = os.homedir();
        
        switch (platform) {
            case 'win32':
                return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'sf-flow-cli');
            case 'darwin':
                return path.join(homeDir, 'Library', 'Application Support', 'sf-flow-cli');
            default:
                return path.join(homeDir, '.config', 'sf-flow-cli');
        }
    }

    loadConfig() {
        // Load configuration from multiple sources in order of priority:
        // 1. Environment variables
        // 2. Local config file (./config/default.json)
        // 3. User config file (~/.config/sf-flow-cli/config.json)
        // 4. Default values

        // Start with default configuration
        this.config = this.getDefaultConfig();

        // Load user config file
        const userConfigPath = path.join(this.configDir, 'config.json');
        if (fs.existsSync(userConfigPath)) {
            try {
                const userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
                this.config = this.mergeConfig(this.config, userConfig);
            } catch (error) {
                console.warn(`Warning: Failed to load user config from ${userConfigPath}: ${error.message}`);
            }
        }

        // Load local config file
        const localConfigPath = path.join(process.cwd(), 'config', 'default.json');
        if (fs.existsSync(localConfigPath)) {
            try {
                const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
                this.config = this.mergeConfig(this.config, localConfig);
            } catch (error) {
                console.warn(`Warning: Failed to load local config from ${localConfigPath}: ${error.message}`);
            }
        }

        // Expand environment variables in config
        this.config = this.expandVariablesInConfig(this.config);

        // Override with environment variables
        this.loadFromEnvironment();

        // Validate configuration
        this.validateConfig();
    }

    getDefaultConfig() {
        return {
            auth: {
                method: 'jwt',
                clientId: null,
                username: null,
                privateKeyPath: null,
                clientSecret: null,
                password: null,
                securityToken: null,
                sandbox: false
            },
            batch: {
                maxConcurrent: 3,
                rateLimitDelay: 1000,
                maxRetries: 3,
                timeoutSeconds: 300
            },
            logging: {
                level: 'info',
                format: 'structured',
                outputFile: 'flow-operations.log',
                enableConsole: true,
                enableFile: true
            },
            flows: {
                production: [],
                sandbox: []
            },
            cli: {
                showProgressBar: true,
                showDetailedOutput: true,
                colorOutput: true
            }
        };
    }

    loadFromEnvironment() {
        // Auth configuration
        if (process.env.SF_CLIENT_ID) {
            this.config.auth.clientId = process.env.SF_CLIENT_ID;
        }
        if (process.env.SF_USERNAME) {
            this.config.auth.username = process.env.SF_USERNAME;
        }
        if (process.env.SF_PRIVATE_KEY_PATH) {
            this.config.auth.privateKeyPath = process.env.SF_PRIVATE_KEY_PATH;
        }
        if (process.env.SF_PRIVATE_KEY) {
            this.config.auth.privateKeyPath = process.env.SF_PRIVATE_KEY;
        }
        if (process.env.SF_CLIENT_SECRET) {
            this.config.auth.clientSecret = process.env.SF_CLIENT_SECRET;
        }
        if (process.env.SF_PASSWORD) {
            this.config.auth.password = process.env.SF_PASSWORD;
        }
        if (process.env.SF_SECURITY_TOKEN) {
            this.config.auth.securityToken = process.env.SF_SECURITY_TOKEN;
        }
        if (process.env.SF_SANDBOX) {
            this.config.auth.sandbox = process.env.SF_SANDBOX.toLowerCase() === 'true';
        }
        if (process.env.SF_AUTH_METHOD) {
            this.config.auth.method = process.env.SF_AUTH_METHOD;
        }

        // Batch configuration
        if (process.env.SF_MAX_CONCURRENT) {
            this.config.batch.maxConcurrent = parseInt(process.env.SF_MAX_CONCURRENT, 10);
        }
        if (process.env.SF_RATE_LIMIT_DELAY) {
            this.config.batch.rateLimitDelay = parseInt(process.env.SF_RATE_LIMIT_DELAY, 10);
        }
        if (process.env.SF_MAX_RETRIES) {
            this.config.batch.maxRetries = parseInt(process.env.SF_MAX_RETRIES, 10);
        }
        if (process.env.SF_TIMEOUT_SECONDS) {
            this.config.batch.timeoutSeconds = parseInt(process.env.SF_TIMEOUT_SECONDS, 10);
        }

        // Logging configuration
        if (process.env.SF_LOG_LEVEL) {
            this.config.logging.level = process.env.SF_LOG_LEVEL;
        }
        if (process.env.SF_LOG_FILE) {
            this.config.logging.outputFile = process.env.SF_LOG_FILE;
        }
        if (process.env.SF_LOG_FORMAT) {
            this.config.logging.format = process.env.SF_LOG_FORMAT;
        }
    }

    mergeConfig(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.mergeConfig(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    validateConfig() {
        const errors = [];

        // Validate auth configuration
        if (!this.config.auth.clientId || this.config.auth.clientId.startsWith('${')) {
            errors.push('clientId is required for authentication (set SF_CLIENT_ID environment variable)');
        }
        if (!this.config.auth.username || this.config.auth.username.startsWith('${')) {
            errors.push('username is required for authentication (set SF_USERNAME environment variable)');
        }

        if (this.config.auth.method === 'jwt') {
            if (!this.config.auth.privateKeyPath || this.config.auth.privateKeyPath.startsWith('${')) {
                errors.push('privateKeyPath is required for JWT authentication (set SF_PRIVATE_KEY_PATH environment variable)');
            }
        } else if (this.config.auth.method === 'oauth') {
            if (!this.config.auth.clientSecret) {
                errors.push('clientSecret is required for OAuth authentication');
            }
            if (!this.config.auth.password) {
                errors.push('password is required for OAuth authentication');
            }
        } else {
            errors.push(`Invalid authentication method: ${this.config.auth.method}`);
        }

        // Validate batch configuration
        if (this.config.batch.maxConcurrent < 1 || this.config.batch.maxConcurrent > 10) {
            errors.push('maxConcurrent must be between 1 and 10');
        }
        if (this.config.batch.rateLimitDelay < 0) {
            errors.push('rateLimitDelay must be non-negative');
        }
        if (this.config.batch.maxRetries < 0 || this.config.batch.maxRetries > 10) {
            errors.push('maxRetries must be between 0 and 10');
        }
        if (this.config.batch.timeoutSeconds < 10 || this.config.batch.timeoutSeconds > 3600) {
            errors.push('timeoutSeconds must be between 10 and 3600');
        }

        // Validate logging configuration
        const validLogLevels = ['error', 'warn', 'info', 'debug', 'verbose'];
        if (!validLogLevels.includes(this.config.logging.level)) {
            errors.push(`Invalid log level: ${this.config.logging.level}`);
        }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }

    get(key) {
        return this.getNestedValue(this.config, key);
    }

    set(key, value) {
        this.setNestedValue(this.config, key, value);
    }

    getNestedValue(obj, key) {
        return key.split('.').reduce((current, prop) => {
            return current && current[prop] !== undefined ? current[prop] : undefined;
        }, obj);
    }

    setNestedValue(obj, key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, prop) => {
            if (!current[prop] || typeof current[prop] !== 'object') {
                current[prop] = {};
            }
            return current[prop];
        }, obj);
        target[lastKey] = value;
    }

    getConfig() {
        return { ...this.config };
    }

    getAuthConfig() {
        return { ...this.config.auth };
    }

    getBatchConfig() {
        return { ...this.config.batch };
    }

    getLoggingConfig() {
        return { ...this.config.logging };
    }

    saveUserConfig() {
        // Ensure config directory exists
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }

        const userConfigPath = path.join(this.configDir, 'config.json');
        const configToSave = { ...this.config };
        
        // Remove sensitive information before saving
        delete configToSave.auth.privateKeyPath;
        delete configToSave.auth.clientSecret;
        delete configToSave.auth.password;
        delete configToSave.auth.securityToken;
        
        fs.writeFileSync(userConfigPath, JSON.stringify(configToSave, null, 2));
        return userConfigPath;
    }

    loadFlowsFromFile(filePath) {
        try {
            const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
            const flowsConfig = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
            
            if (flowsConfig.flows) {
                this.config.flows = { ...this.config.flows, ...flowsConfig.flows };
            }
            
            return flowsConfig;
        } catch (error) {
            throw new Error(`Failed to load flows configuration from ${filePath}: ${error.message}`);
        }
    }

    expandVariables(str) {
        if (typeof str !== 'string') {
            return str;
        }
        
        return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
            return process.env[varName] || match;
        });
    }

    expandVariablesInConfig(obj) {
        if (typeof obj === 'string') {
            return this.expandVariables(obj);
        } else if (Array.isArray(obj)) {
            return obj.map(item => this.expandVariablesInConfig(item));
        } else if (obj !== null && typeof obj === 'object') {
            const result = {};
            for (const key in obj) {
                result[key] = this.expandVariablesInConfig(obj[key]);
            }
            return result;
        }
        return obj;
    }

    // Utility methods for specific configurations
    isProduction() {
        return !this.config.auth.sandbox;
    }

    isSandbox() {
        return this.config.auth.sandbox;
    }

    getEnvironmentFlows() {
        return this.config.auth.sandbox ? this.config.flows.sandbox : this.config.flows.production;
    }

    // Static factory methods
    static createDefault() {
        return new ConfigManager();
    }

    static createFromFile(configPath) {
        const config = new ConfigManager();
        config.loadFlowsFromFile(configPath);
        return config;
    }
}

module.exports = ConfigManager;