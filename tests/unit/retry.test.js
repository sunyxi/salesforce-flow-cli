const RetryHandler = require('../../src/core/batch/retry');

describe('RetryHandler', () => {
    let retryHandler;

    beforeEach(() => {
        retryHandler = new RetryHandler({
            maxRetries: 3,
            baseDelay: 100,
            maxDelay: 1000,
            exponentialBackoff: true,
            jitterFactor: 0
        });
    });

    describe('executeWithRetry', () => {
        test('should execute successfully on first attempt', async () => {
            const mockOperation = jest.fn().mockResolvedValue('success');
            
            const result = await retryHandler.executeWithRetry(mockOperation, 'test operation');
            
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        test('should retry on retryable errors', async () => {
            const mockOperation = jest.fn()
                .mockRejectedValueOnce(new Error('UNABLE_TO_LOCK_ROW'))
                .mockRejectedValueOnce(new Error('SERVER_UNAVAILABLE'))
                .mockResolvedValue('success');
            
            const result = await retryHandler.executeWithRetry(mockOperation, 'test operation');
            
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });

        test('should not retry on non-retryable errors', async () => {
            const mockOperation = jest.fn()
                .mockRejectedValue(new Error('INVALID_FIELD'));
            
            await expect(retryHandler.executeWithRetry(mockOperation, 'test operation'))
                .rejects.toThrow('INVALID_FIELD');
            
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        test('should fail after max retries', async () => {
            const mockOperation = jest.fn()
                .mockRejectedValue(new Error('UNABLE_TO_LOCK_ROW'));
            
            await expect(retryHandler.executeWithRetry(mockOperation, 'test operation'))
                .rejects.toThrow('Operation failed after 3 retries');
            
            expect(mockOperation).toHaveBeenCalledTimes(4); // Initial + 3 retries
        });
    });

    describe('isRetryableError', () => {
        test('should identify retryable Salesforce errors', () => {
            const retryableErrors = [
                new Error('UNABLE_TO_LOCK_ROW'),
                new Error('SERVER_UNAVAILABLE'),
                new Error('REQUEST_RUNNING_TOO_LONG'),
                new Error('STORAGE_LIMIT_EXCEEDED')
            ];
            
            retryableErrors.forEach(error => {
                expect(retryHandler.isRetryableError(error)).toBe(true);
            });
        });

        test('should identify retryable HTTP status codes', () => {
            const retryableStatusCodes = [429, 500, 502, 503, 504];
            
            retryableStatusCodes.forEach(statusCode => {
                const error = { statusCode };
                expect(retryHandler.isRetryableError(error)).toBe(true);
            });
        });

        test('should identify network errors', () => {
            const networkErrors = [
                { code: 'ECONNRESET' },
                { code: 'ETIMEDOUT' },
                { code: 'ENOTFOUND' },
                { code: 'ECONNREFUSED' }
            ];
            
            networkErrors.forEach(error => {
                expect(retryHandler.isRetryableError(error)).toBe(true);
            });
        });

        test('should not retry non-retryable errors', () => {
            const nonRetryableErrors = [
                new Error('INVALID_FIELD'),
                new Error('FIELD_CUSTOM_VALIDATION_EXCEPTION'),
                { statusCode: 400 },
                { statusCode: 401 },
                { statusCode: 403 },
                { statusCode: 404 }
            ];
            
            nonRetryableErrors.forEach(error => {
                expect(retryHandler.isRetryableError(error)).toBe(false);
            });
        });
    });

    describe('calculateDelay', () => {
        test('should calculate exponential backoff delays', () => {
            const delays = [];
            for (let i = 0; i < 4; i++) {
                delays.push(retryHandler.calculateDelay(i));
            }
            
            expect(delays[0]).toBe(100); // 100 * 2^0
            expect(delays[1]).toBe(200); // 100 * 2^1
            expect(delays[2]).toBe(400); // 100 * 2^2
            expect(delays[3]).toBe(800); // 100 * 2^3
        });

        test('should respect maximum delay', () => {
            const longRetryHandler = new RetryHandler({
                baseDelay: 500,
                maxDelay: 1000,
                exponentialBackoff: true,
                jitterFactor: 0
            });
            
            const delay = longRetryHandler.calculateDelay(5); // Would be 500 * 2^5 = 16000
            expect(delay).toBe(1000); // Capped at maxDelay
        });

        test('should use constant delay when exponential backoff is disabled', () => {
            const constantRetryHandler = new RetryHandler({
                baseDelay: 100,
                exponentialBackoff: false,
                jitterFactor: 0
            });
            
            expect(constantRetryHandler.calculateDelay(0)).toBe(100);
            expect(constantRetryHandler.calculateDelay(1)).toBe(100);
            expect(constantRetryHandler.calculateDelay(2)).toBe(100);
        });
    });

    describe('factory methods', () => {
        test('should create default retry handler', () => {
            const defaultHandler = RetryHandler.createDefault();
            
            expect(defaultHandler.maxRetries).toBe(3);
            expect(defaultHandler.baseDelay).toBe(1000);
            expect(defaultHandler.maxDelay).toBe(30000);
            expect(defaultHandler.exponentialBackoff).toBe(true);
        });

        test('should create aggressive retry handler', () => {
            const aggressiveHandler = RetryHandler.createAggressive();
            
            expect(aggressiveHandler.maxRetries).toBe(5);
            expect(aggressiveHandler.baseDelay).toBe(500);
            expect(aggressiveHandler.maxDelay).toBe(60000);
        });

        test('should create conservative retry handler', () => {
            const conservativeHandler = RetryHandler.createConservative();
            
            expect(conservativeHandler.maxRetries).toBe(2);
            expect(conservativeHandler.baseDelay).toBe(2000);
            expect(conservativeHandler.exponentialBackoff).toBe(false);
        });
    });
});