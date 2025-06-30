class RetryHandler {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000;
        this.maxDelay = options.maxDelay || 30000;
        this.exponentialBackoff = options.exponentialBackoff !== false;
        this.jitterFactor = options.jitterFactor || 0.1;
    }

    async executeWithRetry(operation, context = '', logger = null) {
        let lastError;
        
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt === this.maxRetries) {
                    const message = `Operation failed after ${this.maxRetries} retries: ${error.message}`;
                    if (logger) {
                        logger.error(`${context} - ${message}`);
                    }
                    throw new Error(message);
                }
                
                if (!this.isRetryableError(error)) {
                    if (logger) {
                        logger.error(`${context} - Non-retryable error: ${error.message}`);
                    }
                    throw error;
                }
                
                const delay = this.calculateDelay(attempt);
                const message = `${context} failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms...`;
                
                if (logger) {
                    logger.warn(message);
                } else {
                    console.warn(message);
                }
                
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    }

    calculateDelay(attempt) {
        let delay;
        
        if (this.exponentialBackoff) {
            delay = this.baseDelay * Math.pow(2, attempt);
        } else {
            delay = this.baseDelay;
        }
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * this.jitterFactor * delay;
        delay = delay + jitter;
        
        return Math.min(delay, this.maxDelay);
    }

    isRetryableError(error) {
        // Check for specific Salesforce error types that are retryable
        const retryableErrors = [
            'UNABLE_TO_LOCK_ROW',
            'SERVER_UNAVAILABLE',
            'REQUEST_RUNNING_TOO_LONG',
            'STORAGE_LIMIT_EXCEEDED',
            'TIMEOUT',
            'NETWORK_ERROR',
            'CONNECTION_RESET',
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED'
        ];
        
        const retryableStatusCodes = [429, 500, 502, 503, 504];
        
        // Check error message
        const errorMessage = error.message || '';
        const hasRetryableMessage = retryableErrors.some(errorType => 
            errorMessage.toUpperCase().includes(errorType)
        );
        
        // Check status code
        const hasRetryableStatusCode = retryableStatusCodes.includes(error.statusCode) ||
                                     retryableStatusCodes.includes(error.response?.status);
        
        // Check for network errors
        const isNetworkError = error.code && (
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ECONNREFUSED'
        );
        
        return hasRetryableMessage || hasRetryableStatusCode || isNetworkError;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Factory method for creating retry handlers with different configurations
    static createDefault() {
        return new RetryHandler({
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 30000,
            exponentialBackoff: true,
            jitterFactor: 0.1
        });
    }

    static createAggressive() {
        return new RetryHandler({
            maxRetries: 5,
            baseDelay: 500,
            maxDelay: 60000,
            exponentialBackoff: true,
            jitterFactor: 0.2
        });
    }

    static createConservative() {
        return new RetryHandler({
            maxRetries: 2,
            baseDelay: 2000,
            maxDelay: 15000,
            exponentialBackoff: false,
            jitterFactor: 0.05
        });
    }
}

module.exports = RetryHandler;