const RetryHandler = require('./retry');

class BatchFlowProcessor {
    constructor(flowClient, options = {}) {
        this.flowClient = flowClient;
        this.maxConcurrent = options.maxConcurrent || 3;
        this.rateLimitDelay = options.rateLimitDelay || 1000;
        this.timeoutSeconds = options.timeoutSeconds || 300;
        this.retryHandler = options.retryHandler || RetryHandler.createDefault();
        this.logger = options.logger || console;
        this.progressCallback = options.progressCallback || null;

        // Statistics
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
            startTime: null,
            endTime: null,
            errors: []
        };
    }

    async processBatch(flowNames, operation, operationName = 'process') {
        this.stats = {
            total: flowNames.length,
            completed: 0,
            failed: 0,
            skipped: 0,
            startTime: Date.now(),
            endTime: null,
            errors: []
        };

        this.logger.info(`Starting batch ${operationName} for ${flowNames.length} flows`);

        const results = [];

        // Process flows in chunks to respect rate limits
        for (let i = 0; i < flowNames.length; i += this.maxConcurrent) {
            const chunk = flowNames.slice(i, i + this.maxConcurrent);
            const chunkNumber = Math.floor(i / this.maxConcurrent) + 1;
            const totalChunks = Math.ceil(flowNames.length / this.maxConcurrent);

            this.logger.info(`Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} flows)`);

            // Process chunk in parallel
            const chunkPromises = chunk.map(flowName =>
                this.processFlowWithRetry(flowName, operation, operationName)
            );

            try {
                const chunkResults = await Promise.allSettled(chunkPromises);

                chunkResults.forEach((result, index) => {
                    const flowName = chunk[index];

                    if (result.status === 'fulfilled') {
                        const flowResult = result.value;
                        results.push(flowResult);

                        if (flowResult.success) {
                            this.stats.completed++;
                            if (flowResult.wasAlreadyActive || flowResult.wasAlreadyInactive) {
                                this.stats.skipped++;
                            }
                        } else {
                            this.stats.failed++;
                            this.stats.errors.push({
                                flowName: flowName,
                                error: flowResult.error || flowResult.message
                            });
                        }
                    } else {
                        const errorResult = {
                            success: false,
                            flowName: flowName,
                            message: `Failed to ${operationName} flow '${flowName}': ${result.reason.message}`,
                            error: result.reason.message
                        };

                        results.push(errorResult);
                        this.stats.failed++;
                        this.stats.errors.push({
                            flowName: flowName,
                            error: result.reason.message
                        });
                    }

                    // Report progress if callback provided
                    if (this.progressCallback) {
                        this.progressCallback({
                            total: this.stats.total,
                            completed: this.stats.completed + this.stats.failed,
                            successful: this.stats.completed,
                            failed: this.stats.failed,
                            skipped: this.stats.skipped,
                            flowName: flowName,
                            operationName: operationName
                        });
                    }
                });

                // Rate limiting delay between chunks
                if (i + this.maxConcurrent < flowNames.length && this.rateLimitDelay > 0) {
                    this.logger.debug(`Waiting ${this.rateLimitDelay}ms before next chunk...`);
                    await this.sleep(this.rateLimitDelay);
                }

            } catch (error) {
                this.logger.error(`Batch processing error in chunk ${chunkNumber}: ${error.message}`);

                // Add failed results for the entire chunk
                chunk.forEach(flowName => {
                    results.push({
                        success: false,
                        flowName: flowName,
                        message: `Failed to ${operationName} flow '${flowName}': ${error.message}`,
                        error: error.message
                    });
                    this.stats.failed++;
                });
            }
        }

        this.stats.endTime = Date.now();
        const duration = this.stats.endTime - this.stats.startTime;

        this.logger.info(`Batch ${operationName} completed in ${duration}ms`);
        this.logger.info(`Results: ${this.stats.completed} successful, ${this.stats.failed} failed, ${this.stats.skipped} skipped`);

        return {
            results: results,
            stats: this.stats,
            summary: {
                total: this.stats.total,
                successful: this.stats.completed,
                failed: this.stats.failed,
                skipped: this.stats.skipped,
                duration: duration,
                errors: this.stats.errors
            }
        };
    }

    async processFlowWithRetry(flowName, operation, operationName) {
        const context = `${operationName} flow '${flowName}'`;

        return await this.retryHandler.executeWithRetry(
            async () => {
                // Add timeout to the operation
                return await this.withTimeout(
                    operation(flowName),
                    this.timeoutSeconds * 1000,
                    `${operationName} operation for flow '${flowName}' timed out after ${this.timeoutSeconds}s`
                );
            },
            context,
            this.logger
        );
    }

    async withTimeout(promise, timeoutMs, timeoutMessage) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(timeoutMessage));
            }, timeoutMs);
        });

        return Promise.race([promise, timeoutPromise]);
    }

    async activateFlows(flowNames, targetVersion = null) {
        return await this.processBatch(
            flowNames,
            async (flowName) => await this.flowClient.activateFlow(flowName, targetVersion),
            'activate'
        );
    }

    async activateFlowsWithVersions(flowsData, globalVersion = null) {
        // flowsData is an array of { name, version } objects
        // If a flow has version: null, use globalVersion
        const flowNames = flowsData.map(f => f.name);

        return await this.processBatch(
            flowNames,
            async (flowName) => {
                // Find the flow data for this flow
                const flowData = flowsData.find(f => f.name === flowName);
                const targetVersion = flowData && flowData.version !== null ? flowData.version : globalVersion;
                return await this.flowClient.activateFlow(flowName, targetVersion);
            },
            'activate'
        );
    }

    async deactivateFlows(flowNames) {
        return await this.processBatch(
            flowNames,
            async (flowName) => await this.flowClient.deactivateFlow(flowName),
            'deactivate'
        );
    }

    async getFlowStatuses(flowNames) {
        return await this.processBatch(
            flowNames,
            async (flowName) => await this.flowClient.getFlowStatus(flowName),
            'status check'
        );
    }

    // Validation methods
    async validateFlowsExist(flowNames) {
        this.logger.info(`Validating ${flowNames.length} flows exist...`);

        const validationResults = await this.flowClient.validateFlowsExist(flowNames);
        const existingFlows = [];
        const nonExistentFlows = [];

        for (const [flowName, exists] of Object.entries(validationResults)) {
            if (exists) {
                existingFlows.push(flowName);
            } else {
                nonExistentFlows.push(flowName);
            }
        }

        if (nonExistentFlows.length > 0) {
            this.logger.warn(`${nonExistentFlows.length} flows not found: ${nonExistentFlows.join(', ')}`);
        }

        this.logger.info(`${existingFlows.length} flows validated successfully`);

        return {
            existingFlows,
            nonExistentFlows,
            validationResults
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return { ...this.stats };
    }

    resetStats() {
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
            startTime: null,
            endTime: null,
            errors: []
        };
    }
}

module.exports = BatchFlowProcessor;