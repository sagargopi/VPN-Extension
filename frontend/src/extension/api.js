/* Live API functions for the real Chrome extension runtime */

const PROXY_LIST_URL = "https://www.proxy-list.download/api/v1/get?type=https";
const IP_APIS = [
  "https://api.ipify.org?format=json",
  "https://ipapi.co/json/",
  "https://ipinfo.io/json"
];

// Helper function to fetch the current public IP
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 5000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    clearTimeout(id);
    // Don't log aborted requests as errors
    if (error.name !== 'AbortError') {
      console.error(`Error fetching ${resource}:`, error);
    }
    throw error;
  }
}

export async function fetchRealIp() {
  const urls = [
    'https://api.ipify.org?format=json',
    'https://ipapi.co/json/',
    'https://ipinfo.io/json'
  ];

  const errors = [];
  
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, { timeout: 3000 });
      const data = await response.json();
      const ip = data.ip || data.query || data.ipAddress;
      if (ip) return ip;
      throw new Error('No IP found in response');
    } catch (error) {
      // Only log non-abort errors
      if (error.name !== 'AbortError') {
        console.error(`Failed to fetch IP from ${url}:`, error.message);
        errors.push(error.message);
      }
      // Continue to next URL
    }
  }
  
  // In development, return a mock IP if all requests fail
  if (process.env.NODE_ENV === 'development') {
    console.warn('Using mock IP address in development mode');
    return '203.0.113.1'; // Example IP for documentation
  }
  
  throw new Error(`All IP fetch attempts failed: ${errors.join('; ')}`);
}

// Pre-defined list of reliable proxies with location data
const PREMIUM_PROXIES = [
  { 
    id: 'proxy_1',
    host: '104.248.63.15',
    port: 30588,
    country: 'Germany',
    city: 'Frankfurt',
    protocol: 'https',
    speed: 'fast',
    uptime: '99.9%'
  },
  {
    id: 'proxy_2',
    host: '167.99.129.42',
    port: 443,
    country: 'United States',
    city: 'New York',
    protocol: 'https',
    speed: 'fast',
    uptime: '99.8%'
  },
  {
    id: 'proxy_3',
    host: '51.158.68.26',
    port: 8811,
    country: 'France',
    city: 'Paris',
    protocol: 'https',
    speed: 'medium',
    uptime: '99.7%'
  },
  {
    id: 'proxy_4',
    host: '134.209.29.120',
    port: 3128,
    country: 'Singapore',
    city: 'Singapore',
    protocol: 'https',
    speed: 'fast',
    uptime: '99.9%'
  },
  {
    id: 'proxy_5',
    host: '165.22.254.99',
    port: 8080,
    country: 'Canada',
    city: 'Toronto',
    protocol: 'https',
    speed: 'medium',
    uptime: '99.6%'
  }
];

export async function fetchProxies(limit = 15) {
  // Only use premium proxies since we can't get location for live ones
  const result = [...PREMIUM_PROXIES];
  
  // Store in localStorage for debugging
  if (typeof window !== 'undefined') {
    localStorage.setItem('anslation_proxies', JSON.stringify(result, null, 2));
  }
  
  return result.slice(0, limit);
}

async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to background:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      console.error('Exception in sendMessage:', e);
      reject(e);
    }
  });
}

// Get the backend URL from environment or use a default
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export async function connectViaBackground(proxy) {
  try {
    const url = new URL('/api/connect', BACKEND_URL).toString();
    console.log('Connecting to proxy:', proxy);
    
    // First send the connect request to our backend
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol || 'https'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      let errorDetail = `Failed to connect to proxy (${response.status} ${response.statusText})`;
      try {
        const errorData = JSON.parse(errorText);
        errorDetail = errorData.detail || errorData.message || errorText;
      } catch (e) {
        errorDetail = errorText || errorDetail;
      }
      throw new Error(errorDetail);
    }

    // Then apply the proxy in the browser using the background script
    console.log('Sending proxy settings to background script');
    const result = await sendMessage({ 
      type: "SET_PROXY", 
      proxy: {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol || 'https'
      }
    });
    
    if (!result || !result.success) {
      throw new Error('Failed to apply proxy settings in the browser');
    }
    
    // Give Chrome a moment to apply proxy, then read current IP
    await new Promise((r) => setTimeout(r, 1000));
    return await fetchRealIp();
  } catch (error) {
    console.error('Error in connectViaBackground:', error);
    // Return a mock IP in development if the connection fails
    if (process.env.NODE_ENV === 'development') {
      return '203.0.113.1'; // Example IP for documentation
    }
    throw error;
  }
}

export async function disconnectViaBackground() {
  try {
    console.log('Disconnecting from proxy');
    
    // First clear the proxy in the browser
    const clearResult = await sendMessage({ type: "CLEAR_PROXY" });
    
    if (!clearResult || !clearResult.success) {
      console.warn('Failed to clear proxy settings in the browser, but continuing with backend disconnect');
    }
    
    // Then send the disconnect request to our backend
    const response = await fetch(new URL('/api/disconnect', BACKEND_URL).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error response:', errorText);
      // Don't throw here, we still want to clear the proxy settings
    }
    
    return true;
  } catch (error) {
    console.error('Error in disconnectViaBackground:', error);
    return false;
  }
}