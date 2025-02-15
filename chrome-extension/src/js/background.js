// Configuration object that can be updated through extension options
let config = {
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
  async addIssue(issue) {
    try {
      const { issues = [] } = await chrome.storage.local.get(['issues']);
      
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
      
      await chrome.storage.local.set({ issues });
      Logger.info('New issue added to history', newIssue);
      return newIssue;
    } catch (error) {
      Logger.error('Error adding issue to history', error);
      throw error;
    }
  },

  async getIssues() {
    try {
      const { issues = [] } = await chrome.storage.local.get(['issues']);
      return issues;
    } catch (error) {
      Logger.error('Error getting issues from history', error);
      throw error;
    }
  },

  async updateIssueStatus(issueId, status) {
    try {
      const { issues = [] } = await chrome.storage.local.get(['issues']);
      const index = issues.findIndex(issue => issue.id === issueId);
      
      if (index !== -1) {
        issues[index].status = status;
        issues[index].updatedAt = new Date().toISOString();
        await chrome.storage.local.set({ issues });
        Logger.info(`Issue ${issueId} status updated to ${status}`);
      }
    } catch (error) {
      Logger.error('Error updating issue status', error);
      throw error;
    }
  }
};

// Load configuration from storage
chrome.storage.local.get(['config'], result => {
  if (result.config) {
    config = { ...config, ...result.config };
    Logger.info('Configuration loaded from storage', config);
  }
});

// Process screenshot through OCR service
async function processScreenshot(screenshot) {
  try {
    Logger.info('Processing screenshot with OCR service');
    
    const response = await fetch(config.services.ocr + '/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.ollama.ocrModel,
        prompt: "Please analyze this screenshot and describe any visible issues or error messages. Extract all text that might be relevant to understanding the problem.",
        images: [screenshot]
      })
    });

    if (!response.ok) {
      const error = `OCR service returned ${response.status}`;
      Logger.error(error);
      throw new Error(error);
    }

    const data = await response.json();
    Logger.debug('OCR processing complete', { text: data.response.substring(0, 200) + '...' });
    return data.response;
  } catch (error) {
    Logger.error('Error processing screenshot', error);
    throw error;
  }
}

// Get system information
async function getSystemInfo() {
  return {
    platform: navigator?.platform || 'unknown',
    userAgent: navigator?.userAgent || 'unknown',
    language: navigator?.language || 'unknown',
    screenResolution: typeof window !== 'undefined' && window.screen 
      ? `${window.screen.width}x${window.screen.height}`
      : '1920x1080', // Default resolution for testing
    timestamp: new Date().toISOString()
  };
}

// Analyze issue and get suggestions
async function analyzeIssue(issueData) {
  try {
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

    const response = await fetch(config.services.analysis + '/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.ollama.analysisModel,
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
      const error = `Analysis service returned ${response.status}`;
      Logger.error(error);
      throw new Error(error);
    }

    const data = await response.json();
    Logger.debug('Analysis complete', { response: data.response });
    
    try {
      const suggestions = JSON.parse(data.response.replace(/```json\n?|\n?```/g, ''));
      return Array.isArray(suggestions) ? suggestions : [{ text: data.response, confidence: 0.7 }];
    } catch (e) {
      Logger.warn('Failed to parse JSON response, using raw response', e);
      return [{
        text: data.response,
        confidence: 0.7
      }];
    }
  } catch (error) {
    Logger.error('Error analyzing issue', error);
    throw error;
  }
}

// Submit issue report to backend (mock implementation)
async function submitIssue(issueData) {
  try {
    Logger.info('Submitting issue report');
    
    // Add to issue history
    const issue = await IssueManager.addIssue(issueData);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    Logger.info('Issue submitted successfully', { issueId: issue.id });
    
    return {
      success: true,
      issueId: issue.id,
      message: 'Issue report submitted successfully'
    };
  } catch (error) {
    Logger.error('Error submitting issue', error);
    throw error;
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'processIssue':
      (async () => {
        try {
          Logger.info('Starting issue processing');
          
          // Get system information
          const systemInfo = await getSystemInfo();
          
          // Process screenshot through OCR
          const ocrText = await processScreenshot(request.data.screenshot);
          
          // Combine all information
          currentIssue = {
            ...request.data,
            systemInfo,
            ocrText
          };
          
          // Get suggestions
          const suggestions = await analyzeIssue(currentIssue);
          
          Logger.info('Issue processing complete');
          sendResponse({ success: true, suggestions });
        } catch (error) {
          Logger.error('Error processing issue', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'submitIssue':
      (async () => {
        try {
          if (!currentIssue) {
            throw new Error('No issue data available');
          }
          
          const response = await submitIssue({
            ...currentIssue,
            additionalDetails: request.data.additionalDetails
          });
          
          // Clear current issue after successful submission
          currentIssue = null;
          
          sendResponse({ success: true, data: response });
        } catch (error) {
          Logger.error('Error submitting issue', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'markResolved':
      (async () => {
        try {
          if (currentIssue && currentIssue.id) {
            await IssueManager.updateIssueStatus(currentIssue.id, 'resolved');
          }
          currentIssue = null;
          Logger.info('Issue marked as resolved');
          sendResponse({ success: true });
        } catch (error) {
          Logger.error('Error marking issue as resolved', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'getIssueHistory':
      (async () => {
        try {
          const issues = await IssueManager.getIssues();
          sendResponse({ success: true, issues });
        } catch (error) {
          Logger.error('Error getting issue history', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
  }
}); 