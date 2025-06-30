const AuthManager = require('../core/auth');
const FlowClient = require('../core/api/flow-client');
const BatchFlowProcessor = require('../core/batch/processor');
const Logger = require('../utils/logger');
const ProgressTracker = require('../utils/progress');
const chalk = require('chalk');

async function activateCommand(flowNames, options, config) {
    const logger = new Logger(config.getLoggingConfig());
    
    try {
        logger.info(`Starting activation of ${flowNames.length} flows`);
        
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
            const validation = await batchProcessor.validateFlowsExist(flowNames);
            logger.logValidation(flowNames, validation);
            
            if (validation.nonExistentFlows.length > 0) {
                if (options.ignoreNotFound) {
                    console.log(chalk.yellow(`⚠️  ${validation.nonExistentFlows.length} flows not found, continuing with existing flows...`));
                    flowNames = validation.existingFlows;
                } else {
                    console.error(chalk.red(`❌ ${validation.nonExistentFlows.length} flows not found:`));
                    validation.nonExistentFlows.forEach(flow => {
                        console.error(`   - ${flow}`);
                    });
                    process.exit(1);
                }
            }
        }
        
        if (flowNames.length === 0) {
            console.log(chalk.yellow('⚠️  No flows to activate'));
            return;
        }
        
        // Initialize progress tracker
        const progressTracker = ProgressTracker.createForBatch(flowNames.length, {
            logger,
            showProgressBar: !options.quiet && config.get('cli.showProgressBar'),
            showDetailedOutput: !options.quiet && config.get('cli.showDetailedOutput')
        });
        
        // Setup progress callback
        batchProcessor.progressCallback = (progress) => {
            progressTracker.updateProgress(
                'activate',
                progress.flowName,
                progress.successful > progress.completed - 1, // Last operation was successful
                '', // Message will be filled by batch processor
                false // Skip status
            );
        };
        
        console.log(chalk.blue(`🚀 Activating ${flowNames.length} flows...`));
        
        // Process activation
        const result = await batchProcessor.activateFlows(flowNames);
        
        // Log batch operation
        logger.logBatchOperation('activate', result.summary);
        
        // Display results
        if (!options.quiet) {
            progressTracker.displaySummary();
        }
        
        // Show individual results if requested
        if (options.verbose) {
            console.log('\n' + chalk.bold('📋 Detailed Results:'));
            result.results.forEach((flowResult, index) => {
                const status = flowResult.success ? 
                    (flowResult.wasAlreadyActive ? chalk.yellow('⊝ Already Active') : chalk.green('✓ Activated')) :
                    chalk.red('✗ Failed');
                
                console.log(`${index + 1}. ${chalk.cyan(flowResult.flowName || 'Unknown')} - ${status}`);
                if (flowResult.message) {
                    console.log(`   ${flowResult.message}`);
                }
            });
        }
        
        // Exit with appropriate code
        if (result.summary.failed > 0) {
            console.error(chalk.red(`\n❌ ${result.summary.failed} flows failed to activate`));
            process.exit(1);
        } else {
            console.log(chalk.green(`\n✅ Successfully activated ${result.summary.successful} flows`));
        }
        
    } catch (error) {
        logger.error(`Activation command failed: ${error.message}`);
        console.error(chalk.red(`❌ Activation failed: ${error.message}`));
        process.exit(1);
    }
}

module.exports = activateCommand;