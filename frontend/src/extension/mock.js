// Mock implementation of connectViaBackground to match the real API
export async function connectViaBackground(proxy) {
  // Use the mock connect function
  const newIp = await connect(proxy);
  return newIp;
}
/*
  Frontend-only mocks for the Anslation VPN Extension preview.
  - getProxies(): returns a list of HTTPS proxies (mocked)
  - getRealIp(): returns a mock of your current real IP
  - connect(proxy): simulates connecting to a proxy and returns a masked IP
  - disconnect(): simulates disconnecting
*/

export const delay = (ms = 600) => new Promise((res) => setTimeout(res, ms));

const rnd = () => Math.floor(Math.random() * 255);
const randomIp = () => `${rnd()}.${rnd()}.${rnd()}.${rnd()}`;

const MOCK_PROXIES = [
  { id: "p1", host: "104.248.63.15", port: 30588, country: "Germany", city: "Frankfurt", protocol: "https" },
  { id: "p2", host: "167.99.129.42", port: 443, country: "United States", city: "New York", protocol: "https" },
  { id: "p3", host: "51.158.68.26", port: 8811, country: "France", city: "Paris", protocol: "https" },
  { id: "p4", host: "134.209.29.120", port: 3128, country: "Singapore", city: "Singapore", protocol: "https" },
  { id: "p5", host: "165.22.254.99", port: 8080, country: "Canada", city: "Toronto", protocol: "https" }
];

export async function getProxies() {
  await delay(500);
  return MOCK_PROXIES;
}

export async function getRealIp() {
  await delay(300);
  // A stable but mock IP per session
  const saved = localStorage.getItem("anslation_real_ip");
  if (saved) return saved;
  const ip = randomIp();
  localStorage.setItem("anslation_real_ip", ip);
  return ip;
}

export async function connect(proxy) {
  await delay(800);
  const newIp = randomIp();
  localStorage.setItem("anslation_masked_ip", newIp);
  localStorage.setItem("anslation_selected_proxy", JSON.stringify(proxy));
  localStorage.setItem("anslation_connected", "true");
  return newIp;
}

export async function disconnect() {
  await delay(400);
  localStorage.removeItem("anslation_masked_ip");
  localStorage.setItem("anslation_connected", "false");
  return true;
}

export function getPersisted() {
  const selectedProxy = localStorage.getItem("anslation_selected_proxy");
  const connected = localStorage.getItem("anslation_connected") === "true";
  const maskedIp = localStorage.getItem("anslation_masked_ip") || "";
  return {
    selectedProxy: selectedProxy ? JSON.parse(selectedProxy) : null,
    connected,
    maskedIp,
  };
}