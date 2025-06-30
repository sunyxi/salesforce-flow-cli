const axios = require('axios');

class SalesforceOAuth {
    constructor(options) {
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.username = options.username;
        this.password = options.password;
        this.securityToken = options.securityToken;
        this.sandbox = options.sandbox || false;
        this.accessToken = null;
        this.instanceUrl = null;
        this.tokenExpiry = null;
    }

    async authenticate() {
        // Check if we have a valid token
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return {
                accessToken: this.accessToken,
                instanceUrl: this.instanceUrl
            };
        }

        const endpoint = this.sandbox ? 
            'https://test.salesforce.com' : 
            'https://login.salesforce.com';

        const params = new URLSearchParams({
            grant_type: 'password',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            username: this.username,
            password: this.password + (this.securityToken || '')
        });

        try {
            const response = await axios.post(`${endpoint}/services/oauth2/token`, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = response.data.access_token;
            this.instanceUrl = response.data.instance_url;
            // Set expiry to 1 hour minus 5 minutes for safety
            this.tokenExpiry = Date.now() + (55 * 60 * 1000);

            return {
                accessToken: this.accessToken,
                instanceUrl: this.instanceUrl
            };
        } catch (error) {
            const errorMessage = error.response?.data?.error_description || 
                               error.response?.data?.error || 
                               error.message;
            throw new Error(`OAuth authentication failed: ${errorMessage}`);
        }
    }

    async getAuthHeaders() {
        const auth = await this.authenticate();
        return {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    getInstanceUrl() {
        return this.instanceUrl;
    }

    isAuthenticated() {
        return this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry;
    }

    invalidateToken() {
        this.accessToken = null;
        this.instanceUrl = null;
        this.tokenExpiry = null;
    }
}

module.exports = SalesforceOAuth;