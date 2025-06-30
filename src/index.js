#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ConfigManager = require('./utils/config');
const activateCommand = require('./commands/activate');
const deactivateCommand = require('./commands/deactivate');
const listCommand = require('./commands/list');
const batchCommand = require('./commands/batch');
const generateUrlsCommand = require('./commands/generate-urls');

const program = new Command();

// Global configuration
let config;

program
    .name('sf-flow')
    .description('CLI tool for bulk management of Salesforce Flows')
    .version('1.0.0')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('--sandbox', 'Use sandbox environment')
    .option('--production', 'Use production environment')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .hook('preAction', (thisCommand, actionCommand) => {
        try {
            // Initialize configuration
            config = new ConfigManager();
            
            // Load additional config if specified
            if (thisCommand.opts().config) {
                config.loadFlowsFromFile(thisCommand.opts().config);
            }
            
            // Override environment settings
            if (thisCommand.opts().sandbox) {
                config.set('auth.sandbox', true);
            }
            if (thisCommand.opts().production) {
                config.set('auth.sandbox', false);
            }
            
            // Set logging level based on verbosity
            if (thisCommand.opts().verbose) {
                config.set('logging.level', 'debug');
                config.set('cli.showDetailedOutput', true);
            }
            if (thisCommand.opts().quiet) {
                config.set('logging.level', 'warn');
                config.set('cli.showProgressBar', false);
                config.set('cli.showDetailedOutput', false);
            }
            
            // Display environment info
            const env = config.get('auth.sandbox') ? 'SANDBOX' : 'PRODUCTION';
            const envColor = config.get('auth.sandbox') ? chalk.yellow : chalk.red;
            
            if (!thisCommand.opts().quiet) {
                console.log(chalk.blue('🚀 Salesforce Flow CLI'));
                console.log(`${chalk.bold('Environment:')} ${envColor(env)}`);
                console.log(`${chalk.bold('Auth Method:')} ${config.get('auth.method').toUpperCase()}`);
                console.log('');
            }
            
        } catch (error) {
            console.error(chalk.red(`❌ Configuration error: ${error.message}`));
            process.exit(1);
        }
    });

// Activate command
program
    .command('activate <flows...>')
    .description('Activate one or more flows')
    .option('--validate', 'Validate that flows exist before activation')
    .option('--ignore-not-found', 'Continue if some flows are not found')
    .action(async (flows, options) => {
        await activateCommand(flows, { ...program.opts(), ...options }, config);
    });

// Deactivate command
program
    .command('deactivate <flows...>')
    .description('Deactivate one or more flows')
    .option('--validate', 'Validate that flows exist before deactivation')
    .option('--ignore-not-found', 'Continue if some flows are not found')
    .option('-f, --force', 'Force deactivation in production environment')
    .action(async (flows, options) => {
        await deactivateCommand(flows, { ...program.opts(), ...options }, config);
    });

// List command
program
    .command('list [flows...]')
    .description('List flows and their status')
    .option('-t, --type <type>', 'Filter by flow type (screen, record, scheduled)')
    .option('-s, --status <status>', 'Filter by status (active, inactive)')
    .option('--sort-by <field>', 'Sort by field (name, type, status)', 'name')
    .option('--format <format>', 'Output format (table, json, csv)', 'table')
    .action(async (flows, options) => {
        await listCommand({ ...program.opts(), ...options, flows }, config);
    });

// Batch activate command
program
    .command('batch-activate')
    .description('Activate multiple flows from file or configuration')
    .option('-f, --file <path>', 'Load flows from file (JSON, TXT, or CSV)')
    .option('--use-config', 'Use flows from configuration file')
    .option('--flows <flows...>', 'Additional flows to activate')
    .option('--validate', 'Validate that flows exist before activation')
    .option('--ignore-not-found', 'Continue if some flows are not found')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--show-status', 'Show current status during dry run')
    .option('--report <path>', 'Generate detailed report file')
    .option('--continue-on-error', 'Exit with success even if some flows fail')
    .option('--show-errors', 'Show detailed error messages in verbose mode')
    .action(async (options) => {
        await batchCommand('activate', { ...program.opts(), ...options }, config);
    });

// Batch deactivate command
program
    .command('batch-deactivate')
    .description('Deactivate multiple flows from file or configuration')
    .option('-f, --file <path>', 'Load flows from file (JSON, TXT, or CSV)')
    .option('--use-config', 'Use flows from configuration file')
    .option('--flows <flows...>', 'Additional flows to deactivate')
    .option('--validate', 'Validate that flows exist before deactivation')
    .option('--ignore-not-found', 'Continue if some flows are not found')
    .option('--force', 'Force deactivation in production environment')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--show-status', 'Show current status during dry run')
    .option('--report <path>', 'Generate detailed report file')
    .option('--continue-on-error', 'Exit with success even if some flows fail')
    .option('--show-errors', 'Show detailed error messages in verbose mode')
    .action(async (options) => {
        await batchCommand('deactivate', { ...program.opts(), ...options }, config);
    });

// Generate URLs command
program
    .command('generate-urls <flows...>')
    .description('Generate Salesforce URLs for manual flow activation')
    .option('-o, --output <path>', 'Save report to JSON file')
    .action(async (flows, options) => {
        await generateUrlsCommand(flows, { ...program.opts(), ...options }, config);
    });

// Config command
program
    .command('config')
    .description('Manage configuration')
    .action(() => {
        console.log(chalk.blue('📋 Current Configuration:'));
        console.log(JSON.stringify(config.getConfig(), null, 2));
    });

// Parse command line arguments
program.parse();

// If no command was provided, show help
if (process.argv.length === 2) {
    program.help();
}