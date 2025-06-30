const jwt = require('jsonwebtoken');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

class SalesforceJWT {
    constructor(options) {
        this.clientId = options.clientId;
        this.username = options.username;
        this.privateKeyPath = options.privateKeyPath;
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
        
        // Read private key
        let privateKey;
        try {
            if (this.privateKeyPath.startsWith('-----BEGIN')) {
                // Private key is provided directly as string
                privateKey = this.privateKeyPath;
            } else {
                // Private key is a file path
                const keyPath = path.resolve(this.privateKeyPath);
                privateKey = fs.readFileSync(keyPath, 'utf8');
            }
        } catch (error) {
            throw new Error(`Failed to read private key: ${error.message}`);
        }

        const jwtPayload = {
            iss: this.clientId,
            sub: this.username,
            aud: endpoint,
            exp: Math.floor(Date.now() / 1000) + (60 * 2) // 2 minutes
        };

        const token = jwt.sign(jwtPayload, privateKey, { 
            algorithm: 'RS256' 
        });

        try {
            const response = await axios.post(`${endpoint}/services/oauth2/token`, 
                new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: token
                }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.accessToken = response.data.access_token;
            this.instanceUrl = response.data.instance_url;
            // Set expiry to 1 hour (Salesforce default) minus 5 minutes for safety
            this.tokenExpiry = Date.now() + (55 * 60 * 1000);

            return {
                accessToken: this.accessToken,
                instanceUrl: this.instanceUrl
            };
        } catch (error) {
            const errorMessage = error.response?.data?.error_description || 
                               error.response?.data?.error || 
                               error.message;
            throw new Error(`JWT authentication failed: ${errorMessage}`);
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

module.exports = SalesforceJWT;