// Listen for messages from the extension
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch (request.action) {
    case 'getPageMetadata':
      var metadata = {
        // Get meta tags
        meta: Array.prototype.slice.call(document.getElementsByTagName('meta')).map(function(meta) {
          return {
            name: meta.getAttribute('name'),
            content: meta.getAttribute('content')
          };
        }),
        
        // Get page structure info
        structure: {
          headings: Array.prototype.slice.call(document.querySelectorAll('h1, h2, h3')).map(function(h) {
            return {
              level: h.tagName.toLowerCase(),
              text: h.textContent.trim()
            };
          }),
          forms: Array.prototype.slice.call(document.forms).map(function(form) {
            return {
              id: form.id,
              action: form.action,
              method: form.method
            };
          })
        },
        
        // Get any error messages visible on the page
        errors: Array.prototype.slice.call(document.querySelectorAll('.error, .alert, [role="alert"]')).map(function(el) {
          return {
            text: el.textContent.trim(),
            class: el.className
          };
        }),
        
        // Get current scroll position
        viewport: {
          scrollX: window.pageXOffset || document.documentElement.scrollLeft,
          scrollY: window.pageYOffset || document.documentElement.scrollTop,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight
        }
      };
      
      sendResponse({ success: true, data: metadata });
      break;

    case 'getConsoleErrors':
      // Create a proxy to capture console errors
      var originalConsoleError = console.error;
      var errors = [];
      
      console.error = function() {
        var args = Array.prototype.slice.call(arguments);
        errors.push(args.map(function(arg) { return String(arg); }).join(' '));
        originalConsoleError.apply(console, args);
      };
      
      // Restore original console.error after a short delay
      setTimeout(function() {
        console.error = originalConsoleError;
        sendResponse({ success: true, data: errors });
      }, 1000);
      
      return true; // Keep the message channel open for async response

    case 'highlightElement':
      try {
        var selector = request.selector;
        var element = document.querySelector(selector);
        
        if (element) {
          // Store original styles
          var originalOutline = element.style.outline;
          var originalPosition = element.style.position;
          var originalZIndex = element.style.zIndex;
          
          // Apply highlight
          element.style.outline = '2px solid red';
          element.style.position = 'relative';
          element.style.zIndex = '10000';
          
          // Remove highlight after 3 seconds
          setTimeout(function() {
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