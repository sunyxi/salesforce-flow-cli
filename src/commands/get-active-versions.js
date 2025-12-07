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
        let flowsData = [];
        let hasTargetVersions = false;

        // From file
        if (options.file) {
            flowsData = await loadFlowsFromFile(options.file);
            console.log(chalk.blue(`📄 Loaded ${flowsData.length} flows from file: ${options.file}`));

            // Check if any flows have target versions specified
            hasTargetVersions = flowsData.some(f => f.targetVersion !== null);
            if (hasTargetVersions) {
                const withVersions = flowsData.filter(f => f.targetVersion !== null).length;
                console.log(chalk.blue(`📌 ${withVersions} flows have target versions specified`));
            }
        }

        // From config
        if (options.useConfig) {
            const configFlows = config.getEnvironmentFlows();
            const configFlowsData = configFlows.map(name => ({ name, targetVersion: null }));
            flowsData = flowsData.concat(configFlowsData);
            console.log(chalk.blue(`⚙️  Loaded ${configFlows.length} flows from configuration`));
        }

        // From command line arguments
        if (options.flows && options.flows.length > 0) {
            const cmdFlowsData = options.flows.map(name => {
                const parts = name.split(':');
                if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
                    return { name: parts[0], targetVersion: parseInt(parts[1]) };
                }
                return { name, targetVersion: null };
            });
            flowsData = flowsData.concat(cmdFlowsData);
            console.log(chalk.blue(`💻 Added ${options.flows.length} flows from command line`));
            if (cmdFlowsData.some(f => f.targetVersion !== null)) {
                hasTargetVersions = true;
                const withVersions = cmdFlowsData.filter(f => f.targetVersion !== null).length;
                console.log(chalk.blue(`📌 ${withVersions} flows from command line have target versions specified`));
            }
        }

        // If no specific flows provided, get all flows
        if (flowsData.length === 0 && options.all) {
            console.log(chalk.blue('📊 Fetching all flows...'));
        } else if (flowsData.length === 0) {
            console.error(chalk.red('❌ No flows specified. Use --file, --use-config, --all, or provide flow names'));
            process.exit(1);
        }

        // Remove duplicates by flow name
        const uniqueFlowsMap = new Map();
        flowsData.forEach(flowData => {
            if (!uniqueFlowsMap.has(flowData.name)) {
                uniqueFlowsMap.set(flowData.name, flowData);
            } else {
                // If duplicate, prefer the one with a target version specified
                const existing = uniqueFlowsMap.get(flowData.name);
                if (flowData.targetVersion !== null && existing.targetVersion === null) {
                    uniqueFlowsMap.set(flowData.name, flowData);
                }
            }
        });

        flowsData = Array.from(uniqueFlowsMap.values());

        if (flowsData.length > 0) {
            console.log(chalk.blue(`📊 Total unique flows to query: ${flowsData.length}`));
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
                    targetVersion: null,
                    isActive: activeVersion > 0,
                    hasNewerVersion: latestVersion > activeVersion,
                    needsUpdate: false, // No target version, so no specific update needed
                    label: flowDef.MasterLabel,
                    description: flowDef.Description
                });
            }
        } else {
            console.log(chalk.blue('🔍 Retrieving flow versions...'));
            const flowNames = flowsData.map(f => f.name);
            const result = await flowClient.getMultipleFlowStatuses(flowNames);

            if (!result.success) {
                console.error(chalk.red(`❌ Failed to get flow statuses: ${result.message}`));
                process.exit(1);
            }

            flowStatuses = result.statuses.map(status => {
                // Find the target version from flowsData
                const flowData = flowsData.find(f => f.name === status.name);
                const targetVersion = flowData ? flowData.targetVersion : null;

                return {
                    name: status.name,
                    activeVersion: status.activeVersion,
                    latestVersion: status.latestVersion,
                    targetVersion: targetVersion,
                    isActive: status.isActive,
                    hasNewerVersion: status.hasNewerVersion,
                    needsUpdate: targetVersion !== null && status.activeVersion !== targetVersion,
                    label: status.masterLabel,
                    description: status.description,
                    error: status.error
                };
            });
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
            displayResults(flowStatuses, options, hasTargetVersions);
        }

        // Export to file if requested
        if (options.output) {
            await exportResults(flowStatuses, options.output, options.format || 'json', logger);
        }

        // Summary
        const activeCount = flowStatuses.filter(f => f.isActive).length;
        const inactiveCount = flowStatuses.filter(f => !f.isActive).length;
        const updatesCount = flowStatuses.filter(f => f.hasNewerVersion).length;
        const needsUpdateCount = flowStatuses.filter(f => f.needsUpdate).length;

        console.log(chalk.blue('\n📊 Summary:'));
        console.log(`   Total flows: ${flowStatuses.length}`);
        console.log(`   Active: ${chalk.green(activeCount)}`);
        console.log(`   Inactive: ${chalk.red(inactiveCount)}`);
        console.log(`   Updates available: ${chalk.yellow(updatesCount)}`);
        if (hasTargetVersions && needsUpdateCount > 0) {
            console.log(`   Needs update to target version: ${chalk.yellow(needsUpdateCount)}`);
        }

    } catch (error) {
        logger.error(`Get active versions command failed: ${error.message}`);
        console.error(chalk.red(`❌ Command failed: ${error.message}`));
        process.exit(1);
    }
}

function displayResults(flowStatuses, options, hasTargetVersions) {
    console.log(chalk.blue('\n📋 Flow Versions:\n'));

    if (options.format === 'table' || !options.format) {
        // Table format
        const maxNameLength = Math.max(...flowStatuses.map(f => f.name.length), 20);

        let header, separator;
        if (hasTargetVersions) {
            header = `${'Name'.padEnd(maxNameLength)} | Active | Target | Latest | Status`;
            separator = '-'.repeat(header.length);
        } else {
            header = `${'Name'.padEnd(maxNameLength)} | Active | Latest | Status`;
            separator = '-'.repeat(header.length);
        }

        console.log(chalk.bold(header));
        console.log(separator);

        flowStatuses.forEach(flow => {
            if (flow.error) {
                console.log(`${flow.name.padEnd(maxNameLength)} | ${chalk.red('ERROR: ' + flow.error)}`);
            } else {
                const statusIcon = flow.isActive ? chalk.green('✓') : chalk.red('✗');
                const activeVer = flow.activeVersion.toString().padStart(6);
                const latestVer = flow.latestVersion.toString().padStart(6);

                if (hasTargetVersions) {
                    const targetVer = flow.targetVersion !== null ? flow.targetVersion.toString().padStart(6) : '    -';
                    let updateIcon = ' ';

                    if (flow.needsUpdate) {
                        updateIcon = chalk.yellow('⚠'); // Needs update to target version
                    } else if (flow.hasNewerVersion && flow.targetVersion === null) {
                        updateIcon = chalk.cyan('ℹ'); // Has newer version available
                    }

                    console.log(`${flow.name.padEnd(maxNameLength)} | ${activeVer} | ${targetVer} | ${latestVer} | ${statusIcon} ${updateIcon}`);
                } else {
                    const updateIcon = flow.hasNewerVersion ? chalk.yellow('⚠') : ' ';
                    console.log(`${flow.name.padEnd(maxNameLength)} | ${activeVer} | ${latestVer} | ${statusIcon} ${updateIcon}`);
                }
            }
        });

        // Legend
        if (hasTargetVersions) {
            console.log('\n' + chalk.dim('Legend: ✓=Active ✗=Inactive ⚠=Needs update to target ℹ=Newer version available'));
        } else {
            console.log('\n' + chalk.dim('Legend: ✓=Active ✗=Inactive ⚠=Update available'));
        }
    } else if (options.format === 'simple') {
        // Simple format - just name and version
        flowStatuses.forEach(flow => {
            if (!flow.error) {
                if (hasTargetVersions && flow.targetVersion !== null) {
                    console.log(`${flow.name}: v${flow.activeVersion} (target: v${flow.targetVersion})`);
                } else {
                    console.log(`${flow.name}: v${flow.activeVersion}`);
                }
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
                if (flow.targetVersion !== null) {
                    console.log(`   Target Version: ${flow.targetVersion}`);
                    if (flow.needsUpdate) {
                        console.log(chalk.yellow(`   ⚠ Needs update from v${flow.activeVersion} to v${flow.targetVersion}!`));
                    } else if (flow.activeVersion === flow.targetVersion) {
                        console.log(chalk.green(`   ✓ Already at target version`));
                    }
                }
                console.log(`   Latest Version: ${flow.latestVersion}`);
                if (flow.hasNewerVersion && flow.targetVersion === null) {
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
            // CSV format - include target version if any flows have it
            const hasTargetVersions = flowStatuses.some(f => f.targetVersion !== null);
            let headers;
            if (hasTargetVersions) {
                headers = 'Name,Active Version,Target Version,Latest Version,Is Active,Has Updates,Needs Update,Label,Description\n';
            } else {
                headers = 'Name,Active Version,Latest Version,Is Active,Has Updates,Label,Description\n';
            }

            const rows = flowStatuses.map(flow => {
                const name = `"${flow.name}"`;
                const label = `"${flow.label || ''}"`;
                const description = `"${(flow.description || '').replace(/"/g, '""')}"`;

                if (hasTargetVersions) {
                    const targetVer = flow.targetVersion !== null ? flow.targetVersion : '';
                    const needsUpdate = flow.needsUpdate || false;
                    return `${name},${flow.activeVersion},${targetVer},${flow.latestVersion},${flow.isActive},${flow.hasNewerVersion},${needsUpdate},${label},${description}`;
                } else {
                    return `${name},${flow.activeVersion},${flow.latestVersion},${flow.isActive},${flow.hasNewerVersion},${label},${description}`;
                }
            }).join('\n');
            content = headers + rows;
        } else if (format === 'txt') {
            // Plain text format
            content = flowStatuses.map(flow => {
                if (flow.error) {
                    return `${flow.name}: ERROR - ${flow.error}`;
                }
                let line = `${flow.name}: Active v${flow.activeVersion}`;
                if (flow.targetVersion !== null) {
                    line += `, Target v${flow.targetVersion}`;
                }
                line += `, Latest v${flow.latestVersion}`;
                if (flow.needsUpdate) {
                    line += ' (Needs update to target)';
                } else if (flow.hasNewerVersion) {
                    line += ' (Update available)';
                }
                return line;
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

        let flowData = [];

        if (extension === '.json') {
            const data = JSON.parse(content);

            // Support various JSON formats
            if (Array.isArray(data)) {
                flowData = data;
            } else if (data.flows && Array.isArray(data.flows)) {
                flowData = data.flows;
            } else if (data.flows && typeof data.flows === 'object') {
                // Flatten nested flow objects
                flowData = Object.values(data.flows).flat();
            } else {
                throw new Error('Invalid JSON format. Expected array of flow names or object with flows property');
            }
        } else if (extension === '.txt' || extension === '.csv') {
            // Plain text file with one flow per line
            flowData = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#')); // Filter empty lines and comments
        } else {
            throw new Error(`Unsupported file format: ${extension}. Supported formats: .json, .txt, .csv`);
        }

        // Parse flow data - support both "FlowName" and "FlowName:Version" formats
        const flows = [];
        flowData.forEach(item => {
            if (typeof item === 'string') {
                if (item.length === 0) {
                    return;
                }

                // Check if version is specified (format: FlowName:Version)
                if (item.includes(':')) {
                    const parts = item.split(':');
                    const flowName = parts[0].trim();
                    const version = parts[1].trim();

                    if (flowName && version) {
                        const versionNum = parseInt(version, 10);
                        if (isNaN(versionNum) || versionNum < 0) {
                            console.warn(chalk.yellow(`⚠️  Invalid version for flow '${flowName}': ${version}`));
                            return;
                        }
                        flows.push({ name: flowName, targetVersion: versionNum });
                    } else {
                        console.warn(chalk.yellow(`⚠️  Invalid format: ${item}`));
                    }
                } else {
                    // Just flow name, no version specified
                    flows.push({ name: item, targetVersion: null });
                }
            } else if (typeof item === 'object' && item.name) {
                // JSON object format: { "name": "FlowName", "version": 3 }
                flows.push({
                    name: item.name,
                    targetVersion: item.version !== undefined ? parseInt(item.version, 10) : null
                });
            } else {
                console.warn(chalk.yellow(`⚠️  Skipping invalid flow entry: ${JSON.stringify(item)}`));
            }
        });

        return flows;

    } catch (error) {
        throw new Error(`Failed to load flows from file ${filePath}: ${error.message}`);
    }
}

module.exports = getActiveVersionsCommand;
