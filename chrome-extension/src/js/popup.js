// Import configuration manager
import { configManager } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load configuration
  await configManager.load();

  // Get DOM elements
  const views = {
    initial: document.getElementById('initial-view'),
    collecting: document.getElementById('collecting-view'),
    suggestions: document.getElementById('suggestions-view'),
    submit: document.getElementById('submit-view'),
    success: document.getElementById('success-view')
  };

  const buttons = {
    startReport: document.getElementById('start-report'),
    issueResolved: document.getElementById('issue-resolved'),
    submitIssue: document.getElementById('submit-issue'),
    closePopup: document.getElementById('close-popup')
  };

  const suggestionsList = document.getElementById('suggestions-list');
  const issueForm = document.getElementById('issue-form');
  const progressBar = document.querySelector('.progress');

  // Show a specific view and hide others
  function showView(viewName) {
    Object.values(views).forEach(view => {
      if (view) view.classList.add('hidden');
    });
    if (views[viewName]) views[viewName].classList.remove('hidden');
  }

  // Update progress bar
  function updateProgress(percent) {
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
  }

  // Close the popup window safely
  function closePopup() {
    if (typeof window !== 'undefined' && window.close) {
      window.close();
    }
  }

  // Show error message in the UI
  function showError(message) {
    const errorView = document.createElement('div');
    errorView.className = 'error-message';
    errorView.innerHTML = `
      <h2>Error</h2>
      <p>${message}</p>
      <div class="error-actions">
        <button class="secondary-button" onclick="window.location.href='options.html'">Open Settings</button>
        <button class="primary-button" onclick="location.reload()">Try Again</button>
      </div>
    `;
    
    // Insert error view after the current view
    const currentView = Array.from(document.querySelectorAll('.container > div'))
      .find(div => !div.classList.contains('hidden'));
    if (currentView) {
      currentView.insertAdjacentElement('afterend', errorView);
      currentView.classList.add('hidden');
    }
  }

  // Start the issue reporting process
  async function startReporting() {
    showView('collecting');
    let hasError = false;
    
    try {
      // Get current tab information
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      updateProgress(10);

      // Collect page information
      const pageInfo = {
        url: tab?.url || 'unknown',
        title: tab?.title || 'unknown',
        timestamp: new Date().toISOString()
      };

      updateProgress(20);

      // Get cookies
      const cookies = await chrome.cookies.getAll({ url: pageInfo.url });
      
      updateProgress(30);

      // Capture screenshot
      const screenshot = await chrome.tabs.captureVisibleTab();
      
      updateProgress(40);

      // Send message to background script to process information
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'processIssue',
          data: {
            pageInfo,
            cookies,
            screenshot
          }
        }, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });

        // Set a timeout for the entire operation
        // Use the analysis timeout as it's the longest operation
        setTimeout(() => {
          reject(new Error('The operation timed out. This might be due to server load or network issues. Please try again in a few minutes.'));
        }, configManager.get('ollama.options.timeouts.analysis') + 30000); // Add 30 seconds buffer
      });

      if (response.success) {
        updateProgress(100);
        // Display suggestions
        displaySuggestions(response.suggestions);
        showView('suggestions');
      } else {
        hasError = true;
        let errorMessage = response.error || 'An error occurred while processing the issue';
        
        // Add more context based on the stage where error occurred
        if (response.stage === 'ocr') {
          errorMessage = 'Error processing image: ' + errorMessage;
          updateProgress(60);
        } else if (response.stage === 'analysis') {
          errorMessage = 'Error analyzing issue: ' + errorMessage;
          updateProgress(80);
        }
        
        throw new Error(errorMessage);
      }

    } catch (error) {
      console.error('Error collecting information:', error);
      if (!hasError) {
        updateProgress(50); // If error happened before backend processing
      }
      showError(error.message || 'Failed to collect page information. Please try again.');
      setTimeout(() => showView('initial'), 3000);
    }
  }

  // Display suggestions in the UI
  function displaySuggestions(suggestions) {
    if (suggestionsList) {
      suggestionsList.innerHTML = suggestions.map((suggestion, index) => `
        <div class="suggestion-item" data-index="${index}">
          <p>${suggestion.text}</p>
        </div>
      `).join('');
    }
  }

  // Submit the issue report
  async function submitIssueReport(additionalDetails) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'submitIssue',
        data: {
          additionalDetails
        }
      });

      if (response.success) {
        showView('success');
      } else {
        console.error('Error submitting issue:', response.error);
      }
    } catch (error) {
      console.error('Error submitting issue:', error);
    }
  }

  // Event Listeners
  if (buttons.startReport) {
    buttons.startReport.addEventListener('click', startReporting);
  }

  if (buttons.issueResolved) {
    buttons.issueResolved.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'markResolved' });
      closePopup();
    });
  }

  if (buttons.submitIssue) {
    buttons.submitIssue.addEventListener('click', () => {
      showView('submit');
    });
  }

  if (buttons.closePopup) {
    buttons.closePopup.addEventListener('click', closePopup);
  }

  if (issueForm) {
    issueForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const description = document.getElementById('issue-description')?.value || '';
      submitIssueReport(description);
    });
  }

  // Initialize popup
  showView('initial');

  // Add CSS for error message
  const style = document.createElement('style');
  style.textContent = `
    .error-message {
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
      background-color: #FFEBEE;
      color: #C62828;
    }

    .error-message h2 {
      margin: 0 0 8px 0;
      font-size: 16px;
    }

    .error-message p {
      margin: 0 0 16px 0;
      font-size: 14px;
      line-height: 1.5;
    }

    .error-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .error-actions button {
      padding: 6px 12px;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);
}); 