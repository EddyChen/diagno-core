// Import configuration manager
import { configManager } from './config.js';

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
(async () => {
  try {
    await configManager.load();
    Logger.info('Configuration loaded', configManager.config);
  } catch (error) {
    Logger.error('Error loading configuration', error);
  }
})();

// Process screenshot through OCR service
async function processScreenshot(screenshot) {
  try {
    Logger.info('Processing screenshot with OCR service');
    
    // Check if service endpoint is configured
    const ocrUrl = configManager.getServiceUrl('ocr');
    if (!ocrUrl) {
      throw new Error('OCR service endpoint not configured. Please check extension settings.');
    }

    Logger.debug('Sending request to OCR service', { endpoint: ocrUrl });

    try {
      const response = await fetch(ocrUrl, {
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
      });

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

      const data = await response.json();
      if (!data.response) {
        throw new Error('Invalid response from OCR service: missing response field');
      }

      Logger.debug('OCR processing complete', { text: data.response.substring(0, 200) + '...' });
      return data.response;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Could not connect to OCR service. Please ensure Ollama is running and accessible.');
      }
      throw error;
    }
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

    const analysisUrl = configManager.getServiceUrl('analysis');
    if (!analysisUrl) {
      throw new Error('Analysis service endpoint not configured. Please check extension settings.');
    }

    const response = await fetch(analysisUrl, {
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
    });

    if (!response.ok) {
      const error = `Analysis service returned ${response.status}`;
      Logger.error(error);
      throw new Error(error);
    }

    const data = await response.json();
    Logger.debug('Analysis complete', { response: data.response });
    
    try {
      // Remove <think> tags and any other XML-like tags
      const cleanedResponse = data.response.replace(/<[^>]*>/g, '');
      // Try to extract JSON from the response
      const jsonMatch = cleanedResponse.match(/\[.*\]/s) || cleanedResponse.match(/\{.*\}/s);
      
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        return Array.isArray(suggestions) ? suggestions : [{ text: cleanedResponse, confidence: 0.7 }];
      } else {
        Logger.warn('No JSON found in response, using raw response');
        return [{
          text: cleanedResponse,
          confidence: 0.7
        }];
      }
    } catch (e) {
      Logger.warn('Failed to parse response, using cleaned response', e);
      return [{
        text: data.response.replace(/<[^>]*>/g, '').trim(),
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
          Logger.debug('System information collected', systemInfo);
          
          // Process screenshot through OCR with timeout
          Logger.info('Starting OCR processing');
          const ocrPromise = processScreenshot(request.data.screenshot);
          const ocrTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OCR processing timeout - The OCR service is taking too long to process the image. Please try again or check if the Ollama service is running properly.')), 
              configManager.get('ollama.options.timeouts.ocr'))
          );
          
          let ocrText;
          try {
            ocrText = await Promise.race([ocrPromise, ocrTimeout]);
            Logger.debug('OCR processing complete', { textLength: ocrText?.length });
          } catch (error) {
            Logger.error('OCR processing failed', error);
            throw error;
          }
          
          // Combine all information
          currentIssue = {
            ...request.data,
            systemInfo,
            ocrText
          };
          
          // Get suggestions with timeout
          Logger.info('Starting issue analysis');
          const analysisPromise = analyzeIssue(currentIssue);
          const analysisTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Analysis processing timeout - The analysis is taking longer than expected. This might be due to the complexity of the issue or high server load. Please try again in a few minutes.')), 
              configManager.get('ollama.options.timeouts.analysis'))
          );
          
          let suggestions;
          try {
            suggestions = await Promise.race([analysisPromise, analysisTimeout]);
            Logger.debug('Issue analysis complete', { suggestionsCount: suggestions?.length });
          } catch (error) {
            Logger.error('Analysis processing failed', error);
            throw error;
          }
          
          Logger.info('Issue processing complete');
          sendResponse({ success: true, suggestions });
        } catch (error) {
          Logger.error('Error processing issue', error);
          sendResponse({ 
            success: false, 
            error: error.message,
            stage: error.message.includes('OCR') ? 'ocr' : 
                   error.message.includes('Analysis') ? 'analysis' : 'unknown'
          });
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