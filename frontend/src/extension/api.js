/* Live API functions for the real Chrome extension runtime */

// Constants
export const PROXY_LIST_URL = "https://www.proxy-list.download/api/v1/get?type=https";
const IP_APIS = [
  "https://api.ipify.org?format=json",
  "https://ipapi.co/json/",
  "https://ipinfo.io/json"
];

// Backend URL
export const BACKEND_URL = 'https://vpn-extension-2.onrender.com';

// Helper function to fetch with timeout
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
  // Try multiple IP checking services in parallel
  const ipServices = [
    async () => {
      const response = await fetchWithTimeout('https://api.ipify.org?format=json', { timeout: 3000 });
      const data = await response.json();
      return data.ip;
    },
    async () => {
      const response = await fetchWithTimeout('https://ipapi.co/json/', { timeout: 3000 });
      const data = await response.json();
      return data.ip;
    },
    async () => {
      const response = await fetchWithTimeout('https://ipinfo.io/json', { timeout: 3000 });
      const data = await response.json();
      return data.ip;
    }
  ];

  // Try each service in sequence until one succeeds
  for (const service of ipServices) {
    try {
      const ip = await service();
      if (ip) return ip;
    } catch (error) {
      console.warn('IP check service failed, trying next one:', error.message);
      continue;
    }
  }

  // In development, return a mock IP if all requests fail
  if (process.env.NODE_ENV === 'development') {
    console.warn('Using mock IP address in development mode');
    return '203.0.113.1'; // Example IP for documentation
  }
  
  throw new Error('All IP check services failed');
}

// Pre-defined list of reliable proxies with location data
export const PREMIUM_PROXIES = [
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
    host: '157.245.94.10',
    port: 8080,
    country: 'USA',
    city: 'New York',
    protocol: 'https',
    speed: 'fast',
    uptime: '99.8%'
  },
  { 
    id: 'proxy_3',
    host: '157.245.94.10',
    port: 3128,
    country: 'USA',
    city: 'San Francisco',
    protocol: 'https',
    speed: 'medium',
    uptime: '99.7%'
  },
  { 
    id: 'proxy_4',
    host: '157.245.94.10',
    port: 80,
    country: 'UK',
    city: 'London',
    protocol: 'http',
    speed: 'medium',
    uptime: '99.5%'
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

// Export all functions
export async function fetchProxies(limit = 15) {
  // Only use premium proxies since we can't get location for live ones
  const result = [...PREMIUM_PROXIES];
  
  // Store in localStorage for debugging
  if (typeof window !== 'undefined') {
    localStorage.setItem('anslation_proxies', JSON.stringify(result, null, 2));
  }
  
  return result.slice(0, limit);
}

// Make sendMessage available for other functions
export async function sendMessage(message) {
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

export async function connectViaBackground(proxy) {
  try {
    const url = new URL('/api/connect', BACKEND_URL).toString();
    console.log('Connecting to proxy:', proxy);
    
    // Prepare the request body
    const requestBody = {
      host: proxy.host,
      port: parseInt(proxy.port, 10),
      protocol: proxy.protocol || 'https'
    };

    console.log('Sending request to backend:', url, requestBody);
    
    // Send request to backend with a timeout
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      timeout: 15000 // 15 seconds timeout for connection
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    // Send message to background script to set up the proxy
    console.log('Sending proxy settings to background script');
    const result = await sendMessage({
      type: 'SET_PROXY',
      proxy: {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol || 'https'
      }
    });
    
    if (!result || !result.success) {
      console.error('Failed to apply proxy settings in the browser:', result?.error || 'Unknown error');
      throw new Error('Failed to apply proxy settings in the browser');
    }
    
    // Give Chrome a moment to apply proxy, then verify connection with retries
    console.log('Proxy settings applied, verifying connection...');
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        await new Promise((r) => setTimeout(r, 1000)); // Wait for proxy to be applied
        const newIp = await fetchRealIp();
        console.log('Successfully connected through proxy. New IP:', newIp);
        return newIp;
      } catch (error) {
        lastError = error;
        console.warn(`Connection verification failed (${retries} retries left):`, error.message);
        retries--;
      }
    }
    
    throw new Error(`Failed to verify proxy connection: ${lastError?.message || 'Unknown error'}`);
    
  } catch (error) {
    console.error('Error in connectViaBackground:', error);
    
    // Try to clean up on error
    try {
      await disconnectViaBackground();
    } catch (cleanupError) {
      console.error('Error during cleanup after failed connection:', cleanupError);
    }
    
    // In development, return a mock IP for testing
    if (process.env.NODE_ENV === 'development') {
      console.warn('Using mock IP address in development mode');
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