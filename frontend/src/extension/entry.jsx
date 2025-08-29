import React from "react";
import { createRoot } from "react-dom/client";
import Popup from "./Popup";
import {
  fetchProxies,
  fetchRealIp,
  connectViaBackground,
  disconnectViaBackground,
} from "./api";
import { Toaster } from "../components/ui/toaster";
import "../index.css";

const container = document.getElementById("root");
const root = createRoot(container);

// Provide live API bindings when running inside the extension popup
const api = {
  getProxies: fetchProxies,
  getRealIp: fetchRealIp,
  connect: connectViaBackground,
  disconnect: disconnectViaBackground,
  getPersisted: () => ({ selectedProxy: null, connected: false, maskedIp: "" }),
};

root.render(
  <>
    <Popup api={api} />
    <Toaster />
  </>
);