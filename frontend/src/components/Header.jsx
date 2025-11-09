import React, { useState } from "react";
import {
  importSettings,
  exportSettings,
  validateSettings,
  saveSettings,
} from "../utils/settingsManager";

const Header = ({
  currentMode,
  isLoadingModes,
  fileInputRef,
  sliders,
  inputSignal,
  apiSignal,
  onModeChange,
  onFileUpload,
  onReloadConfig,
  onResetDefaults,
  onLoadSettings,
  onToast,
}) => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPresetName, setExportPresetName] = useState("");

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExportConfirm = () => {
    const timestamp = new Date().toISOString().split("T")[0];
    const defaultName = `${currentMode}-preset-${timestamp}`;
    const finalName = exportPresetName.trim() || defaultName;

    exportSettings(currentMode, sliders, finalName);
    onToast(`✅ Settings exported as "${finalName}"`, "success");

    setShowExportModal(false);
    setExportPresetName("");
  };

  const handleImportSettings = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const settings = await importSettings(file);

      if (!validateSettings(settings)) {
        onToast("❌ Invalid settings file format", "error");
        return;
      }

      onLoadSettings(settings);
      onToast("✅ Settings loaded successfully", "success");
    } catch (error) {
      console.error("Error loading settings:", error);
      onToast(`❌ Failed to load settings: ${error.message}`, "error");
    }
  };

  return (
    <>
      {/* Export Modal */}
      {showExportModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowExportModal(false)}
        >
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <h3>💾 Export Settings</h3>
            <p>Enter a preset name (optional):</p>
            <input
              type="text"
              className="export-input"
              placeholder={`${currentMode}-preset-${
                new Date().toISOString().split("T")[0]
              }`}
              value={exportPresetName}
              onChange={(e) => setExportPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleExportConfirm();
                if (e.key === "Escape") setShowExportModal(false);
              }}
              autoFocus
            />
            <div className="export-buttons">
              <button className="btn btn-primary" onClick={handleExportConfirm}>
                💾 Export
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowExportModal(false);
                  setExportPresetName("");
                }}
              >
                ✖ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1>🎵 Signal Equalizer</h1>

            {isLoadingModes ? (
              <div className="mode-loading">⏳ Loading modes...</div>
            ) : (
              <div className="mode-selector-container">
                <select
                  className="mode-selector"
                  value={currentMode}
                  onChange={onModeChange}
                  disabled={isLoadingModes}
                >
                  <option value="generic">⚙️ Generic Mode</option>
                  <option value="musical">🎵 Musical Instruments</option>
                  <option value="animal">🐾 Animal Sounds</option>
                  <option value="human">👤 Human Voices</option>
                </select>
              </div>
            )}
          </div>

          <div className="header-buttons">
            <button
              className="btn btn-secondary"
              onClick={() => fileInputRef.current.click()}
            >
              📁 Load Signal
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="file-input"
              accept="audio/*,.wav,.mp3"
              onChange={onFileUpload}
            />

            <button
              className="btn btn-secondary"
              onClick={onReloadConfig}
              disabled={isLoadingModes}
              title="Reload configuration from modes.json file"
            >
              🔄 Reload from JSON
            </button>

            <button
              className="btn btn-secondary"
              onClick={onResetDefaults}
              disabled={isLoadingModes}
              title="Reset all modes to default configuration"
            >
              🔄 Reset to Defaults
            </button>

            <button className="btn btn-secondary" onClick={handleExportClick}>
              💾 Export Settings
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => document.getElementById("loadSettings").click()}
            >
              📂 Import Settings
            </button>
            <input
              id="loadSettings"
              type="file"
              className="file-input"
              accept=".json"
              onChange={handleImportSettings}
            />
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
