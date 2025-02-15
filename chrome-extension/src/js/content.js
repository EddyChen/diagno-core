// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getPageMetadata':
      const metadata = {
        // Get meta tags
        meta: Array.from(document.getElementsByTagName('meta')).map(meta => ({
          name: meta.getAttribute('name'),
          content: meta.getAttribute('content')
        })),
        
        // Get page structure info
        structure: {
          headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
            level: h.tagName.toLowerCase(),
            text: h.textContent.trim()
          })),
          forms: Array.from(document.forms).map(form => ({
            id: form.id,
            action: form.action,
            method: form.method
          }))
        },
        
        // Get any error messages visible on the page
        errors: Array.from(document.querySelectorAll('.error, .alert, [role="alert"]')).map(el => ({
          text: el.textContent.trim(),
          class: el.className
        })),
        
        // Get current scroll position
        viewport: {
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight
        }
      };
      
      sendResponse({ success: true, data: metadata });
      break;

    case 'getConsoleErrors':
      // Create a proxy to capture console errors
      const originalConsoleError = console.error;
      const errors = [];
      
      console.error = (...args) => {
        errors.push(args.map(arg => String(arg)).join(' '));
        originalConsoleError.apply(console, args);
      };
      
      // Restore original console.error after a short delay
      setTimeout(() => {
        console.error = originalConsoleError;
        sendResponse({ success: true, data: errors });
      }, 1000);
      
      return true; // Keep the message channel open for async response

    case 'highlightElement':
      try {
        const { selector } = request;
        const element = document.querySelector(selector);
        
        if (element) {
          // Store original styles
          const originalOutline = element.style.outline;
          const originalPosition = element.style.position;
          const originalZIndex = element.style.zIndex;
          
          // Apply highlight
          element.style.outline = '2px solid red';
          element.style.position = 'relative';
          element.style.zIndex = '10000';
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            element.style.outline = originalOutline;
            element.style.position = originalPosition;
            element.style.zIndex = originalZIndex;
          }, 3000);
          
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Element not found' });
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
}); 