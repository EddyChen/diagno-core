// DOM Elements
const elements = {
  issuesList: document.getElementById('issues-list'),
  emptyState: document.getElementById('empty-state'),
  searchInput: document.getElementById('search'),
  statusFilter: document.getElementById('status-filter'),
  modal: document.getElementById('issue-modal'),
  modalClose: document.getElementById('close-modal'),
  issueDetails: document.getElementById('issue-details')
};

// Current issues data
let issues = [];

// Load and display issues
async function loadIssues() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getIssueHistory' });
    
    if (response.success) {
      issues = response.issues;
      filterAndDisplayIssues();
    } else {
      console.error('Error loading issues:', response.error);
      showError('Failed to load issues');
    }
  } catch (error) {
    console.error('Error loading issues:', error);
    showError('Failed to load issues');
  }
}

// Filter and display issues based on search and status filter
function filterAndDisplayIssues() {
  const searchTerm = elements.searchInput.value.toLowerCase();
  const statusFilter = elements.statusFilter.value;
  
  const filteredIssues = issues.filter(issue => {
    const matchesSearch = 
      issue.id.toLowerCase().includes(searchTerm) ||
      issue.pageInfo.url.toLowerCase().includes(searchTerm) ||
      issue.pageInfo.title.toLowerCase().includes(searchTerm) ||
      (issue.additionalDetails && issue.additionalDetails.toLowerCase().includes(searchTerm));
    
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  displayIssues(filteredIssues);
}

// Display issues in the table
function displayIssues(issuesToDisplay) {
  if (issuesToDisplay.length === 0) {
    elements.issuesList.innerHTML = '';
    elements.emptyState.classList.remove('hidden');
    return;
  }
  
  elements.emptyState.classList.add('hidden');
  elements.issuesList.innerHTML = issuesToDisplay.map(issue => `
    <tr>
      <td>${issue.id}</td>
      <td>
        <div>${issue.pageInfo.title}</div>
        <div style="color: #666; font-size: 12px;">${issue.pageInfo.url}</div>
      </td>
      <td>
        <span class="status-badge status-${issue.status}">
          ${issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
        </span>
      </td>
      <td>
        <div>${new Date(issue.timestamp).toLocaleDateString()}</div>
        <div style="color: #666; font-size: 12px;">
          ${new Date(issue.timestamp).toLocaleTimeString()}
        </div>
      </td>
      <td>
        <button class="details-button" onclick="showIssueDetails('${issue.id}')">
          View Details
        </button>
      </td>
    </tr>
  `).join('');
}

// Show issue details in modal
function showIssueDetails(issueId) {
  const issue = issues.find(i => i.id === issueId);
  if (!issue) return;
  
  elements.issueDetails.innerHTML = `
    <div class="detail-section">
      <h3>Page Information</h3>
      <div class="detail-content">
Title: ${issue.pageInfo.title}
URL: ${issue.pageInfo.url}
Timestamp: ${new Date(issue.timestamp).toLocaleString()}
      </div>
    </div>

    <div class="detail-section">
      <h3>System Information</h3>
      <div class="detail-content">
Platform: ${issue.systemInfo.platform}
Browser: ${issue.systemInfo.userAgent}
Language: ${issue.systemInfo.language}
Screen Resolution: ${issue.systemInfo.screenResolution}
      </div>
    </div>

    <div class="detail-section">
      <h3>OCR Text</h3>
      <div class="detail-content">${issue.ocrText}</div>
    </div>

    ${issue.additionalDetails ? `
    <div class="detail-section">
      <h3>Additional Details</h3>
      <div class="detail-content">${issue.additionalDetails}</div>
    </div>
    ` : ''}

    <div class="detail-section">
      <h3>Screenshot</h3>
      <img src="${issue.screenshot}" alt="Issue Screenshot" class="screenshot">
    </div>
  `;
  
  elements.modal.classList.add('show');
}

// Close modal
function closeModal() {
  elements.modal.classList.remove('show');
}

// Show error message
function showError(message) {
  elements.emptyState.innerHTML = `<p style="color: #cc0000;">${message}</p>`;
  elements.emptyState.classList.remove('hidden');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadIssues);

elements.searchInput.addEventListener('input', filterAndDisplayIssues);
elements.statusFilter.addEventListener('change', filterAndDisplayIssues);
elements.modalClose.addEventListener('click', closeModal);

// Close modal when clicking outside
elements.modal.addEventListener('click', (e) => {
  if (e.target === elements.modal) {
    closeModal();
  }
});

// Make showIssueDetails available globally for the onclick handlers
window.showIssueDetails = showIssueDetails;

// Refresh issues periodically (every 30 seconds)
setInterval(loadIssues, 30000); 