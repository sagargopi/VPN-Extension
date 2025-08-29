 /*
  Chrome Extension background service worker (Manifest V3)
  - Applies proxy settings using chrome.proxy API via PAC script
  - Receives messages from popup to set/clear proxy
*/

self.addEventListener("install", () => {
  // service worker installed
});

self.addEventListener("activate", () => {
  // ensure active immediately
});

function buildPacScript(host, port) {
  // HTTPS proxy for all hosts, direct for local
  return `function FindProxyForURL(url, host) {
    var directList = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
    if (directList.indexOf(host) !== -1) return 'DIRECT';
    // Use fixed port 443 for HTTPS proxy
    return 'HTTPS ${host}:${port || 443}; DIRECT';
  }`;
}

async function setProxy({ host, port }) {
  return new Promise((resolve, reject) => {
    try {
      chrome.proxy.settings.set(
        {
          value: {
            mode: "pac_script",
            pacScript: {
              data: buildPacScript(host, port),
            },
          },
          scope: "regular",
        },
        () => {
          const err = chrome.runtime.lastError;
          if (err) reject(err);
          else resolve(true);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

async function clearProxy() {
  return new Promise((resolve, reject) => {
    try {
      chrome.proxy.settings.clear({ scope: "regular" }, () => {
        const err = chrome.runtime.lastError;
        if (err) reject(err);
        else resolve(true);
      });
    } catch (e) {
      reject(e);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "SET_PROXY") {
        console.log("Setting proxy:", message.proxy);
        await setProxy(message.proxy);
        console.log("Proxy set successfully");
        sendResponse({ success: true });
      } else if (message.type === "CLEAR_PROXY") {
        console.log("Clearing proxy");
        await clearProxy();
        console.log("Proxy cleared successfully");
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // Keep the message channel open for async response
});