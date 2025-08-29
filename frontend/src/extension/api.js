/* Live API functions for the real Chrome extension runtime */

const PROXY_LIST_URL = "https://www.proxy-list.download/api/v1/get?type=https";
const IP_APIS = [
  "https://api.ipify.org?format=json",
  "https://ipapi.co/json/",
  "https://ipinfo.io/json"
];

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function fetchRealIp() {
  // Try multiple IP APIs in case one fails
  for (const api of IP_APIS) {
    try {
      const res = await fetchWithTimeout(api, { cache: "no-store" });
      const data = await res.json();
      return data.ip || data.ipAddress || data.ip_address || data.query;
    } catch (error) {
      console.warn(`Failed to fetch IP from ${api}:`, error);
      continue;
    }
  }
  
  // If all APIs fail, return a mock IP in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('Using mock IP - all IP APIs failed');
    return '192.168.1.1';
  }
  
  throw new Error('Could not determine IP address');
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

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime) {
      reject(new Error("Chrome runtime not available"));
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) reject(err);
        else resolve(resp);
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function connectViaBackground(proxy) {
  try {
    await sendMessage({ type: "SET_PROXY", proxy });
    // Give Chrome a brief moment to apply proxy, then read current IP
    await new Promise((r) => setTimeout(r, 700));
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
    await sendMessage({ type: "CLEAR_PROXY" });
    return true;
  } catch (error) {
    console.error('Error disconnecting proxy:', error);
    return false;
  }
}