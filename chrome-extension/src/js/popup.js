document.addEventListener('DOMContentLoaded', () => {
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

  // Start the issue reporting process
  async function startReporting() {
    showView('collecting');
    
    try {
      // Get current tab information
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      updateProgress(20);

      // Collect page information
      const pageInfo = {
        url: tab?.url || 'unknown',
        title: tab?.title || 'unknown',
        timestamp: new Date().toISOString()
      };

      updateProgress(40);

      // Get cookies
      const cookies = await chrome.cookies.getAll({ url: pageInfo.url });
      
      updateProgress(60);

      // Capture screenshot
      const screenshot = await chrome.tabs.captureVisibleTab();
      
      updateProgress(80);

      // Send message to background script to process information
      chrome.runtime.sendMessage({
        action: 'processIssue',
        data: {
          pageInfo,
          cookies,
          screenshot
        }
      }, response => {
        updateProgress(100);
        
        if (response.success) {
          // Display suggestions
          displaySuggestions(response.suggestions);
          showView('suggestions');
        } else {
          console.error('Error processing issue:', response.error);
          showView('submit');
        }
      });

    } catch (error) {
      console.error('Error collecting information:', error);
      showView('submit');
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
}); 