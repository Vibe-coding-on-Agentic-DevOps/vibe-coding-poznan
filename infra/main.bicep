// Main Bicep file for vibe-coding-poz-wro deployment
// This file provisions App Service, Static Web App, Application Insights, Log Analytics, and Key Vault

param environmentName string
param location string
param resourceGroupName string

var backendAppName = '${environmentName}-backend'
var frontendAppName = '${environmentName}-frontend'
var appInsightsName = '${environmentName}-ai'
var logAnalyticsName = '${environmentName}-logs'
var keyVaultName = '${environmentName}-kv'

resource backendApp 'Microsoft.Web/sites@2022-09-01' = {
  name: backendAppName
  location: location
  kind: 'app'
  properties: {
    httpsOnly: true
    siteConfig: {
      appSettings: [
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
      ]
    }
  }
  tags: {
    azd-service-name: 'backend'
    azd-env-name: environmentName
  }
}

resource frontendApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: frontendAppName
  location: location
  properties: {
    repositoryToken: '' // Set by azd pipeline
  }
  tags: {
    azd-service-name: 'frontend'
    azd-env-name: environmentName
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2021-06-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: []
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: true
  }
}

resource backendSiteExtension 'Microsoft.Web/sites/siteextensions@2022-09-01' = {
  name: '${backendAppName}/Microsoft.Web/sites/siteextensions'
  location: location
  properties: {}
}

output backendAppName string = backendApp.name
output frontendAppName string = frontendApp.name
output appInsightsName string = appInsights.name
output logAnalyticsName string = logAnalytics.name
output keyVaultName string = keyVault.name
