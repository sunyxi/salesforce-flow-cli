const SalesforceJWT = require('./jwt-auth');
const SalesforceOAuth = require('./oauth');

class AuthManager {
    constructor(config) {
        this.config = config;
        this.authClient = null;
        this.initializeAuthClient();
    }

    initializeAuthClient() {
        if (this.config.auth.method === 'jwt') {
            this.authClient = new SalesforceJWT({
                clientId: this.config.auth.clientId,
                username: this.config.auth.username,
                privateKeyPath: this.config.auth.privateKeyPath,
                sandbox: this.config.auth.sandbox
            });
        } else if (this.config.auth.method === 'oauth') {
            this.authClient = new SalesforceOAuth({
                clientId: this.config.auth.clientId,
                clientSecret: this.config.auth.clientSecret,
                username: this.config.auth.username,
                password: this.config.auth.password,
                securityToken: this.config.auth.securityToken,
                sandbox: this.config.auth.sandbox
            });
        } else {
            throw new Error(`Unsupported authentication method: ${this.config.auth.method}`);
        }
    }

    async authenticate() {
        if (!this.authClient) {
            throw new Error('Authentication client not initialized');
        }
        return await this.authClient.authenticate();
    }

    async getAuthHeaders() {
        if (!this.authClient) {
            throw new Error('Authentication client not initialized');
        }
        return await this.authClient.getAuthHeaders();
    }

    getInstanceUrl() {
        if (!this.authClient) {
            throw new Error('Authentication client not initialized');
        }
        return this.authClient.getInstanceUrl();
    }

    isAuthenticated() {
        if (!this.authClient) {
            return false;
        }
        return this.authClient.isAuthenticated();
    }

    invalidateToken() {
        if (this.authClient) {
            this.authClient.invalidateToken();
        }
    }
}

module.exports = AuthManager;