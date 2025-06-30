const chalk = require('chalk');
const cliProgress = require('cli-progress');

class ProgressTracker {
    constructor(total, options = {}) {
        this.total = total;
        this.completed = 0;
        this.failed = 0;
        this.skipped = 0;
        this.startTime = Date.now();
        this.logger = options.logger || console;
        this.showProgressBar = options.showProgressBar !== false;
        this.showDetailedOutput = options.showDetailedOutput !== false;
        
        // Initialize progress bar
        if (this.showProgressBar && total > 1) {
            this.progressBar = new cliProgress.SingleBar({
                format: `Progress |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} | Success: ${chalk.green('{successful}')} | Failed: ${chalk.red('{failed}')} | Skipped: ${chalk.yellow('{skipped}')} | ETA: {eta}s`,
                barCompleteChar: '█',
                barIncompleteChar: '░',
                hideCursor: true
            });
            
            this.progressBar.start(total, 0, {
                successful: 0,
                failed: 0,
                skipped: 0
            });
        }
        
        this.operations = [];
    }

    updateProgress(operation, flowName, success, message = '', wasSkipped = false) {
        const timestamp = new Date().toISOString();
        const duration = Date.now() - this.startTime;
        
        if (success) {
            this.completed++;
            if (wasSkipped) {
                this.skipped++;
            }
        } else {
            this.failed++;
        }
        
        // Store operation details
        this.operations.push({
            timestamp,
            operation,
            flowName,
            success,
            message,
            wasSkipped,
            duration
        });
        
        // Update progress bar
        if (this.progressBar) {
            const processed = this.completed + this.failed;
            this.progressBar.update(processed, {
                successful: this.completed,
                failed: this.failed,
                skipped: this.skipped
            });
        }
        
        // Show detailed output
        if (this.showDetailedOutput) {
            this.displayOperationResult(operation, flowName, success, message, wasSkipped);
        }
    }

    displayOperationResult(operation, flowName, success, message, wasSkipped) {
        const processed = this.completed + this.failed;
        const percentage = Math.round((processed / this.total) * 100);
        const prefix = `[${processed}/${this.total}] (${percentage}%)`;
        
        if (success) {
            if (wasSkipped) {
                console.log(`${prefix} ${chalk.yellow('⊝')} ${operation} ${chalk.cyan(flowName)} ${chalk.yellow('(skipped)')} - ${message}`);
            } else {
                console.log(`${prefix} ${chalk.green('✓')} ${operation} ${chalk.cyan(flowName)} - ${message}`);
            }
        } else {
            console.log(`${prefix} ${chalk.red('✗')} ${operation} ${chalk.cyan(flowName)} - ${chalk.red(message)}`);
        }
    }

    displaySummary() {
        const endTime = Date.now();
        const totalDuration = endTime - this.startTime;
        const processed = this.completed + this.failed;
        
        // Complete progress bar
        if (this.progressBar) {
            this.progressBar.stop();
        }
        
        console.log('\n' + chalk.bold('=== Operation Summary ==='));
        console.log(`${chalk.bold('Total flows:')} ${this.total}`);
        console.log(`${chalk.bold('Processed:')} ${processed}`);
        console.log(`${chalk.green('✓ Successful:')} ${this.completed - this.skipped}`);
        console.log(`${chalk.yellow('⊝ Skipped:')} ${this.skipped}`);
        console.log(`${chalk.red('✗ Failed:')} ${this.failed}`);
        console.log(`${chalk.bold('Duration:')} ${this.formatDuration(totalDuration)}`);
        
        if (processed > 0) {
            const successRate = Math.round(((this.completed) / processed) * 100);
            console.log(`${chalk.bold('Success Rate:')} ${successRate}%`);
            
            const avgTime = Math.round(totalDuration / processed);
            console.log(`${chalk.bold('Average Time:')} ${avgTime}ms per flow`);
        }
        
        // Show errors if any
        if (this.failed > 0) {
            console.log('\n' + chalk.red.bold('❌ Failed Operations:'));
            const failures = this.operations.filter(op => !op.success);
            failures.forEach((failure, index) => {
                console.log(`${index + 1}. ${chalk.cyan(failure.flowName)}: ${failure.message}`);
            });
        }
        
        // Show skipped if any
        if (this.skipped > 0) {
            console.log('\n' + chalk.yellow.bold('⊝ Skipped Operations:'));
            const skippedOps = this.operations.filter(op => op.wasSkipped);
            skippedOps.forEach((skipped, index) => {
                console.log(`${index + 1}. ${chalk.cyan(skipped.flowName)}: ${skipped.message}`);
            });
        }
    }

    formatDuration(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }
    }

    getStats() {
        return {
            total: this.total,
            completed: this.completed,
            failed: this.failed,
            skipped: this.skipped,
            processed: this.completed + this.failed,
            duration: Date.now() - this.startTime,
            operations: [...this.operations]
        };
    }

    isComplete() {
        return (this.completed + this.failed) >= this.total;
    }

    hasErrors() {
        return this.failed > 0;
    }

    getSuccessRate() {
        const processed = this.completed + this.failed;
        return processed > 0 ? (this.completed / processed) * 100 : 0;
    }

    // Static method to create progress tracker for different scenarios
    static createForBatch(total, options = {}) {
        return new ProgressTracker(total, {
            showProgressBar: true,
            showDetailedOutput: true,
            ...options
        });
    }

    static createQuiet(total, logger = null) {
        return new ProgressTracker(total, {
            showProgressBar: false,
            showDetailedOutput: false,
            logger
        });
    }

    static createVerbose(total, logger = null) {
        return new ProgressTracker(total, {
            showProgressBar: true,
            showDetailedOutput: true,
            logger
        });
    }
}

module.exports = ProgressTracker;