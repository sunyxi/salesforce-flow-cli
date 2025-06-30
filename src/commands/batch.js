const fs = require('fs');
const path = require('path');
const AuthManager = require('../core/auth');
const FlowClient = require('../core/api/flow-client');
const BatchFlowProcessor = require('../core/batch/processor');
const Logger = require('../utils/logger');
const ProgressTracker = require('../utils/progress');
const chalk = require('chalk');

async function batchCommand(operation, options, config) {
    const logger = new Logger(config.getLoggingConfig());
    
    try {
        logger.info(`Starting batch ${operation} operation`);
        
        // Load flows from various sources
        let flows = [];
        
        // From file
        if (options.file) {
            flows = await loadFlowsFromFile(options.file);
            console.log(chalk.blue(`📄 Loaded ${flows.length} flows from file: ${options.file}`));
        }
        
        // From config
        if (options.useConfig) {
            const configFlows = config.getEnvironmentFlows();
            flows = flows.concat(configFlows);
            console.log(chalk.blue(`⚙️  Loaded ${configFlows.length} flows from configuration`));
        }
        
        // From command line arguments
        if (options.flows && options.flows.length > 0) {
            flows = flows.concat(options.flows);
            console.log(chalk.blue(`💻 Added ${options.flows.length} flows from command line`));
        }
        
        // Remove duplicates
        flows = [...new Set(flows)];
        
        if (flows.length === 0) {
            console.error(chalk.red('❌ No flows specified. Use --file, --use-config, or provide flow names'));
            process.exit(1);
        }
        
        console.log(chalk.blue(`📊 Total unique flows to process: ${flows.length}`));
        
        // Initialize authentication
        const authManager = new AuthManager(config.getConfig());
        await authManager.authenticate();
        logger.logAuthAttempt(config.get('auth.method'), true);
        
        // Initialize Flow client
        const flowClient = new FlowClient(authManager);
        
        // Initialize batch processor
        const batchProcessor = new BatchFlowProcessor(flowClient, {
            ...config.getBatchConfig(),
            logger
        });
        
        // Validate flows exist (if requested)
        if (options.validate) {
            console.log(chalk.blue('🔍 Validating flows exist...'));
            const validation = await batchProcessor.validateFlowsExist(flows);
            logger.logValidation(flows, validation);
            
            if (validation.nonExistentFlows.length > 0) {
                console.log(chalk.yellow(`⚠️  ${validation.nonExistentFlows.length} flows not found:`));
                validation.nonExistentFlows.forEach(flow => {
                    console.log(`   - ${flow}`);
                });
                
                if (options.ignoreNotFound) {
                    console.log(chalk.yellow('   Continuing with existing flows...'));
                    flows = validation.existingFlows;
                } else {
                    console.error(chalk.red('❌ Aborting due to missing flows'));
                    process.exit(1);
                }
            }
        }
        
        if (flows.length === 0) {
            console.log(chalk.yellow('⚠️  No valid flows to process'));
            return;
        }
        
        // Safety checks for production deactivation
        if (operation === 'deactivate' && config.isProduction() && !options.force) {
            console.log(chalk.red.bold('🚨 PRODUCTION DEACTIVATION WARNING'));
            console.log(chalk.yellow('   You are about to deactivate flows in PRODUCTION'));
            console.log(chalk.yellow(`   This will affect ${flows.length} flows and may impact business processes`));
            console.log(chalk.yellow('   Use --force flag to confirm this action'));
            console.log(chalk.red('\n❌ Aborting batch deactivation (use --force to override)'));
            process.exit(1);
        }
        
        // Create summary report before processing
        if (options.dryRun) {
            console.log(chalk.cyan('\n🧪 DRY RUN MODE - No changes will be made'));
            console.log(chalk.blue(`📋 Would ${operation} the following ${flows.length} flows:`));
            flows.forEach((flow, index) => {
                console.log(`   ${index + 1}. ${flow}`);
            });
            
            // Show current status if requested
            if (options.showStatus) {
                console.log(chalk.blue('\n📊 Current Status:'));
                const statusResult = await batchProcessor.getFlowStatuses(flows);
                statusResult.results.forEach(result => {
                    if (result.success) {
                        const status = result.isActive ? 
                            chalk.green('Active') : 
                            chalk.red('Inactive');
                        console.log(`   ${result.flowDefinition.DeveloperName}: ${status} (v${result.activeVersion})`);
                    }
                });
            }
            
            console.log(chalk.cyan('\n✅ Dry run completed - no changes made'));
            return;
        }
        
        // Initialize progress tracker
        const progressTracker = ProgressTracker.createForBatch(flows.length, {
            logger,
            showProgressBar: !options.quiet && config.get('cli.showProgressBar'),
            showDetailedOutput: !options.quiet && config.get('cli.showDetailedOutput')
        });
        
        // Setup progress callback
        batchProcessor.progressCallback = (progress) => {
            progressTracker.updateProgress(
                operation,
                progress.flowName,
                progress.successful > progress.completed - 1,
                '',
                false
            );
        };
        
        console.log(chalk.blue(`🚀 Starting batch ${operation} of ${flows.length} flows...`));
        
        // Execute batch operation
        let result;
        if (operation === 'activate') {
            result = await batchProcessor.activateFlows(flows);
        } else if (operation === 'deactivate') {
            result = await batchProcessor.deactivateFlows(flows);
        } else {
            throw new Error(`Unsupported batch operation: ${operation}`);
        }
        
        // Log batch operation
        logger.logBatchOperation(`batch_${operation}`, result.summary);
        
        // Display results
        if (!options.quiet) {
            progressTracker.displaySummary();
        }
        
        // Generate detailed report if requested
        if (options.report) {
            await generateDetailedReport(result, operation, options.report, logger);
        }
        
        // Show individual results if verbose
        if (options.verbose) {
            console.log('\n' + chalk.bold('📋 Detailed Results:'));
            result.results.forEach((flowResult, index) => {
                const status = getResultStatus(flowResult, operation);
                console.log(`${index + 1}. ${chalk.cyan(flowResult.flowName || 'Unknown')} - ${status}`);
                if (flowResult.message) {
                    console.log(`   ${flowResult.message}`);
                }
                if (flowResult.error && options.showErrors) {
                    console.log(`   ${chalk.red('Error:')} ${flowResult.error}`);
                }
            });
        }
        
        // Exit with appropriate code
        if (result.summary.failed > 0) {
            console.error(chalk.red(`\n❌ ${result.summary.failed} flows failed to ${operation}`));
            
            if (options.continueOnError) {
                console.log(chalk.yellow(`⚠️  --continue-on-error specified, exiting with success code`));
            } else {
                process.exit(1);
            }
        } else {
            console.log(chalk.green(`\n✅ Successfully processed ${result.summary.successful} flows`));
        }
        
    } catch (error) {
        logger.error(`Batch ${operation} command failed: ${error.message}`);
        console.error(chalk.red(`❌ Batch ${operation} failed: ${error.message}`));
        process.exit(1);
    }
}

async function loadFlowsFromFile(filePath) {
    try {
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
        
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`File not found: ${absolutePath}`);
        }
        
        const content = fs.readFileSync(absolutePath, 'utf8');
        const extension = path.extname(absolutePath).toLowerCase();
        
        let flows = [];
        
        if (extension === '.json') {
            const data = JSON.parse(content);
            
            // Support various JSON formats
            if (Array.isArray(data)) {
                flows = data;
            } else if (data.flows && Array.isArray(data.flows)) {
                flows = data.flows;
            } else if (data.flows && typeof data.flows === 'object') {
                // Flatten nested flow objects
                flows = Object.values(data.flows).flat();
            } else {
                throw new Error('Invalid JSON format. Expected array of flow names or object with flows property');
            }
        } else if (extension === '.txt' || extension === '.csv') {
            // Plain text file with one flow per line
            flows = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#')); // Filter empty lines and comments
        } else {
            throw new Error(`Unsupported file format: ${extension}. Supported formats: .json, .txt, .csv`);
        }
        
        // Validate flow names
        flows = flows.filter(flow => {
            if (typeof flow !== 'string' || flow.length === 0) {
                console.warn(chalk.yellow(`⚠️  Skipping invalid flow name: ${flow}`));
                return false;
            }
            return true;
        });
        
        return flows;
        
    } catch (error) {
        throw new Error(`Failed to load flows from file ${filePath}: ${error.message}`);
    }
}

function getResultStatus(flowResult, operation) {
    if (!flowResult.success) {
        return chalk.red('✗ Failed');
    }
    
    if (operation === 'activate') {
        return flowResult.wasAlreadyActive ? 
            chalk.yellow('⊝ Already Active') : 
            chalk.green('✓ Activated');
    } else if (operation === 'deactivate') {
        return flowResult.wasAlreadyInactive ? 
            chalk.yellow('⊝ Already Inactive') : 
            chalk.green('✓ Deactivated');
    }
    
    return chalk.green('✓ Success');
}

async function generateDetailedReport(result, operation, reportPath, logger) {
    try {
        const report = {
            timestamp: new Date().toISOString(),
            operation: operation,
            summary: result.summary,
            results: result.results.map(r => ({
                flowName: r.flowName,
                success: r.success,
                message: r.message,
                error: r.error,
                previousVersion: r.previousVersion,
                newVersion: r.newVersion,
                wasAlreadyActive: r.wasAlreadyActive,
                wasAlreadyInactive: r.wasAlreadyInactive
            }))
        };
        
        const reportJson = JSON.stringify(report, null, 2);
        fs.writeFileSync(reportPath, reportJson);
        
        console.log(chalk.blue(`📊 Detailed report saved to: ${reportPath}`));
        logger.info(`Generated detailed report: ${reportPath}`);
        
    } catch (error) {
        console.warn(chalk.yellow(`⚠️  Failed to generate report: ${error.message}`));
        logger.warn(`Failed to generate report: ${error.message}`);
    }
}

module.exports = batchCommand;