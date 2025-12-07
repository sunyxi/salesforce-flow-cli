const AuthManager = require('../core/auth');
const FlowClient = require('../core/api/flow-client');
const Logger = require('../utils/logger');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

async function getActiveVersionsCommand(options, config) {
    const logger = new Logger(config.getLoggingConfig());

    try {
        logger.info('Starting get active versions operation');

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

        // If no specific flows provided, get all flows
        if (flows.length === 0 && options.all) {
            console.log(chalk.blue('📊 Fetching all flows...'));
        } else if (flows.length === 0) {
            console.error(chalk.red('❌ No flows specified. Use --file, --use-config, --all, or provide flow names'));
            process.exit(1);
        }

        // Remove duplicates
        flows = [...new Set(flows)];

        if (flows.length > 0) {
            console.log(chalk.blue(`📊 Total unique flows to query: ${flows.length}`));
        }

        // Initialize authentication
        const authManager = new AuthManager(config.getConfig());
        await authManager.authenticate();
        logger.logAuthAttempt(config.get('auth.method'), true);

        // Initialize Flow client
        const flowClient = new FlowClient(authManager);

        // Get flow statuses
        let flowStatuses = [];

        if (options.all) {
            console.log(chalk.blue('🔍 Retrieving all flows...'));
            const allFlowDefs = await flowClient.getAllFlowDefinitions();

            for (const flowDef of allFlowDefs) {
                const activeVersion = flowDef.ActiveVersion?.VersionNumber || 0;
                const latestVersion = flowDef.LatestVersion?.VersionNumber || 0;

                flowStatuses.push({
                    name: flowDef.DeveloperName,
                    activeVersion: activeVersion,
                    latestVersion: latestVersion,
                    isActive: activeVersion > 0,
                    hasNewerVersion: latestVersion > activeVersion,
                    label: flowDef.MasterLabel,
                    description: flowDef.Description
                });
            }
        } else {
            console.log(chalk.blue('🔍 Retrieving flow versions...'));
            const result = await flowClient.getMultipleFlowStatuses(flows);

            if (!result.success) {
                console.error(chalk.red(`❌ Failed to get flow statuses: ${result.message}`));
                process.exit(1);
            }

            flowStatuses = result.statuses.map(status => ({
                name: status.name,
                activeVersion: status.activeVersion,
                latestVersion: status.latestVersion,
                isActive: status.isActive,
                hasNewerVersion: status.hasNewerVersion,
                label: status.masterLabel,
                description: status.description,
                error: status.error
            }));
        }

        // Filter by status if requested
        if (options.status) {
            const statusFilter = options.status.toLowerCase();
            if (statusFilter === 'active') {
                flowStatuses = flowStatuses.filter(f => f.isActive);
            } else if (statusFilter === 'inactive') {
                flowStatuses = flowStatuses.filter(f => !f.isActive);
            }
        }

        // Filter flows with updates available
        if (options.updatesAvailable) {
            flowStatuses = flowStatuses.filter(f => f.hasNewerVersion);
        }

        // Display results
        if (!options.quiet) {
            displayResults(flowStatuses, options);
        }

        // Export to file if requested
        if (options.output) {
            await exportResults(flowStatuses, options.output, options.format || 'json', logger);
        }

        // Summary
        const activeCount = flowStatuses.filter(f => f.isActive).length;
        const inactiveCount = flowStatuses.filter(f => !f.isActive).length;
        const updatesCount = flowStatuses.filter(f => f.hasNewerVersion).length;

        console.log(chalk.blue('\n📊 Summary:'));
        console.log(`   Total flows: ${flowStatuses.length}`);
        console.log(`   Active: ${chalk.green(activeCount)}`);
        console.log(`   Inactive: ${chalk.red(inactiveCount)}`);
        console.log(`   Updates available: ${chalk.yellow(updatesCount)}`);

    } catch (error) {
        logger.error(`Get active versions command failed: ${error.message}`);
        console.error(chalk.red(`❌ Command failed: ${error.message}`));
        process.exit(1);
    }
}

function displayResults(flowStatuses, options) {
    console.log(chalk.blue('\n📋 Flow Versions:\n'));

    if (options.format === 'table' || !options.format) {
        // Table format
        const maxNameLength = Math.max(...flowStatuses.map(f => f.name.length), 20);
        const header = `${'Name'.padEnd(maxNameLength)} | Active | Latest | Status`;
        console.log(chalk.bold(header));
        console.log('-'.repeat(header.length));

        flowStatuses.forEach(flow => {
            if (flow.error) {
                console.log(`${flow.name.padEnd(maxNameLength)} | ${chalk.red('ERROR: ' + flow.error)}`);
            } else {
                const statusIcon = flow.isActive ? chalk.green('✓') : chalk.red('✗');
                const updateIcon = flow.hasNewerVersion ? chalk.yellow('⚠') : ' ';
                const activeVer = flow.activeVersion.toString().padStart(6);
                const latestVer = flow.latestVersion.toString().padStart(6);

                console.log(`${flow.name.padEnd(maxNameLength)} | ${activeVer} | ${latestVer} | ${statusIcon} ${updateIcon}`);
            }
        });
    } else if (options.format === 'simple') {
        // Simple format - just name and version
        flowStatuses.forEach(flow => {
            if (!flow.error) {
                console.log(`${flow.name}: v${flow.activeVersion}`);
            }
        });
    } else if (options.format === 'detailed') {
        // Detailed format
        flowStatuses.forEach(flow => {
            if (flow.error) {
                console.log(chalk.red(`❌ ${flow.name}: ${flow.error}`));
            } else {
                const status = flow.isActive ? chalk.green('Active') : chalk.red('Inactive');
                console.log(chalk.cyan(`\n📋 ${flow.name}`));
                console.log(`   Label: ${flow.label || 'N/A'}`);
                console.log(`   Status: ${status}`);
                console.log(`   Active Version: ${flow.activeVersion}`);
                console.log(`   Latest Version: ${flow.latestVersion}`);
                if (flow.hasNewerVersion) {
                    console.log(chalk.yellow(`   ⚠ Update available!`));
                }
                if (flow.description) {
                    console.log(`   Description: ${flow.description}`);
                }
            }
        });
    }
}

async function exportResults(flowStatuses, outputPath, format, logger) {
    try {
        const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.resolve(outputPath);
        let content;

        if (format === 'json') {
            const exportData = {
                timestamp: new Date().toISOString(),
                totalFlows: flowStatuses.length,
                flows: flowStatuses
            };
            content = JSON.stringify(exportData, null, 2);
        } else if (format === 'csv') {
            // CSV format
            const headers = 'Name,Active Version,Latest Version,Is Active,Has Updates,Label,Description\n';
            const rows = flowStatuses.map(flow => {
                const name = `"${flow.name}"`;
                const label = `"${flow.label || ''}"`;
                const description = `"${(flow.description || '').replace(/"/g, '""')}"`;
                return `${name},${flow.activeVersion},${flow.latestVersion},${flow.isActive},${flow.hasNewerVersion},${label},${description}`;
            }).join('\n');
            content = headers + rows;
        } else if (format === 'txt') {
            // Plain text format
            content = flowStatuses.map(flow => {
                if (flow.error) {
                    return `${flow.name}: ERROR - ${flow.error}`;
                }
                return `${flow.name}: Active v${flow.activeVersion}, Latest v${flow.latestVersion}${flow.hasNewerVersion ? ' (Update available)' : ''}`;
            }).join('\n');
        } else {
            throw new Error(`Unsupported export format: ${format}`);
        }

        fs.writeFileSync(absolutePath, content);
        console.log(chalk.blue(`\n💾 Results exported to: ${absolutePath}`));
        logger.info(`Exported results to: ${absolutePath}`);

    } catch (error) {
        console.warn(chalk.yellow(`⚠️  Failed to export results: ${error.message}`));
        logger.warn(`Failed to export results: ${error.message}`);
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

module.exports = getActiveVersionsCommand;
