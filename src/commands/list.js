const AuthManager = require('../core/auth');
const FlowClient = require('../core/api/flow-client');
const Logger = require('../utils/logger');
const chalk = require('chalk');

async function listCommand(options, config) {
    const logger = new Logger(config.getLoggingConfig());
    
    try {
        logger.info('Starting flow list operation');
        
        // Initialize authentication
        const authManager = new AuthManager(config.getConfig());
        await authManager.authenticate();
        logger.logAuthAttempt(config.get('auth.method'), true);
        
        // Initialize Flow client
        const flowClient = new FlowClient(authManager);
        
        let flows;
        
        if (options.flows && options.flows.length > 0) {
            // Get specific flows
            console.log(chalk.blue(`🔍 Retrieving information for ${options.flows.length} flows...`));
            const result = await flowClient.getMultipleFlowStatuses(options.flows);
            
            if (!result.success) {
                throw new Error(result.message);
            }
            
            flows = result.statuses;
        } else {
            // Get all flows
            console.log(chalk.blue('🔍 Retrieving all flows...'));
            const flowDefinitions = await flowClient.getAllFlowDefinitions();
            
            flows = await Promise.all(flowDefinitions.map(async (flowDef) => {
                const flowTypeInfo = await flowClient.identifyFlowType(flowDef);
                
                const currentActiveVersion = flowDef.ActiveVersion?.VersionNumber || 0;
                const latestVersionFromDef = flowDef.LatestVersion?.VersionNumber || 0;
                
                return {
                    name: flowDef.DeveloperName,
                    flowType: flowTypeInfo.type || flowTypeInfo,
                    isActive: currentActiveVersion > 0,
                    activeVersion: currentActiveVersion,
                    latestVersion: latestVersionFromDef,
                    hasNewerVersion: latestVersionFromDef > currentActiveVersion,
                    description: flowDef.Description,
                    masterLabel: flowDef.MasterLabel,
                    canActivateViaAPI: flowTypeInfo.canActivateViaAPI !== false
                };
            }));
        }
        
        // Filter flows if requested
        if (options.type) {
            const typeFilter = options.type.toLowerCase();
            flows = flows.filter(flow => {
                const flowType = flow.flowType.toLowerCase();
                return flowType.includes(typeFilter) || 
                       (typeFilter === 'screen' && flowType.includes('screenflow')) ||
                       (typeFilter === 'record' && flowType.includes('recordtriggered')) ||
                       (typeFilter === 'scheduled' && flowType.includes('scheduled'));
            });
        }
        
        if (options.status) {
            const statusFilter = options.status.toLowerCase();
            flows = flows.filter(flow => {
                if (statusFilter === 'active') return flow.isActive;
                if (statusFilter === 'inactive') return !flow.isActive;
                return true;
            });
        }
        
        // Sort flows
        flows.sort((a, b) => {
            if (options.sortBy === 'type') {
                return a.flowType.localeCompare(b.flowType) || a.name.localeCompare(b.name);
            } else if (options.sortBy === 'status') {
                if (a.isActive !== b.isActive) {
                    return b.isActive - a.isActive; // Active first
                }
                return a.name.localeCompare(b.name);
            } else {
                return a.name.localeCompare(b.name); // Default: sort by name
            }
        });
        
        // Display results
        console.log(chalk.bold(`\n📋 Found ${flows.length} flows`));
        
        if (flows.length === 0) {
            console.log(chalk.yellow('No flows found matching the criteria'));
            return;
        }
        
        if (options.format === 'json') {
            console.log(JSON.stringify(flows, null, 2));
        } else if (options.format === 'csv') {
            // CSV output
            console.log('Name,Type,Status,ActiveVersion,LatestVersion,HasNewerVersion,Description');
            flows.forEach(flow => {
                const csvRow = [
                    flow.name,
                    flow.flowType,
                    flow.isActive ? 'Active' : 'Inactive',
                    flow.activeVersion,
                    flow.latestVersion,
                    flow.hasNewerVersion ? 'Yes' : 'No',
                    (flow.description || '').replace(/,/g, ';') // Replace commas in description
                ].join(',');
                console.log(csvRow);
            });
        } else {
            // Table format (default)
            displayFlowTable(flows, options);
        }
        
        // Summary statistics
        if (!options.quiet && options.format === 'table') {
            displaySummary(flows);
        }
        
        logger.info(`Listed ${flows.length} flows successfully`);
        
    } catch (error) {
        logger.error(`List command failed: ${error.message}`);
        console.error(chalk.red(`❌ Failed to list flows: ${error.message}`));
        process.exit(1);
    }
}

function displayFlowTable(flows, options) {
    const maxNameLength = Math.max(20, Math.max(...flows.map(f => f.name.length)));
    const maxTypeLength = Math.max(15, Math.max(...flows.map(f => f.flowType.length)));
    
    // Header
    console.log('\n' + chalk.bold(
        'Name'.padEnd(maxNameLength) + ' | ' +
        'Type'.padEnd(maxTypeLength) + ' | ' +
        'Status'.padEnd(8) + ' | ' +
        'Ver'.padEnd(4) + ' | ' +
        'Latest'.padEnd(6) + ' | ' +
        'Updates'
    ));
    
    console.log(
        '-'.repeat(maxNameLength) + '-+-' +
        '-'.repeat(maxTypeLength) + '-+-' +
        '-'.repeat(8) + '-+-' +
        '-'.repeat(4) + '-+-' +
        '-'.repeat(6) + '-+-' +
        '-'.repeat(7)
    );
    
    // Rows
    flows.forEach(flow => {
        const name = flow.name.length > maxNameLength ? 
            flow.name.substring(0, maxNameLength - 3) + '...' : 
            flow.name.padEnd(maxNameLength);
            
        const type = flow.flowType.length > maxTypeLength ? 
            flow.flowType.substring(0, maxTypeLength - 3) + '...' : 
            flow.flowType.padEnd(maxTypeLength);
            
        const status = flow.isActive ? 
            chalk.green('Active') : 
            chalk.red('Inactive');
            
        const version = flow.activeVersion.toString().padEnd(4);
        const latest = flow.latestVersion.toString().padEnd(6);
        const updates = flow.hasNewerVersion ? 
            chalk.yellow('Yes') : 
            'No';
            
        console.log(
            chalk.cyan(name) + ' | ' +
            type + ' | ' +
            status.padEnd(8) + ' | ' +
            version + ' | ' +
            latest + ' | ' +
            updates
        );
        
        // Show description if verbose
        if (options.verbose && flow.description) {
            const description = flow.description.length > 80 ? 
                flow.description.substring(0, 77) + '...' : 
                flow.description;
            console.log(chalk.gray(`  ${description}`));
        }
    });
}

function displaySummary(flows) {
    const totalFlows = flows.length;
    const activeFlows = flows.filter(f => f.isActive).length;
    const inactiveFlows = totalFlows - activeFlows;
    const flowsWithUpdates = flows.filter(f => f.hasNewerVersion).length;
    
    // Count by type
    const typeStats = {};
    flows.forEach(flow => {
        typeStats[flow.flowType] = (typeStats[flow.flowType] || 0) + 1;
    });
    
    console.log('\n' + chalk.bold('📊 Summary:'));
    console.log(`${chalk.bold('Total:')} ${totalFlows}`);
    console.log(`${chalk.green('Active:')} ${activeFlows}`);
    console.log(`${chalk.red('Inactive:')} ${inactiveFlows}`);
    console.log(`${chalk.yellow('With Updates:')} ${flowsWithUpdates}`);
    
    console.log('\n' + chalk.bold('By Type:'));
    Object.entries(typeStats).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });
}

module.exports = listCommand;