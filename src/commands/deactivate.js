const AuthManager = require('../core/auth');
const FlowClient = require('../core/api/flow-client');
const BatchFlowProcessor = require('../core/batch/processor');
const Logger = require('../utils/logger');
const ProgressTracker = require('../utils/progress');
const chalk = require('chalk');

async function deactivateCommand(flowNames, options, config) {
    const logger = new Logger(config.getLoggingConfig());
    
    try {
        logger.info(`Starting deactivation of ${flowNames.length} flows`);
        
        // Safety check for production
        if (config.isProduction() && !options.force) {
            console.log(chalk.yellow('⚠️  You are about to deactivate flows in PRODUCTION'));
            console.log(chalk.yellow('   This action will stop these flows from running'));
            console.log(chalk.yellow('   Use --force flag to confirm this action'));
            console.log(chalk.cyan('\nFlows to deactivate:'));
            flowNames.forEach(flow => console.log(`   - ${flow}`));
            console.log(chalk.red('\n❌ Aborting deactivation (use --force to override)'));
            process.exit(1);
        }
        
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
            console.log(chalk.yellow('⚠️  No flows to deactivate'));
            return;
        }
        
        // Final confirmation for production
        if (config.isProduction() && options.force) {
            console.log(chalk.red.bold('🚨 PRODUCTION DEACTIVATION CONFIRMED'));
            console.log(chalk.yellow(`   Deactivating ${flowNames.length} flows in production...`));
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
                'deactivate',
                progress.flowName,
                progress.successful > progress.completed - 1, // Last operation was successful
                '', // Message will be filled by batch processor
                false // Skip status
            );
        };
        
        console.log(chalk.blue(`🛑 Deactivating ${flowNames.length} flows...`));
        
        // Process deactivation
        const result = await batchProcessor.deactivateFlows(flowNames);
        
        // Log batch operation
        logger.logBatchOperation('deactivate', result.summary);
        
        // Display results
        if (!options.quiet) {
            progressTracker.displaySummary();
        }
        
        // Show individual results if requested
        if (options.verbose) {
            console.log('\n' + chalk.bold('📋 Detailed Results:'));
            result.results.forEach((flowResult, index) => {
                const status = flowResult.success ? 
                    (flowResult.wasAlreadyInactive ? chalk.yellow('⊝ Already Inactive') : chalk.green('✓ Deactivated')) :
                    chalk.red('✗ Failed');
                
                console.log(`${index + 1}. ${chalk.cyan(flowResult.flowName || 'Unknown')} - ${status}`);
                if (flowResult.message) {
                    console.log(`   ${flowResult.message}`);
                }
            });
        }
        
        // Exit with appropriate code
        if (result.summary.failed > 0) {
            console.error(chalk.red(`\n❌ ${result.summary.failed} flows failed to deactivate`));
            process.exit(1);
        } else {
            console.log(chalk.green(`\n✅ Successfully deactivated ${result.summary.successful} flows`));
        }
        
    } catch (error) {
        logger.error(`Deactivation command failed: ${error.message}`);
        console.error(chalk.red(`❌ Deactivation failed: ${error.message}`));
        process.exit(1);
    }
}

module.exports = deactivateCommand;