import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Popup from "./extension/Popup";
import { Toaster } from "./components/ui/toaster";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Default to the extension preview */}
          <Route path="/" element={<Popup />} />
          {/* Alias keeps old link working */}
          <Route path="/extension" element={<Popup />} />
          {/* Any unknown route redirects to preview */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </div>
  );
}

export default App;