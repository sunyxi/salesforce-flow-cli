const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
    constructor(options = {}) {
        this.logLevel = options.level || 'info';
        this.outputFile = options.outputFile || 'flow-operations.log';
        this.format = options.format || 'structured';
        this.enableConsole = options.enableConsole !== false;
        this.enableFile = options.enableFile !== false;
        
        this.logger = this.createLogger();
    }

    createLogger() {
        const logFormats = {
            simple: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level.toUpperCase()}] ${message}`;
                })
            ),
            structured: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            colorized: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level}] ${message}`;
                })
            )
        };

        const transports = [];

        // Console transport
        if (this.enableConsole) {
            transports.push(new winston.transports.Console({
                level: this.logLevel,
                format: logFormats.colorized
            }));
        }

        // File transport
        if (this.enableFile) {
            // Ensure log directory exists
            const logDir = path.dirname(this.outputFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            transports.push(new winston.transports.File({
                filename: this.outputFile,
                level: this.logLevel,
                format: logFormats[this.format] || logFormats.structured,
                maxsize: 5242880, // 5MB
                maxFiles: 5,
                tailable: true
            }));

            // Error-specific file
            transports.push(new winston.transports.File({
                filename: this.outputFile.replace(/\.log$/, '.error.log'),
                level: 'error',
                format: logFormats[this.format] || logFormats.structured,
                maxsize: 5242880, // 5MB
                maxFiles: 3,
                tailable: true
            }));
        }

        return winston.createLogger({
            level: this.logLevel,
            transports: transports,
            exceptionHandlers: [
                new winston.transports.File({ 
                    filename: this.outputFile.replace(/\.log$/, '.exceptions.log') 
                })
            ],
            rejectionHandlers: [
                new winston.transports.File({ 
                    filename: this.outputFile.replace(/\.log$/, '.rejections.log') 
                })
            ]
        });
    }

    // Standard logging methods
    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    verbose(message, meta = {}) {
        this.logger.verbose(message, meta);
    }

    // Specialized logging methods for flow operations
    logFlowOperation(operation, flowName, result, duration = null) {
        const meta = {
            operation,
            flowName,
            success: result.success,
            duration: duration
        };

        if (result.success) {
            const message = `${operation} flow '${flowName}' successful${duration ? ` (${duration}ms)` : ''}`;
            this.info(message, meta);
        } else {
            const message = `${operation} flow '${flowName}' failed: ${result.message || result.error}`;
            this.error(message, { ...meta, error: result.error });
        }
    }

    logBatchOperation(operation, stats) {
        const message = `Batch ${operation} completed: ${stats.successful} successful, ${stats.failed} failed, ${stats.skipped} skipped (${stats.duration}ms)`;
        
        if (stats.failed > 0) {
            this.warn(message, {
                operation: `batch_${operation}`,
                stats,
                errors: stats.errors
            });
        } else {
            this.info(message, {
                operation: `batch_${operation}`,
                stats
            });
        }
    }

    logValidation(flowNames, validationResult) {
        const { existingFlows, nonExistentFlows } = validationResult;
        
        if (nonExistentFlows.length > 0) {
            this.warn(`Flow validation: ${existingFlows.length} found, ${nonExistentFlows.length} not found`, {
                operation: 'validation',
                totalFlows: flowNames.length,
                existingCount: existingFlows.length,
                nonExistentCount: nonExistentFlows.length,
                nonExistentFlows
            });
        } else {
            this.info(`Flow validation: All ${existingFlows.length} flows found`, {
                operation: 'validation',
                totalFlows: flowNames.length,
                existingCount: existingFlows.length
            });
        }
    }

    logAuthAttempt(method, success, error = null) {
        if (success) {
            this.info(`Authentication successful using ${method}`, {
                operation: 'authentication',
                method,
                success: true
            });
        } else {
            this.error(`Authentication failed using ${method}: ${error}`, {
                operation: 'authentication',
                method,
                success: false,
                error
            });
        }
    }

    logRateLimit(delay, reason = '') {
        this.debug(`Rate limiting: waiting ${delay}ms${reason ? ` (${reason})` : ''}`, {
            operation: 'rate_limit',
            delay,
            reason
        });
    }

    logRetry(operation, attempt, maxAttempts, error, delay) {
        this.warn(`Retry ${attempt}/${maxAttempts} for ${operation} in ${delay}ms: ${error}`, {
            operation: 'retry',
            targetOperation: operation,
            attempt,
            maxAttempts,
            delay,
            error
        });
    }

    // Configuration and utility methods
    setLevel(level) {
        this.logLevel = level;
        this.logger.level = level;
        this.logger.transports.forEach(transport => {
            transport.level = level;
        });
    }

    getLevel() {
        return this.logLevel;
    }

    // Create child logger with additional context
    child(defaultMeta) {
        return {
            error: (message, meta = {}) => this.error(message, { ...defaultMeta, ...meta }),
            warn: (message, meta = {}) => this.warn(message, { ...defaultMeta, ...meta }),
            info: (message, meta = {}) => this.info(message, { ...defaultMeta, ...meta }),
            debug: (message, meta = {}) => this.debug(message, { ...defaultMeta, ...meta }),
            verbose: (message, meta = {}) => this.verbose(message, { ...defaultMeta, ...meta })
        };
    }

    // Static factory methods
    static createDefault(options = {}) {
        return new Logger({
            level: 'info',
            outputFile: 'flow-operations.log',
            format: 'structured',
            enableConsole: true,
            enableFile: true,
            ...options
        });
    }

    static createConsoleOnly(level = 'info') {
        return new Logger({
            level,
            enableConsole: true,
            enableFile: false
        });
    }

    static createFileOnly(outputFile, level = 'info') {
        return new Logger({
            level,
            outputFile,
            enableConsole: false,
            enableFile: true
        });
    }
}

module.exports = Logger;