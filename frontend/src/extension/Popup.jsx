import React, { useEffect, useMemo, useState } from "react";
import { Shield, Power, Globe, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { useToast } from "../hooks/use-toast";
// Default to mock API. In extension build, we pass real API via props.
import * as MockAPI from "./mock";
import { connectViaBackground } from "./api";

const StatusDot = ({ connected }) => (
  <span
    className={`inline-block h-2.5 w-2.5 rounded-full mr-2 ${
      connected ? "bg-emerald-500" : "bg-red-500"
    }`}
  />
);

export default function Popup({ api }) {
  const { toast } = useToast();
  // Use the provided API or fall back to mock API
  const API = api || {
    ...MockAPI,
    connectViaBackground: MockAPI.connect,
    disconnect: MockAPI.disconnect
  };

  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [realIp, setRealIp] = useState("");
  const [maskedIp, setMaskedIp] = useState("");
  const [proxies, setProxies] = useState([]);
  const [selected, setSelected] = useState("");

  const statusLabel = useMemo(() => (connected ? "Connected" : "Disconnected"), [connected]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [ips, list] = await Promise.all([API.getRealIp(), API.getProxies()]);
        setRealIp(ips);
        setProxies(list);
        const persisted = API.getPersisted ? API.getPersisted() : MockApi.getPersisted();
        if (persisted.selectedProxy) setSelected(persisted.selectedProxy.id || "");
        if (persisted.connected) {
          setConnected(true);
          setMaskedIp(persisted.maskedIp);
        }
      } finally {
        setLoading(false);
      }
    };
    init();
    // init only once
  }, []);

  const onToggle = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      
      if (connected) {
        // Disconnect if already connected
        await API.disconnect();
        setConnected(false);
        setMaskedIp("");
        toast({
          title: "Disconnected",
          description: "Your connection is now secure",
        });
      } else {
        // Connect to selected proxy
        if (!selected) {
          throw new Error("Please select a proxy server first");
        }
        
        const proxy = proxies.find((p) => p.id === selected);
        if (!proxy) throw new Error("Selected proxy not found");
        
        // Use the API's connect method
        const newIp = await (API.connectViaBackground || API.connect)(proxy);
        
        // Update state
        setMaskedIp(newIp);
        setConnected(true);
        
        toast({
          title: "Connected",
          description: `Connected to ${proxy.city}, ${proxy.country}`,
        });
      }
    } catch (error) {
      console.error("Proxy operation failed:", error);
      toast({
        title: connected ? "Disconnect failed" : "Connection failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100vh] bg-gradient-to-b from-white to-emerald-50 text-gray-900">
      <div className="mx-auto max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-6 w-6 text-emerald-600" />
          <h1 className="text-xl font-semibold tracking-tight">Anslation VPN</h1>
        </div>

        <Card className="shadow-md border border-emerald-100">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <StatusDot connected={connected} />
                <span>{statusLabel}</span>
              </span>
              {connected ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-700">Secure</Badge>
              ) : (
                <Badge variant="secondary" className="text-red-600 bg-red-50">Not secure</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-md bg-gray-50 border">
                <div className="text-xs text-gray-500 mb-1">Real IP</div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{realIp || "-"}</span>
                </div>
              </div>
              <div className="p-3 rounded-md bg-gray-50 border">
                <div className="text-xs text-gray-500 mb-1">Masked IP</div>
                <div className="flex items-center gap-2">
                  {connected ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="font-medium">{maskedIp || "-"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-600">Proxy server</label>
              <Select
                value={selected}
                onValueChange={(id) => {
                  const p = proxies.find((x) => x.id === id);
                  setSelected(id);
                  if (p) localStorage.setItem("anslation_selected_proxy", JSON.stringify(p));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a server" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {proxies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.city}, {p.country} • {p.host}:{p.port}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={onToggle}
              disabled={loading}
              className={`w-full h-11 font-medium gap-2 transition-colors ${
                connected
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              } text-white`}
            >
              <Power className="h-4 w-4" />
              {loading ? (connected ? "Disconnecting..." : "Connecting...") : connected ? "Disconnect" : "Connect"}
            </Button>

            {selected && (
              <div className="text-xs text-gray-500">
                Selected: {proxies.find((p) => p.id === selected).city}, {proxies.find((p) => p.id === selected).country} ({proxies.find((p) => p.id === selected).host}:{proxies.find((p) => p.id === selected).port})
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
          Preview only – using mocked proxy and IP data. The real Chrome extension will fetch live proxies and show your actual IP.
        </p>
      </div>
    </div>
  );
}