#!/usr/bin/env node

/**
 * One-time OAuth setup script for JWT authentication
 * This script helps you authorize the Connected App for your user
 */

const readline = require('readline');
const chalk = require('chalk');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setupOAuth() {
    console.log(chalk.blue.bold('🔐 Salesforce Connected App OAuth Setup'));
    console.log(chalk.yellow('This script will help you authorize your Connected App for JWT authentication.\n'));

    try {
        const clientId = process.env.SF_CLIENT_ID || await question('Enter your Connected App Client ID: ');
        const sandbox = process.env.SF_SANDBOX === 'true' || 
                       (await question('Is this a sandbox org? (y/n): ')).toLowerCase().startsWith('y');

        const baseUrl = sandbox ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
        
        const oauthUrl = `${baseUrl}/services/oauth2/authorize?` +
            `client_id=${encodeURIComponent(clientId)}&` +
            `redirect_uri=${encodeURIComponent('https://login.salesforce.com/services/oauth2/success')}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent('api refresh_token offline_access')}`;

        console.log(chalk.green('\n📋 Steps to authorize your Connected App:'));
        console.log('1. Open the following URL in your browser:');
        console.log(chalk.cyan(oauthUrl));
        console.log('\n2. Log in with your Salesforce credentials');
        console.log('3. Click "Allow" to authorize the Connected App');
        console.log('4. You should see a success page');
        console.log('\n5. After authorization, your JWT authentication should work');

        const openBrowser = await question('\nWould you like to open this URL automatically? (y/n): ');
        
        if (openBrowser.toLowerCase().startsWith('y')) {
            const { exec } = require('child_process');
            const command = process.platform === 'darwin' ? 'open' : 
                          process.platform === 'win32' ? 'start' : 'xdg-open';
            
            exec(`${command} "${oauthUrl}"`, (error) => {
                if (error) {
                    console.log(chalk.yellow('⚠️  Could not open browser automatically. Please copy the URL above.'));
                } else {
                    console.log(chalk.green('✅ Browser opened successfully'));
                }
            });
        }

        await question('\nPress Enter after you have completed the authorization...');

        console.log(chalk.green('\n✅ Setup complete! You can now test your connection:'));
        console.log(chalk.cyan('sf-flow list --quiet'));

    } catch (error) {
        console.error(chalk.red(`❌ Setup failed: ${error.message}`));
    } finally {
        rl.close();
    }
}

if (require.main === module) {
    setupOAuth();
}

module.exports = setupOAuth;