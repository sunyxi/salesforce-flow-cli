const ToolingAPI = require('./tooling-api');

class FlowClient {
    constructor(authManager) {
        this.authManager = authManager;
        this.toolingAPI = new ToolingAPI(authManager);
    }

    async getFlowDefinition(flowApiName) {
        const query = `
            SELECT Id, DeveloperName, Description, MasterLabel, ActiveVersion.VersionNumber, LatestVersion.VersionNumber
            FROM FlowDefinition 
            WHERE DeveloperName = '${flowApiName}'
        `;
        
        const result = await this.toolingAPI.query(query);
        
        if (result.records.length === 0) {
            throw new Error(`Flow '${flowApiName}' not found`);
        }
        
        return result.records[0];
    }

    async getFlowDefinitions(flowApiNames) {
        if (!Array.isArray(flowApiNames) || flowApiNames.length === 0) {
            return [];
        }

        // Escape single quotes and build IN clause
        const escapedNames = flowApiNames.map(name => `'${name.replace(/'/g, "\\'")}'`);
        const query = `
            SELECT Id, DeveloperName, Description, MasterLabel, ActiveVersion.VersionNumber, LatestVersion.VersionNumber
            FROM FlowDefinition 
            WHERE DeveloperName IN (${escapedNames.join(',')})
        `;
        
        const records = await this.toolingAPI.getAllRecords(query);
        return records;
    }

    async getAllFlowDefinitions() {
        const query = `
            SELECT Id, DeveloperName, Description, MasterLabel, ActiveVersion.VersionNumber, LatestVersion.VersionNumber
            FROM FlowDefinition 
            ORDER BY DeveloperName
        `;
        
        return await this.toolingAPI.getAllRecords(query);
    }

    async getFlowVersionInfo(flowApiName) {
        try {
            // Get the latest version number from Flow object
            const query = `
                SELECT DefinitionId, VersionNumber
                FROM Flow 
                WHERE Definition.DeveloperName = '${flowApiName}'
                ORDER BY VersionNumber DESC 
                LIMIT 1
            `;
            
            const result = await this.toolingAPI.query(query);
            
            if (result.records.length === 0) {
                return { definitionId: null, latestVersion: 0 };
            }
            
            const latestFlow = result.records[0];
            return { 
                definitionId: latestFlow.DefinitionId, 
                latestVersion: latestFlow.VersionNumber 
            };
        } catch (error) {
            console.error('Error getting flow version info:', error.message);
            return { definitionId: null, latestVersion: 0 };
        }
    }


    async identifyFlowType(flowDefinition) {
        try {
            // Query Flow object to get detailed type information
            const query = `
                SELECT ProcessType, RunInMode
                FROM Flow 
                WHERE DefinitionId = '${flowDefinition.Id}'
                ORDER BY VersionNumber DESC
                LIMIT 1
            `;
            
            const result = await this.toolingAPI.query(query);
            
            if (result.records.length > 0) {
                const flowRecord = result.records[0];
                const processType = flowRecord.ProcessType;
                const runInMode = flowRecord.RunInMode;
                
                // Determine flow type based on name patterns and process type
                const flowType = this.getFlowTypeFromName(flowDefinition.DeveloperName, processType);
                
                // Determine if this is a system context flow
                const isSystemContext = runInMode === 'SystemModeWithoutSharing' || 
                                       flowType.includes('Record-Triggered') ||
                                       flowType.includes('Process Builder');
                
                return {
                    type: flowType,
                    isSystemContext: isSystemContext,
                    canActivateViaAPI: !isSystemContext
                };
            }
        } catch (error) {
            console.debug('Could not get detailed flow type info:', error.message);
        }
        
        // Fallback: determine type from name patterns
        const flowType = this.getFlowTypeFromName(flowDefinition.DeveloperName);
        const isSystemContext = flowType.includes('Record-Triggered') || flowType.includes('Process Builder');
        
        return {
            type: flowType,
            isSystemContext: isSystemContext,
            canActivateViaAPI: !isSystemContext
        };
    }

    getFlowTypeFromName(flowName, processType = null) {
        // Analyze flow name patterns to determine type
        const name = flowName.toLowerCase();
        
        // Check for common naming patterns
        if (name.includes('trg_') || name.includes('trigger') || name.includes('record_trigger')) {
            return 'Record-Triggered Flow';
        }
        
        if (name.includes('sch_') || name.includes('schedule') || name.includes('scheduled')) {
            return 'Scheduled Flow';
        }
        
        if (name.includes('screen_') || name.includes('scr_')) {
            return 'Screen Flow';
        }
        
        if (name.includes('autolaunched') || name.includes('auto_')) {
            return 'Autolaunched Flow';
        }
        
        // Check process type if available
        if (processType === 'Workflow') {
            return 'Process Builder';
        }
        
        if (processType === 'Flow') {
            return 'Flow';
        }
        
        // Default fallback
        return 'Flow';
    }

    async activateFlow(flowApiName) {
        try {
            // Get flow definition with version info
            const flowDef = await this.getFlowDefinition(flowApiName);
            const versionInfo = await this.getFlowVersionInfo(flowApiName);
            
            const currentActiveVersion = flowDef.ActiveVersion?.VersionNumber || 0;
            const { latestVersion, definitionId } = versionInfo;
            
            if (currentActiveVersion === latestVersion && currentActiveVersion > 0) {
                return {
                    success: true,
                    message: `Flow '${flowApiName}' is already active (version ${currentActiveVersion})`,
                    wasAlreadyActive: true
                };
            }

            if (latestVersion === 0) {
                return {
                    success: false,
                    message: `Flow '${flowApiName}' has no versions available`,
                    error: 'No versions found'
                };
            }

            // Use the DefinitionId from the Flow query if available, otherwise use FlowDefinition Id
            const targetDefinitionId = definitionId || flowDef.Id;

            // Use Metadata API approach to activate flow with specific version number
            const updateData = {
                Metadata: {
                    activeVersionNumber: latestVersion
                }
            };

            await this.toolingAPI.updateRecord('FlowDefinition', targetDefinitionId, updateData);

            return {
                success: true,
                message: `Flow '${flowApiName}' activated successfully (version ${latestVersion})`,
                wasAlreadyActive: false,
                previousVersion: currentActiveVersion,
                newVersion: latestVersion
            };
        } catch (error) {
            // Check for system context flows that cannot be activated via API
            if (error.message.includes('システムコンテキストで実行されるため') || 
                error.message.includes('system context') ||
                error.message.includes('UNKNOWN_EXCEPTION')) {
                return {
                    success: false,
                    message: `Flow '${flowApiName}' cannot be activated via API (system context restriction). Please use Salesforce UI.`,
                    error: 'API_RESTRICTION',
                    isSystemContextRestriction: true
                };
            }
            
            return {
                success: false,
                message: `Failed to activate flow '${flowApiName}': ${error.message}`,
                error: error.message
            };
        }
    }

    async deactivateFlow(flowApiName) {
        try {
            // Get flow definition with version info
            const flowDef = await this.getFlowDefinition(flowApiName);
            const versionInfo = await this.getFlowVersionInfo(flowApiName);
            
            const currentActiveVersion = flowDef.ActiveVersion?.VersionNumber || 0;
            const { definitionId } = versionInfo;
            
            if (currentActiveVersion === 0) {
                return {
                    success: true,
                    message: `Flow '${flowApiName}' is already inactive`,
                    wasAlreadyInactive: true
                };
            }

            // Use the DefinitionId from the Flow query if available, otherwise use FlowDefinition Id
            const targetDefinitionId = definitionId || flowDef.Id;

            // Use Metadata API approach to deactivate flow (set version to 0)
            const updateData = {
                Metadata: {
                    activeVersionNumber: 0
                }
            };

            await this.toolingAPI.updateRecord('FlowDefinition', targetDefinitionId, updateData);

            return {
                success: true,
                message: `Flow '${flowApiName}' deactivated successfully`,
                wasAlreadyInactive: false,
                previousVersion: currentActiveVersion
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to deactivate flow '${flowApiName}': ${error.message}`,
                error: error.message
            };
        }
    }

    async getFlowStatus(flowApiName) {
        try {
            const flowDef = await this.getFlowDefinition(flowApiName);
            const flowType = await this.identifyFlowType(flowDef);
            const versionInfo = await this.getFlowVersionInfo(flowApiName);
            
            const currentActiveVersion = flowDef.ActiveVersion?.VersionNumber || 0;
            const { latestVersion } = versionInfo;
            
            return {
                success: true,
                flowDefinition: flowDef,
                flowType: flowType,
                isActive: currentActiveVersion > 0,
                activeVersion: currentActiveVersion,
                latestVersion: latestVersion,
                hasNewerVersion: latestVersion > currentActiveVersion
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to get flow status for '${flowApiName}': ${error.message}`,
                error: error.message
            };
        }
    }

    async getMultipleFlowStatuses(flowApiNames) {
        try {
            const flowDefs = await this.getFlowDefinitions(flowApiNames);
            const statuses = [];
            
            for (const flowDef of flowDefs) {
                const flowType = await this.identifyFlowType(flowDef);
                
                const currentActiveVersion = flowDef.ActiveVersion?.VersionNumber || 0;
                const latestVersionFromDef = flowDef.LatestVersion?.VersionNumber || 0;
                
                statuses.push({
                    name: flowDef.DeveloperName,
                    flowType: flowType,
                    isActive: currentActiveVersion > 0,
                    activeVersion: currentActiveVersion,
                    latestVersion: latestVersionFromDef,
                    hasNewerVersion: latestVersionFromDef > currentActiveVersion,
                    description: flowDef.Description,
                    masterLabel: flowDef.MasterLabel
                });
            }
            
            // Add not found flows
            const foundNames = flowDefs.map(f => f.DeveloperName);
            const notFoundNames = flowApiNames.filter(name => !foundNames.includes(name));
            
            for (const name of notFoundNames) {
                statuses.push({
                    name: name,
                    flowType: 'NotFound',
                    isActive: false,
                    activeVersion: 0,
                    latestVersion: 0,
                    hasNewerVersion: false,
                    error: 'Flow not found'
                });
            }
            
            return {
                success: true,
                statuses: statuses
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to get flow statuses: ${error.message}`,
                error: error.message
            };
        }
    }

    async validateFlowExists(flowApiName) {
        try {
            await this.getFlowDefinition(flowApiName);
            return true;
        } catch (error) {
            return false;
        }
    }

    async validateFlowsExist(flowApiNames) {
        const validationResults = {};
        
        for (const flowName of flowApiNames) {
            validationResults[flowName] = await this.validateFlowExists(flowName);
        }
        
        return validationResults;
    }
}

module.exports = FlowClient;