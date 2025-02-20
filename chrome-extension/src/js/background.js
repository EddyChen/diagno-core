// Configuration manager
const configManager = {
  config: null,
  
  async load() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['config'], result => {
        this.config = result.config || {
          services: {
            ocr: 'http://localhost:11434/api/generate',
            analysis: 'http://localhost:11434/api/generate',
            report: 'http://localhost:3000/api/issues'
          },
          ollama: {
            models: {
              ocr: 'minicpm-v:8b',
              analysis: 'deepseek-r1:7b'
            },
            options: {
              stream: false,
              temperature: 0.7,
              top_p: 0.9
            }
          }
        };
        resolve(this.config);
      });
    });
  },

  getServiceUrl(service) {
    return this.config?.services?.[service];
  },

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }
};

// Store collected information temporarily
let currentIssue = null;

// Logger utility
const Logger = {
  levels: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
  },

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    // Store log in chrome.storage
    chrome.storage.local.get(['logs'], result => {
      const logs = result.logs || [];
      logs.push(logEntry);
      // Keep only last 1000 logs
      if (logs.length > 1000) {
        logs.shift();
      }
      chrome.storage.local.set({ logs });
    });

    // Also log to console with appropriate styling
    const style = {
      DEBUG: 'color: #666',
      INFO: 'color: #0066cc',
      WARN: 'color: #ff9900',
      ERROR: 'color: #cc0000'
    }[level];

    console.log(`%c[${timestamp}] ${level}: ${message}`, style);
    if (data) {
      console.log(data);
    }
  },

  debug(message, data) { this.log(this.levels.DEBUG, message, data); },
  info(message, data) { this.log(this.levels.INFO, message, data); },
  warn(message, data) { this.log(this.levels.WARN, message, data); },
  error(message, data) { this.log(this.levels.ERROR, message, data); }
};

// Issue History Manager
const IssueManager = {
  addIssue(issue) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['issues'], result => {
        try {
          const issues = result.issues || [];
          
          const newIssue = {
            ...issue,
            id: 'ISSUE-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            timestamp: new Date().toISOString(),
            status: 'submitted'
          };
          
          issues.unshift(newIssue); // Add to beginning of array
          
          // Keep only last 50 issues
          if (issues.length > 50) {
            issues.pop();
          }
          
          chrome.storage.local.set({ issues }, () => {
            Logger.info('New issue added to history', newIssue);
            resolve(newIssue);
          });
        } catch (error) {
          Logger.error('Error adding issue to history', error);
          reject(error);
        }
      });
    });
  },

  getIssues() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['issues'], result => {
        try {
          resolve(result.issues || []);
        } catch (error) {
          Logger.error('Error getting issues from history', error);
          reject(error);
        }
      });
    });
  },

  updateIssueStatus(issueId, status) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['issues'], result => {
        try {
          const issues = result.issues || [];
          const index = issues.findIndex(issue => issue.id === issueId);
          
          if (index !== -1) {
            issues[index].status = status;
            issues[index].updatedAt = new Date().toISOString();
            chrome.storage.local.set({ issues }, () => {
              Logger.info(`Issue ${issueId} status updated to ${status}`);
              resolve();
            });
          } else {
            resolve();
          }
        } catch (error) {
          Logger.error('Error updating issue status', error);
          reject(error);
        }
      });
    });
  }
};

// Load configuration from storage
configManager.load().then(() => {
  Logger.info('Configuration loaded', configManager.config);
}).catch(error => {
  Logger.error('Error loading configuration', error);
});

// Process screenshot through OCR service
function processScreenshot(screenshot) {
  return new Promise((resolve, reject) => {
    Logger.info('Processing screenshot with OCR service');
    
    // Check if service endpoint is configured
    const ocrUrl = configManager.getServiceUrl('ocr');
    if (!ocrUrl) {
      reject(new Error('OCR service endpoint not configured. Please check extension settings.'));
      return;
    }

    Logger.debug('Sending request to OCR service', { endpoint: ocrUrl });

    fetch(ocrUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({
        model: configManager.get('ollama.models.ocr'),
        prompt: "Please analyze this screenshot and describe any visible issues or error messages. Extract all text that might be relevant to understanding the problem.",
        stream: configManager.get('ollama.options.stream'),
        options: {
          temperature: configManager.get('ollama.options.temperature'),
          top_p: configManager.get('ollama.options.top_p')
        },
        images: [screenshot.replace(/^data:image\/(png|jpg|jpeg);base64,/, '')]
      })
    })
    .then(response => {
      if (!response.ok) {
        let errorMessage = `OCR service returned ${response.status}`;
        
        // Add more context based on status code
        switch (response.status) {
          case 404:
            errorMessage = 'OCR service not found. Please ensure Ollama is running and the endpoint is correct in extension settings.';
            break;
          case 500:
            errorMessage = 'OCR service encountered an internal error. Please check Ollama logs.';
            break;
          case 503:
            errorMessage = 'OCR service is unavailable. Please ensure Ollama is running.';
            break;
        }

        Logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      return response.json();
    })
    .then(data => {
      if (!data.response) {
        throw new Error('Invalid response from OCR service: missing response field');
      }

      Logger.debug('OCR processing complete', { text: data.response.substring(0, 200) + '...' });
      resolve(data.response);
    })
    .catch(error => {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        reject(new Error('Could not connect to OCR service. Please ensure Ollama is running and accessible.'));
      } else {
        reject(error);
      }
    });
  });
}

// Get system information
function getSystemInfo() {
  return {
    platform: navigator.platform || 'unknown',
    userAgent: navigator.userAgent || 'unknown',
    language: navigator.language || 'unknown',
    screenResolution: window.screen 
      ? `${window.screen.width}x${window.screen.height}`
      : '1920x1080', // Default resolution for testing
    timestamp: new Date().toISOString()
  };
}

// Analyze issue and get suggestions
function analyzeIssue(issueData) {
  return new Promise((resolve, reject) => {
    Logger.info('Analyzing issue with Ollama service');
    
    const prompt = `You are a web application troubleshooting assistant. Please analyze the following information and provide specific suggestions to resolve the issue:

Page Info:
- URL: ${issueData.pageInfo.url}
- Title: ${issueData.pageInfo.title}

Extracted Text from Screenshot:
${issueData.ocrText}

System Info:
- Platform: ${issueData.systemInfo.platform}
- Browser: ${issueData.systemInfo.userAgent}

Please provide 3-5 specific suggestions to resolve the issue. Format each suggestion as a JSON object with 'text' and 'confidence' properties.`;

    const analysisUrl = configManager.getServiceUrl('analysis');
    if (!analysisUrl) {
      reject(new Error('Analysis service endpoint not configured. Please check extension settings.'));
      return;
    }

    fetch(analysisUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({
        model: configManager.get('ollama.models.analysis'),
        prompt: prompt,
        stream: configManager.get('ollama.options.stream'),
        options: {
          temperature: configManager.get('ollama.options.temperature'),
          top_p: configManager.get('ollama.options.top_p')
        }
      })
    })
    .then(response => {
      if (!response.ok) {
        let errorMessage = `Analysis service returned ${response.status}`;
        switch (response.status) {
          case 404:
            errorMessage = 'Analysis service not found. Please ensure Ollama is running and the endpoint is correct in extension settings.';
            break;
          case 500:
            errorMessage = 'Analysis service encountered an internal error. Please check Ollama logs.';
            break;
          case 503:
            errorMessage = 'Analysis service is unavailable. Please ensure Ollama is running.';
            break;
        }
        throw new Error(errorMessage);
      }
      return response.json();
    })
    .then(data => {
      if (!data.response) {
        throw new Error('Invalid response from analysis service: missing response field');
      }

      // Try to parse suggestions from the response
      try {
        const suggestions = JSON.parse(data.response);
        resolve(suggestions);
      } catch (e) {
        // If parsing fails, try to extract suggestions using regex
        const suggestionRegex = /{[^}]+}/g;
        const matches = data.response.match(suggestionRegex);
        
        if (matches) {
          const suggestions = matches.map(match => {
            try {
              return JSON.parse(match);
            } catch (e) {
              return null;
            }
          }).filter(Boolean);
          
          if (suggestions.length > 0) {
            resolve(suggestions);
            return;
          }
        }
        
        // If all parsing attempts fail, return the raw response
        resolve([{
          text: data.response,
          confidence: 0.5
        }]);
      }
    })
    .catch(error => {
      Logger.error('Error analyzing issue', error);
      reject(error);
    });
  });
}

// Replace declarativeNetRequest with webRequest API
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    // Add your request handling logic here
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'PROCESS_SCREENSHOT':
      processScreenshot(request.screenshot)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Will respond asynchronously

    case 'ANALYZE_ISSUE':
      analyzeIssue(request.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_SYSTEM_INFO':
      sendResponse({ success: true, data: getSystemInfo() });
      return false;

    case 'GET_ISSUES':
      IssueManager.getIssues()
        .then(issues => sendResponse({ success: true, data: issues }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'ADD_ISSUE':
      IssueManager.addIssue(request.data)
        .then(issue => sendResponse({ success: true, data: issue }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'UPDATE_ISSUE_STATUS':
      IssueManager.updateIssueStatus(request.issueId, request.status)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
}); 