// Store the current proxy state
let currentProxy = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SET_PROXY') {
    // Store the proxy settings
    currentProxy = request.proxy;
    
    // Apply the proxy settings to the browser
    const config = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: currentProxy.protocol || 'https',
          host: currentProxy.host,
          port: parseInt(currentProxy.port)
        },
        bypassList: ['localhost', '127.0.0.1']
      }
    };

    chrome.proxy.settings.set(
      { value: config, scope: 'regular' },
      () => {
        console.log('Proxy settings applied:', currentProxy);
        sendResponse({ success: true });
      }
    );
    return true; // Required for async sendResponse
  }
  
  if (request.type === 'CLEAR_PROXY') {
    // Clear proxy settings
    chrome.proxy.settings.clear(
      { scope: 'regular' },
      () => {
        console.log('Proxy settings cleared');
        currentProxy = null;
        sendResponse({ success: true });
      }
    );
    return true; // Required for async sendResponse
  }
  
  if (request.type === 'GET_PROXY_STATUS') {
    // Return current proxy status
    sendResponse({ currentProxy });
  }
});

// Listen for extension installation/update
chrome.runtime.onInstalled.addListener(() => {
  // Clear any existing proxy settings when extension is installed/updated
  chrome.proxy.settings.clear({ scope: 'regular' });
});

// Listen for browser startup
chrome.runtime.onStartup.addListener(() => {
  // Re-apply proxy settings if they exist
  if (currentProxy) {
    const config = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: currentProxy.protocol || 'https',
          host: currentProxy.host,
          port: parseInt(currentProxy.port)
        },
        bypassList: ['localhost', '127.0.0.1']
      }
    };
    
    chrome.proxy.settings.set({ value: config, scope: 'regular' });
  }
});
