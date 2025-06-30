const axios = require('axios');

class ToolingAPI {
    constructor(authManager) {
        this.authManager = authManager;
        this.apiVersion = 'v58.0';
    }

    async makeRequest(method, endpoint, data = null) {
        const headers = await this.authManager.getAuthHeaders();
        const instanceUrl = this.authManager.getInstanceUrl();
        
        if (!instanceUrl) {
            throw new Error('Not authenticated. Instance URL not available.');
        }

        const url = `${instanceUrl}/services/data/${this.apiVersion}/tooling${endpoint}`;
        
        try {
            const config = {
                method,
                url,
                headers,
                timeout: 30000 // 30 seconds timeout
            };

            if (data) {
                config.data = data;
            }

            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                // Token might be expired, invalidate and retry once
                this.authManager.invalidateToken();
                const newHeaders = await this.authManager.getAuthHeaders();
                
                const retryConfig = {
                    method,
                    url,
                    headers: newHeaders,
                    timeout: 30000
                };

                if (data) {
                    retryConfig.data = data;
                }

                const retryResponse = await axios(retryConfig);
                return retryResponse.data;
            }
            
            const errorMessage = error.response?.data?.message || 
                               error.response?.data?.error || 
                               error.message;
            
            // Log detailed error information for debugging
            console.error('Tooling API Error Details:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: url,
                method: method
            });
            
            throw new Error(`Tooling API request failed: ${errorMessage}`);
        }
    }

    async query(soql) {
        const encodedQuery = encodeURIComponent(soql);
        return await this.makeRequest('GET', `/query/?q=${encodedQuery}`);
    }

    async queryMore(nextRecordsUrl) {
        // Extract the path from the full URL
        const path = nextRecordsUrl.replace(/.*\/tooling/, '');
        return await this.makeRequest('GET', path);
    }

    async getAllRecords(soql) {
        let allRecords = [];
        let result = await this.query(soql);
        
        allRecords = allRecords.concat(result.records);
        
        // Handle pagination
        while (!result.done && result.nextRecordsUrl) {
            result = await this.queryMore(result.nextRecordsUrl);
            allRecords = allRecords.concat(result.records);
        }
        
        return allRecords;
    }

    async getRecord(sobjectType, id, fields = null) {
        let endpoint = `/sobjects/${sobjectType}/${id}`;
        if (fields) {
            endpoint += `?fields=${fields.join(',')}`;
        }
        return await this.makeRequest('GET', endpoint);
    }

    async updateRecord(sobjectType, id, data) {
        return await this.makeRequest('PATCH', `/sobjects/${sobjectType}/${id}`, data);
    }

    async createRecord(sobjectType, data) {
        return await this.makeRequest('POST', `/sobjects/${sobjectType}`, data);
    }

    async deleteRecord(sobjectType, id) {
        return await this.makeRequest('DELETE', `/sobjects/${sobjectType}/${id}`);
    }
}

module.exports = ToolingAPI;