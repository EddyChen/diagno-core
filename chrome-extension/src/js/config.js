// Default configuration
export const DEFAULT_CONFIG = {
  services: {
    ollama: {
      baseUrl: 'http://he808v7amke.sn.mynetname.net:28919',
      endpoints: {
        ocr: '/api/generate',
        analysis: '/api/generate'
      }
    },
    report: {
      baseUrl: 'http://localhost',
      endpoint: '/issue/report'
    }
  },
  ollama: {
    models: {
      ocr: 'minicpm-v:8b',
      analysis: 'deepseek-r1:32b'
    },
    options: {
      temperature: 0.7,
      top_p: 0.9,
      stream: false,
      timeout: 60000 // 60 seconds timeout
    }
  },
  storage: {
    maxIssues: 50,
    maxLogs: 1000
  },
  ui: {
    refreshInterval: 30000, // 30 seconds
    screenshotQuality: 0.8,
    maxScreenshotSize: 2048 // pixels
  }
};

// Configuration manager
class ConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  async load() {
    try {
      const { config } = await chrome.storage.local.get(['config']);
      if (config) {
        this.config = this.mergeConfig(DEFAULT_CONFIG, config);
      }
      return this.config;
    } catch (error) {
      console.error('Error loading config:', error);
      return this.config;
    }
  }

  async save(newConfig) {
    try {
      this.config = this.mergeConfig(this.config, newConfig);
      await chrome.storage.local.set({ config: this.config });
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }

  get(path) {
    return this.getNestedValue(this.config, path);
  }

  // Helper method to merge configurations
  mergeConfig(base, override) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        merged[key] = this.mergeConfig(base[key] || {}, value);
      } else if (value !== undefined) {
        merged[key] = value;
      }
    }
    return merged;
  }

  // Helper method to get nested values using dot notation
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
      current && current[key] !== undefined ? current[key] : undefined, obj);
  }

  // Get full service URL
  getServiceUrl(endpoint) {
    if (endpoint === 'report') {
      return `${this.config.services.report.baseUrl}${this.config.services.report.endpoint}`;
    }
    const baseUrl = this.config.services.ollama.baseUrl;
    const path = this.config.services.ollama.endpoints[endpoint];
    return `${baseUrl}${path}`;
  }

  // Validate configuration
  validate(config = this.config) {
    const errors = [];

    // Validate Ollama services
    if (!config.services?.ollama?.baseUrl) {
      errors.push('Ollama base URL is required');
    }

    // Validate Ollama endpoints
    const requiredOllamaEndpoints = ['ocr', 'analysis'];
    for (const endpoint of requiredOllamaEndpoints) {
      if (!config.services?.ollama?.endpoints?.[endpoint]) {
        errors.push(`Endpoint for ${endpoint} is required`);
      }
    }

    // Validate report service
    if (!config.services?.report?.baseUrl) {
      errors.push('Report service base URL is required');
    }
    if (!config.services?.report?.endpoint) {
      errors.push('Report service endpoint is required');
    }

    // Validate Ollama models
    const requiredModels = ['ocr', 'analysis'];
    for (const model of requiredModels) {
      if (!config.ollama?.models?.[model]) {
        errors.push(`Ollama model for ${model} is required`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const configManager = new ConfigManager(); 