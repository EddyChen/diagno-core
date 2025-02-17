async function loadConfig() {
  const config = await configManager.loadConfig();
  
  // Ollama Service Configuration
  document.getElementById('ollama-base-url').value = config.services.ollama.baseUrl;
  document.getElementById('ocr-endpoint').value = config.services.ollama.endpoints.ocr;
  document.getElementById('analysis-endpoint').value = config.services.ollama.endpoints.analysis;
  
  // Report Service Configuration
  document.getElementById('report-base-url').value = config.services.report.baseUrl;
  document.getElementById('report-endpoint').value = config.services.report.endpoint;
  
  // Ollama Configuration
  document.getElementById('ocr-model').value = config.ollama.models.ocr;
  document.getElementById('analysis-model').value = config.ollama.models.analysis;
  document.getElementById('temperature').value = config.ollama.temperature;
  document.getElementById('top-p').value = config.ollama.topP;
  document.getElementById('timeout').value = config.ollama.timeout / 1000; // Convert to seconds
  
  // Storage Configuration
  document.getElementById('max-issues').value = config.storage.maxIssues;
  document.getElementById('max-logs').value = config.storage.maxLogs;
  
  // UI Configuration
  document.getElementById('refresh-interval').value = config.ui.refreshInterval;
  document.getElementById('screenshot-quality').value = config.ui.screenshotQuality;
  document.getElementById('max-screenshot-size').value = config.ui.maxScreenshotSize;
}

async function saveConfig() {
  try {
    const config = {
      services: {
        ollama: {
          baseUrl: document.getElementById('ollama-base-url').value.trim(),
          endpoints: {
            ocr: document.getElementById('ocr-endpoint').value.trim(),
            analysis: document.getElementById('analysis-endpoint').value.trim()
          }
        },
        report: {
          baseUrl: document.getElementById('report-base-url').value.trim(),
          endpoint: document.getElementById('report-endpoint').value.trim()
        }
      },
      ollama: {
        models: {
          ocr: document.getElementById('ocr-model').value.trim(),
          analysis: document.getElementById('analysis-model').value.trim()
        },
        temperature: parseFloat(document.getElementById('temperature').value),
        topP: parseFloat(document.getElementById('top-p').value),
        timeout: parseInt(document.getElementById('timeout').value) * 1000 // Convert to milliseconds
      },
      storage: {
        maxIssues: parseInt(document.getElementById('max-issues').value),
        maxLogs: parseInt(document.getElementById('max-logs').value)
      },
      ui: {
        refreshInterval: parseInt(document.getElementById('refresh-interval').value),
        screenshotQuality: parseFloat(document.getElementById('screenshot-quality').value),
        maxScreenshotSize: parseInt(document.getElementById('max-screenshot-size').value)
      }
    };

    // Validate URLs
    const urlFields = [
      { id: 'ollama-base-url', name: 'Ollama Base URL' },
      { id: 'report-base-url', name: 'Report Base URL' }
    ];
    
    for (const field of urlFields) {
      const url = document.getElementById(field.id).value.trim();
      try {
        new URL(url);
      } catch (e) {
        throw new Error(`Invalid ${field.name}: ${url}`);
      }
    }

    await configManager.saveConfig(config);
    showMessage('Settings saved successfully!', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showMessage(`Error saving settings: ${error.message}`, 'error');
  }
}

async function testConnection() {
  try {
    showMessage('Testing connections...', 'info');
    
    const config = await configManager.loadConfig();
    const ollamaUrl = new URL('/api/health', config.services.ollama.baseUrl);
    const reportUrl = new URL('/health', config.services.report.baseUrl);
    
    const timeout = config.ollama.timeout;
    
    const results = await Promise.all([
      fetch(ollamaUrl.toString(), { timeout }),
      fetch(reportUrl.toString(), { timeout })
    ]);
    
    const allOk = results.every(r => r.ok);
    if (allOk) {
      showMessage('All services are accessible!', 'success');
    } else {
      showMessage('Some services are not responding correctly', 'error');
    }
  } catch (error) {
    console.error('Connection test failed:', error);
    showMessage(`Connection test failed: ${error.message}`, 'error');
  }
} 