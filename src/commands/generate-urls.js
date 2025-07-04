const AuthManager = require('../core/auth');
const FlowClient = require('../core/api/flow-client');
const Logger = require('../utils/logger');
const chalk = require('chalk');

async function generateUrlsCommand(flowNames, options, config) {
    const logger = new Logger(config.getLoggingConfig());
    
    try {
        logger.info(`Generating Salesforce URLs for ${flowNames.length} flows`);
        
        // Initialize authentication
        const authManager = new AuthManager(config.getConfig());
        await authManager.authenticate();
        logger.logAuthAttempt(config.get('auth.method'), true);
        
        // Get instance URL
        const instanceUrl = authManager.getInstanceUrl();
        
        // Initialize Flow client
        const flowClient = new FlowClient(authManager);
        
        console.log(chalk.blue(`🔗 Generating Salesforce URLs for ${flowNames.length} flows...\n`));
        
        const results = [];
        
        for (const flowName of flowNames) {
            try {
                const flowDef = await flowClient.getFlowDefinition(flowName);
                const flowTypeInfo = await flowClient.identifyFlowType(flowDef);
                const versionInfo = await flowClient.getFlowVersionInfo(flowName);
                
                const currentActiveVersion = flowDef.ActiveVersion?.VersionNumber || 0;
                const { latestVersion } = versionInfo;
                
                // Generate Flow setup URL (Flow Definition management)
                const flowSetupUrl = `${instanceUrl}/lightning/setup/Flows/page?address=%2F${flowDef.Id}`;
                
                // Generate direct flow builder URL for editing
                let flowBuilderUrl = null;
                let flowActivateUrl = null;
                
                if (latestVersion > 0) {
                    // Get the Flow record ID for the latest version
                    const latestFlowQuery = `
                        SELECT Id FROM Flow 
                        WHERE DefinitionId = '${flowDef.Id}' AND VersionNumber = ${latestVersion}
                    `;
                    const latestFlowResult = await flowClient.toolingAPI.query(latestFlowQuery);
                    
                    if (latestFlowResult.records.length > 0) {
                        const flowId = latestFlowResult.records[0].Id;
                        
                        // Direct Flow Builder URL for editing
                        flowBuilderUrl = `${instanceUrl}/builder_platform_interaction/flowBuilder.app?flowId=${flowId}`;
                        
                        // Flow Details URL for activation (better for activation)
                        flowActivateUrl = `${instanceUrl}/lightning/setup/Flows/page?address=%2F${flowId}`;
                    }
                }
                
                const result = {
                    flowName: flowName,
                    flowType: flowTypeInfo.type || 'Flow',
                    canActivateViaAPI: flowTypeInfo.canActivateViaAPI !== false,
                    isActive: currentActiveVersion > 0,
                    activeVersion: currentActiveVersion,
                    latestVersion: latestVersion,
                    flowSetupUrl: flowSetupUrl,
                    flowBuilderUrl: flowBuilderUrl,
                    flowActivateUrl: flowActivateUrl
                };
                
                results.push(result);
                
                // Display result
                console.log(chalk.cyan(`📋 ${flowName}`));
                
                if (options.builderOnly) {
                    // Show only Flow Builder URL for simplified output
                    console.log(`   Status: ${result.isActive ? chalk.green('Active') : chalk.yellow('Inactive')} (v${result.activeVersion}/${result.latestVersion})`);
                    if (result.flowBuilderUrl) {
                        console.log(`   🔧 Flow Builder: ${chalk.blue(result.flowBuilderUrl)}`);
                    } else {
                        console.log(`   ⚠️  No latest version available for editing`);
                    }
                } else {
                    // Show all URLs
                    console.log(`   Type: ${result.flowType}`);
                    console.log(`   Status: ${result.isActive ? chalk.green('Active') : chalk.yellow('Inactive')} (v${result.activeVersion}/${result.latestVersion})`);
                    console.log(`   API Activation: ${result.canActivateViaAPI ? chalk.green('✓ Supported') : chalk.red('✗ Not Supported (UI Required)')}`);
                    console.log(`   📱 Flow Setup: ${chalk.blue(result.flowSetupUrl)}`);
                    
                    if (result.flowBuilderUrl) {
                        console.log(`   🔧 Flow Builder: ${chalk.blue(result.flowBuilderUrl)}`);
                    }
                    
                    if (result.flowActivateUrl && !result.isActive) {
                        console.log(`   ⚡ Activate: ${chalk.blue(result.flowActivateUrl)}`);
                    }
                }
                
                console.log('');
                
            } catch (error) {
                const errorResult = {
                    flowName: flowName,
                    error: error.message
                };
                results.push(errorResult);
                
                console.log(chalk.red(`❌ ${flowName}: ${error.message}\n`));
            }
        }
        
        // Generate summary report
        if (options.output) {
            const reportData = {
                generatedAt: new Date().toISOString(),
                instanceUrl: instanceUrl,
                environment: config.get('auth.sandbox') ? 'SANDBOX' : 'PRODUCTION',
                flows: results
            };
            
            const fs = require('fs');
            fs.writeFileSync(options.output, JSON.stringify(reportData, null, 2));
            console.log(chalk.green(`📄 Report saved to: ${options.output}`));
        }
        
        // Summary
        const successful = results.filter(r => !r.error).length;
        const requiresUI = results.filter(r => !r.error && !r.canActivateViaAPI).length;
        
        console.log(chalk.blue('📊 Summary:'));
        console.log(`   Total: ${results.length}`);
        console.log(`   Successful: ${successful}`);
        console.log(`   Requires UI Activation: ${requiresUI}`);
        console.log(`   Failed: ${results.length - successful}`);
        
        if (requiresUI > 0) {
            console.log(chalk.yellow(`\n⚠️  ${requiresUI} flows require manual activation through Salesforce UI`));
            console.log(chalk.white('   💡 Tip: Use the generated URLs above to quickly navigate to each flow'));
        }
        
        // Show URL list for easy copying if requested
        if (options.urlList) {
            console.log(chalk.blue('\n📋 URL List (for easy copying):'));
            results.filter(r => !r.error && r.flowBuilderUrl).forEach(r => {
                console.log(r.flowBuilderUrl);
            });
        }
        
        logger.info(`Generated URLs for ${successful} flows successfully`);
        
    } catch (error) {
        logger.error(`Generate URLs command failed: ${error.message}`);
        console.error(chalk.red(`❌ Failed to generate URLs: ${error.message}`));
        process.exit(1);
    }
}

module.exports = generateUrlsCommand;