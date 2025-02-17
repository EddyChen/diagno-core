import { configManager, DEFAULT_CONFIG } from './config.js';

// DOM Elements
const elements = {
  form: document.getElementById('config-form'),
  baseUrl: document.getElementById('base-url'),
  ocrEndpoint: document.getElementById('ocr-endpoint'),
  analysisEndpoint: document.getElementById('analysis-endpoint'),
  reportEndpoint: document.getElementById('report-endpoint'),
  ocrModel: document.getElementById('ocr-model'),
  analysisModel: document.getElementById('analysis-model'),
  temperature: document.getElementById('temperature'),
  topP: document.getElementById('top-p'),
  maxIssues: document.getElementById('max-issues'),
  maxLogs: document.getElementById('max-logs'),
  refreshInterval: document.getElementById('refresh-interval'),
  screenshotQuality: document.getElementById('screenshot-quality'),
  maxScreenshotSize: document.getElementById('max-screenshot-size'),
  saveButton: document.getElementById('save'),
  resetButton: document.getElementById('reset'),
  testButton: document.getElementById('test-connection'),
  status: document.getElementById('status')
};

// Load saved configuration
async function loadConfig() {
  const config = await configManager.load();
  
  // Populate form fields
  elements.baseUrl.value = config.services.baseUrl;
  elements.ocrEndpoint.value = config.services.endpoints.ocr;
  elements.analysisEndpoint.value = config.services.endpoints.analysis;
  elements.reportEndpoint.value = config.services.endpoints.report;
  elements.ocrModel.value = config.ollama.models.ocr;
  elements.analysisModel.value = config.ollama.models.analysis;
  elements.temperature.value = config.ollama.options.temperature;
  elements.topP.value = config.ollama.options.top_p;
  elements.maxIssues.value = config.storage.maxIssues;
  elements.maxLogs.value = config.storage.maxLogs;
  elements.refreshInterval.value = config.ui.refreshInterval / 1000; // Convert to seconds
  elements.screenshotQuality.value = config.ui.screenshotQuality;
  elements.maxScreenshotSize.value = config.ui.maxScreenshotSize;
}

// Save configuration
async function saveConfig(e) {
  e.preventDefault();

  const newConfig = {
    services: {
      baseUrl: elements.baseUrl.value.trim(),
      endpoints: {
        ocr: elements.ocrEndpoint.value.trim(),
        analysis: elements.analysisEndpoint.value.trim(),
        report: elements.reportEndpoint.value.trim()
      }
    },
    ollama: {
      models: {
        ocr: elements.ocrModel.value.trim(),
        analysis: elements.analysisModel.value.trim()
      },
      options: {
        temperature: parseFloat(elements.temperature.value),
        top_p: parseFloat(elements.topP.value),
        stream: false
      }
    },
    storage: {
      maxIssues: parseInt(elements.maxIssues.value),
      maxLogs: parseInt(elements.maxLogs.value)
    },
    ui: {
      refreshInterval: parseInt(elements.refreshInterval.value) * 1000, // Convert to milliseconds
      screenshotQuality: parseFloat(elements.screenshotQuality.value),
      maxScreenshotSize: parseInt(elements.maxScreenshotSize.value)
    }
  };

  // Validate configuration
  const validation = configManager.validate(newConfig);
  if (!validation.isValid) {
    showStatus(validation.errors.join('\n'), 'error');
    return;
  }

  // Save to storage
  const success = await configManager.save(newConfig);
  if (success) {
    showStatus('Settings saved successfully!', 'success');
  } else {
    showStatus('Failed to save settings. Please try again.', 'error');
  }
}

// Reset configuration to defaults
async function resetConfig() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    await configManager.save(DEFAULT_CONFIG);
    await loadConfig();
    showStatus('Settings reset to defaults', 'success');
  }
}

// Test connection to services
async function testConnection() {
  const config = await configManager.load();
  const results = [];
  
  // Test OCR service
  try {
    const response = await fetch(configManager.getServiceUrl('ocr'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.ollama.models.ocr,
        prompt: 'test',
        stream: false
      })
    });
    results.push(`OCR Service: ${response.ok ? '✅' : '❌'} (${response.status})`);
  } catch (error) {
    results.push(`OCR Service: ❌ (${error.message})`);
  }

  // Test Analysis service
  try {
    const response = await fetch(configManager.getServiceUrl('analysis'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.ollama.models.analysis,
        prompt: 'test',
        stream: false
      })
    });
    results.push(`Analysis Service: ${response.ok ? '✅' : '❌'} (${response.status})`);
  } catch (error) {
    results.push(`Analysis Service: ❌ (${error.message})`);
  }

  showStatus(results.join('\n'), results.every(r => r.includes('✅')) ? 'success' : 'warning');
}

// Show status message
function showStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  
  if (type !== 'error') {
    setTimeout(() => {
      elements.status.className = 'status';
    }, 3000);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadConfig);
elements.form.addEventListener('submit', saveConfig);
elements.resetButton.addEventListener('click', resetConfig);
elements.testButton.addEventListener('click', testConnection);

// Add input validation
elements.baseUrl.addEventListener('input', () => {
  try {
    new URL(elements.baseUrl.value);
    elements.baseUrl.setCustomValidity('');
  } catch (error) {
    elements.baseUrl.setCustomValidity('Please enter a valid URL');
  }
});

// Validate numeric inputs
[elements.temperature, elements.topP, elements.screenshotQuality].forEach(input => {
  input.addEventListener('input', () => {
    const value = parseFloat(input.value);
    if (value < 0 || value > 1) {
      input.setCustomValidity('Value must be between 0 and 1');
    } else {
      input.setCustomValidity('');
    }
  });
}); 