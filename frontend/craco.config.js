/*
  CRACO config to build both the web app and the Chrome extension bundle.
  - Adds popup entry (React) and HTML file
  - Copies background.js and manifest.json to predictable names without hashes
*/

const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      const originalEntry = webpackConfig.entry;
      webpackConfig.entry = async () => {
        const entries = typeof originalEntry === "function" ? await originalEntry() : originalEntry;
        // CRA may return a string/array for the main entry. Normalize to an object.
        const normalized =
          typeof entries === "string" || Array.isArray(entries)
            ? { main: entries }
            : entries;
        return {
          ...normalized,
          popup: path.resolve(__dirname, "src/extension/entry.jsx"),
        };
      };

      webpackConfig.plugins.push(
        new HtmlWebpackPlugin({
          filename: "popup.html",
          chunks: ["popup"],
          template: path.resolve(__dirname, "public/popup.html"),
          inject: true,
        }),
        new CopyWebpackPlugin({
          patterns: [
            { from: path.resolve(__dirname, "src/extension/background.js"), to: "background.js" },
            { from: path.resolve(__dirname, "public/manifest.json"), to: "manifest.json" }
          ],
        })
      );

      return webpackConfig;
    },
  },
};