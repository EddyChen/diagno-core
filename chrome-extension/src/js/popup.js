// Configuration manager
var configManager = {
  config: null,
  
  load: function(callback) {
    var self = this;
    chrome.storage.local.get(['config'], function(result) {
      self.config = result.config || {
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
      if (callback) callback();
    });
  },

  getServiceUrl: function(service) {
    return this.config && this.config.services ? this.config.services[service] : null;
  },

  get: function(path) {
    var parts = path.split('.');
    var obj = this.config;
    for (var i = 0; i < parts.length; i++) {
      if (!obj) return null;
      obj = obj[parts[i]];
    }
    return obj;
  }
};

document.addEventListener('DOMContentLoaded', function() {
  // Load configuration
  configManager.load(function() {
    // Get DOM elements
    var views = {
      initial: document.getElementById('initial-view'),
      collecting: document.getElementById('collecting-view'),
      suggestions: document.getElementById('suggestions-view'),
      submit: document.getElementById('submit-view'),
      success: document.getElementById('success-view')
    };

    var buttons = {
      startReport: document.getElementById('start-report'),
      issueResolved: document.getElementById('issue-resolved'),
      submitIssue: document.getElementById('submit-issue'),
      closePopup: document.getElementById('close-popup')
    };

    var suggestionsList = document.getElementById('suggestions-list');
    var issueForm = document.getElementById('issue-form');
    var progressBar = document.querySelector('.progress');

    // Show a specific view and hide others
    function showView(viewName) {
      for (var key in views) {
        if (views[key]) {
          views[key].classList.add('hidden');
        }
      }
      if (views[viewName]) {
        views[viewName].classList.remove('hidden');
      }
    }

    // Update progress bar
    function updateProgress(percent) {
      if (progressBar) {
        progressBar.style.width = percent + '%';
      }
    }

    // Close the popup window safely
    function closePopup() {
      if (window.close) {
        window.close();
      }
    }

    // Show error message in the UI
    function showError(message) {
      var errorView = document.createElement('div');
      errorView.className = 'error-message';
      errorView.innerHTML = [
        '<h2>Error</h2>',
        '<p>' + message + '</p>',
        '<div class="error-actions">',
        '  <button class="secondary-button" onclick="window.location.href=\'options.html\'">Open Settings</button>',
        '  <button class="primary-button" onclick="location.reload()">Try Again</button>',
        '</div>'
      ].join('');
      
      // Insert error view after the current view
      var currentView = null;
      var divs = document.querySelectorAll('.container > div');
      for (var i = 0; i < divs.length; i++) {
        if (!divs[i].classList.contains('hidden')) {
          currentView = divs[i];
          break;
        }
      }
      
      if (currentView) {
        currentView.parentNode.insertBefore(errorView, currentView.nextSibling);
        currentView.classList.add('hidden');
      }
    }

    // Start the issue reporting process
    function startReporting() {
      showView('collecting');
      var hasError = false;
      
      // Get current tab information
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var tab = tabs[0];
        updateProgress(10);

        // Collect page information
        var pageInfo = {
          url: tab ? tab.url : 'unknown',
          title: tab ? tab.title : 'unknown',
          timestamp: new Date().toISOString()
        };

        updateProgress(20);

        // Get cookies
        chrome.cookies.getAll({ url: pageInfo.url }, function(cookies) {
          updateProgress(30);

          // Capture screenshot
          chrome.tabs.captureVisibleTab(function(screenshot) {
            updateProgress(40);

            // Send message to background script to process information
            var timeoutId = setTimeout(function() {
              hasError = true;
              showError('The operation timed out. This might be due to server load or network issues. Please try again in a few minutes.');
              setTimeout(function() { showView('initial'); }, 3000);
            }, configManager.get('ollama.options.timeouts.analysis') + 30000); // Add 30 seconds buffer

            chrome.runtime.sendMessage({
              action: 'processIssue',
              data: {
                pageInfo: pageInfo,
                cookies: cookies,
                screenshot: screenshot
              }
            }, function(response) {
              clearTimeout(timeoutId);
              
              if (chrome.runtime.lastError) {
                hasError = true;
                console.error('Runtime error:', chrome.runtime.lastError);
                showError(chrome.runtime.lastError.message || 'Failed to process issue. Please try again.');
                setTimeout(function() { showView('initial'); }, 3000);
                return;
              }

              if (response.success) {
                updateProgress(100);
                // Display suggestions
                displaySuggestions(response.suggestions);
                showView('suggestions');
              } else {
                hasError = true;
                var errorMessage = response.error || 'An error occurred while processing the issue';
                
                // Add more context based on the stage where error occurred
                if (response.stage === 'ocr') {
                  errorMessage = 'Error processing image: ' + errorMessage;
                  updateProgress(60);
                } else if (response.stage === 'analysis') {
                  errorMessage = 'Error analyzing issue: ' + errorMessage;
                  updateProgress(80);
                }
                
                showError(errorMessage);
                setTimeout(function() { showView('initial'); }, 3000);
              }
            });
          });
        });
      });
    }

    // Display suggestions in the UI
    function displaySuggestions(suggestions) {
      if (suggestionsList) {
        var html = '';
        for (var i = 0; i < suggestions.length; i++) {
          html += '<div class="suggestion-item" data-index="' + i + '">';
          html += '<p>' + suggestions[i].text + '</p>';
          html += '</div>';
        }
        suggestionsList.innerHTML = html;
      }
    }

    // Submit the issue report
    function submitIssueReport(additionalDetails) {
      chrome.runtime.sendMessage({
        action: 'submitIssue',
        data: {
          additionalDetails: additionalDetails
        }
      }, function(response) {
        if (response.success) {
          showView('success');
        } else {
          console.error('Error submitting issue:', response.error);
        }
      });
    }

    // Event Listeners
    if (buttons.startReport) {
      buttons.startReport.addEventListener('click', startReporting);
    }

    if (buttons.issueResolved) {
      buttons.issueResolved.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'markResolved' });
        closePopup();
      });
    }

    if (buttons.submitIssue) {
      buttons.submitIssue.addEventListener('click', function() {
        showView('submit');
      });
    }

    if (buttons.closePopup) {
      buttons.closePopup.addEventListener('click', closePopup);
    }

    if (issueForm) {
      issueForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var description = document.getElementById('issue-description');
        submitIssueReport(description ? description.value : '');
      });
    }

    // Initialize popup
    showView('initial');

    // Add CSS for error message
    var style = document.createElement('style');
    style.textContent = [
      '.error-message {',
      '  padding: 16px;',
      '  margin: 16px 0;',
      '  border-radius: 4px;',
      '  background-color: #FFEBEE;',
      '  color: #C62828;',
      '}',
      '',
      '.error-message h2 {',
      '  margin: 0 0 8px 0;',
      '  font-size: 16px;',
      '}',
      '',
      '.error-message p {',
      '  margin: 0 0 16px 0;',
      '  font-size: 14px;',
      '  line-height: 1.5;',
      '}',
      '',
      '.error-actions {',
      '  display: flex;',
      '  gap: 8px;',
      '  justify-content: flex-end;',
      '}',
      '',
      '.error-actions button {',
      '  padding: 6px 12px;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  });
}); 