const ConfigManager = require('../../src/utils/config');
const fs = require('fs');
const path = require('path');

// Mock environment variables
const originalEnv = process.env;

describe('ConfigManager', () => {
    beforeEach(() => {
        // Reset environment variables
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('constructor', () => {
        test('should create instance with default configuration', () => {
            const config = new ConfigManager();
            expect(config.get('auth.method')).toBe('jwt');
            expect(config.get('batch.maxConcurrent')).toBe(3);
            expect(config.get('logging.level')).toBe('info');
        });
    });

    describe('environment variable loading', () => {
        test('should load auth configuration from environment variables', () => {
            process.env.SF_CLIENT_ID = 'test-client-id';
            process.env.SF_USERNAME = 'test@example.com';
            process.env.SF_PRIVATE_KEY_PATH = '/path/to/key';
            process.env.SF_SANDBOX = 'true';

            const config = new ConfigManager();
            
            expect(config.get('auth.clientId')).toBe('test-client-id');
            expect(config.get('auth.username')).toBe('test@example.com');
            expect(config.get('auth.privateKeyPath')).toBe('/path/to/key');
            expect(config.get('auth.sandbox')).toBe(true);
        });

        test('should load batch configuration from environment variables', () => {
            process.env.SF_MAX_CONCURRENT = '5';
            process.env.SF_RATE_LIMIT_DELAY = '2000';
            process.env.SF_MAX_RETRIES = '4';

            const config = new ConfigManager();
            
            expect(config.get('batch.maxConcurrent')).toBe(5);
            expect(config.get('batch.rateLimitDelay')).toBe(2000);
            expect(config.get('batch.maxRetries')).toBe(4);
        });
    });

    describe('configuration validation', () => {
        test('should validate required auth fields', () => {
            expect(() => {
                new ConfigManager();
            }).toThrow('Configuration validation failed');
        });

        test('should validate batch configuration ranges', () => {
            process.env.SF_CLIENT_ID = 'test';
            process.env.SF_USERNAME = 'test@example.com';
            process.env.SF_PRIVATE_KEY_PATH = '/path/to/key';
            process.env.SF_MAX_CONCURRENT = '15'; // Invalid: too high

            expect(() => {
                new ConfigManager();
            }).toThrow('maxConcurrent must be between 1 and 10');
        });
    });

    describe('nested configuration access', () => {
        test('should get nested configuration values', () => {
            process.env.SF_CLIENT_ID = 'test';
            process.env.SF_USERNAME = 'test@example.com';
            process.env.SF_PRIVATE_KEY_PATH = '/path/to/key';

            const config = new ConfigManager();
            
            expect(config.get('auth.method')).toBe('jwt');
            expect(config.get('batch.maxConcurrent')).toBe(3);
            expect(config.get('nonexistent.key')).toBeUndefined();
        });

        test('should set nested configuration values', () => {
            process.env.SF_CLIENT_ID = 'test';
            process.env.SF_USERNAME = 'test@example.com';
            process.env.SF_PRIVATE_KEY_PATH = '/path/to/key';

            const config = new ConfigManager();
            config.set('auth.method', 'oauth');
            config.set('custom.nested.value', 'test');
            
            expect(config.get('auth.method')).toBe('oauth');
            expect(config.get('custom.nested.value')).toBe('test');
        });
    });

    describe('environment helpers', () => {
        test('should correctly identify production environment', () => {
            process.env.SF_CLIENT_ID = 'test';
            process.env.SF_USERNAME = 'test@example.com';
            process.env.SF_PRIVATE_KEY_PATH = '/path/to/key';
            process.env.SF_SANDBOX = 'false';

            const config = new ConfigManager();
            
            expect(config.isProduction()).toBe(true);
            expect(config.isSandbox()).toBe(false);
        });

        test('should correctly identify sandbox environment', () => {
            process.env.SF_CLIENT_ID = 'test';
            process.env.SF_USERNAME = 'test@example.com';
            process.env.SF_PRIVATE_KEY_PATH = '/path/to/key';
            process.env.SF_SANDBOX = 'true';

            const config = new ConfigManager();
            
            expect(config.isProduction()).toBe(false);
            expect(config.isSandbox()).toBe(true);
        });
    });
});