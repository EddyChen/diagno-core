// Default configuration
const defaultConfig = {
  services: {
    ocr: 'http://localhost:11434/v1',
    analysis: 'http://localhost:11434/v1',
    report: 'http://localhost/issue/report'
  },
  ollama: {
    ocrModel: 'minicpm-v:8b',
    analysisModel: 'deepseek-r1:7b'
  }
};

// DOM Elements
const elements = {
  ocrEndpoint: document.getElementById('ocr-endpoint'),
  analysisEndpoint: document.getElementById('analysis-endpoint'),
  reportEndpoint: document.getElementById('report-endpoint'),
  ocrModel: document.getElementById('ocr-model'),
  analysisModel: document.getElementById('analysis-model'),
  saveButton: document.getElementById('save'),
  resetButton: document.getElementById('reset'),
  status: document.getElementById('status')
};

// Load saved configuration
function loadConfig() {
  chrome.storage.local.get(['config'], result => {
    const config = result.config || defaultConfig;
    
    // Populate form fields
    elements.ocrEndpoint.value = config.services.ocr;
    elements.analysisEndpoint.value = config.services.analysis;
    elements.reportEndpoint.value = config.services.report;
    elements.ocrModel.value = config.ollama.ocrModel;
    elements.analysisModel.value = config.ollama.analysisModel;
  });
}

// Save configuration
function saveConfig() {
  const config = {
    services: {
      ocr: elements.ocrEndpoint.value.trim(),
      analysis: elements.analysisEndpoint.value.trim(),
      report: elements.reportEndpoint.value.trim()
    },
    ollama: {
      ocrModel: elements.ocrModel.value.trim(),
      analysisModel: elements.analysisModel.value.trim()
    }
  };

  // Validate URLs
  try {
    Object.values(config.services).forEach(url => {
      new URL(url);
    });

    // Save to storage
    chrome.storage.local.set({ config }, () => {
      showStatus('Settings saved successfully!', 'success');
    });
  } catch (error) {
    showStatus('Please enter valid URLs for all services', 'error');
  }
}

// Reset configuration to defaults
function resetConfig() {
  // Update form fields
  elements.ocrEndpoint.value = defaultConfig.services.ocr;
  elements.analysisEndpoint.value = defaultConfig.services.analysis;
  elements.reportEndpoint.value = defaultConfig.services.report;
  elements.ocrModel.value = defaultConfig.ollama.ocrModel;
  elements.analysisModel.value = defaultConfig.ollama.analysisModel;

  // Save to storage
  chrome.storage.local.set({ config: defaultConfig }, () => {
    showStatus('Settings reset to defaults', 'success');
  });
}

// Show status message
function showStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  
  // Hide status after 3 seconds
  setTimeout(() => {
    elements.status.className = 'status';
  }, 3000);
}

// Validate input URLs
function validateUrl(input) {
  try {
    new URL(input.value);
    input.setCustomValidity('');
  } catch (error) {
    input.setCustomValidity('Please enter a valid URL');
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadConfig);

elements.saveButton.addEventListener('click', saveConfig);
elements.resetButton.addEventListener('click', () => {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    resetConfig();
  }
});

// Add URL validation to endpoint inputs
[elements.ocrEndpoint, elements.analysisEndpoint, elements.reportEndpoint].forEach(input => {
  input.addEventListener('input', () => validateUrl(input));
}); 