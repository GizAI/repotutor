'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Eye,
  Settings2,
  Moon,
  Sun,
  ArrowDown,
  Brain,
  Languages
} from 'lucide-react';
import { useTheme } from '@/lib/hooks/useTheme';

interface QuickSettingsPanelProps {
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  autoExpandTools: boolean;
  onAutoExpandChange: (value: boolean) => void;
  showRawParameters: boolean;
  onShowRawParametersChange: (value: boolean) => void;
  showThinking: boolean;
  onShowThinkingChange: (value: boolean) => void;
  autoScrollToBottom: boolean;
  onAutoScrollChange: (value: boolean) => void;
  sendByCtrlEnter: boolean;
  onSendByCtrlEnterChange: (value: boolean) => void;
  isMobile?: boolean;
}

const DarkModeToggle: React.FC = () => {
  const { resolvedTheme, cycleTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  return (
    <button
      onClick={cycleTheme}
      className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      style={{
        backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
      }}
      role="switch"
      aria-checked={isDarkMode}
      aria-label="Toggle dark mode"
    >
      <span className="sr-only">Toggle dark mode</span>
      <span
        className={`${
          isDarkMode ? 'translate-x-7' : 'translate-x-1'
        } inline-block h-6 w-6 transform rounded-full shadow-lg transition-transform duration-200 flex items-center justify-center`}
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {isDarkMode ? (
          <Moon className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
        ) : (
          <Sun className="w-3.5 h-3.5 text-yellow-500" />
        )}
      </span>
    </button>
  );
};

const QuickSettingsPanel: React.FC<QuickSettingsPanelProps> = ({
  isOpen,
  onToggle,
  autoExpandTools,
  onAutoExpandChange,
  showRawParameters,
  onShowRawParametersChange,
  showThinking,
  onShowThinkingChange,
  autoScrollToBottom,
  onAutoScrollChange,
  sendByCtrlEnter,
  onSendByCtrlEnterChange,
  isMobile = false
}) => {
  const [localIsOpen, setLocalIsOpen] = useState(isOpen);
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  useEffect(() => {
    setLocalIsOpen(isOpen);
  }, [isOpen]);

  const handleToggle = () => {
    const newState = !localIsOpen;
    setLocalIsOpen(newState);
    onToggle(newState);
  };

  return (
    <>
      {/* Pull Tab */}
      <div
        className={`fixed ${isMobile ? 'bottom-44' : 'top-1/2 -translate-y-1/2'} ${
          localIsOpen ? 'right-64' : 'right-0'
        } z-50 transition-all duration-150 ease-out`}
      >
        <button
          onClick={handleToggle}
          className="rounded-l-md p-2 transition-colors shadow-lg"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderWidth: '1px',
            borderColor: 'var(--border-color)',
          }}
          aria-label={localIsOpen ? 'Close settings panel' : 'Open settings panel'}
        >
          {localIsOpen ? (
            <ChevronRight className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <ChevronLeft className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>
      </div>

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-64 shadow-xl transform transition-transform duration-150 ease-out z-40 ${
          localIsOpen ? 'translate-x-0' : 'translate-x-full'
        } ${isMobile ? 'h-screen' : ''}`}
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderLeftWidth: '1px',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b" style={{
            borderColor: 'var(--border-color)',
            backgroundColor: 'var(--bg-secondary)'
          }}>
            <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Settings2 className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
              Quick Settings
            </h3>
          </div>

          {/* Settings Content */}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 ${isMobile ? 'pb-mobile-nav' : ''}`}>
            {/* Appearance Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Appearance
              </h4>

              <div className="flex items-center justify-between p-3 rounded-lg transition-colors border"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'transparent',
                }}
              >
                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  {isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  Dark Mode
                </span>
                <DarkModeToggle />
              </div>
            </div>

            {/* Tool Display Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Tool Display
              </h4>

              <label className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'transparent',
                }}
              >
                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <Maximize2 className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  Auto-expand tools
                </span>
                <input
                  type="checkbox"
                  checked={autoExpandTools}
                  onChange={(e) => onAutoExpandChange(e.target.checked)}
                  className="h-4 w-4 rounded border text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'transparent',
                }}
              >
                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <Eye className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  Show raw parameters
                </span>
                <input
                  type="checkbox"
                  checked={showRawParameters}
                  onChange={(e) => onShowRawParametersChange(e.target.checked)}
                  className="h-4 w-4 rounded border text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'transparent',
                }}
              >
                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <Brain className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  Show thinking
                </span>
                <input
                  type="checkbox"
                  checked={showThinking}
                  onChange={(e) => onShowThinkingChange(e.target.checked)}
                  className="h-4 w-4 rounded border text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
              </label>
            </div>

            {/* View Options */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                View Options
              </h4>

              <label className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'transparent',
                }}
              >
                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <ArrowDown className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  Auto-scroll to bottom
                </span>
                <input
                  type="checkbox"
                  checked={autoScrollToBottom}
                  onChange={(e) => onAutoScrollChange(e.target.checked)}
                  className="h-4 w-4 rounded border text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
              </label>
            </div>

            {/* Input Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Input Settings
              </h4>

              <label className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'transparent',
                }}
              >
                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <Languages className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  Send by Ctrl+Enter
                </span>
                <input
                  type="checkbox"
                  checked={sendByCtrlEnter}
                  onChange={(e) => onSendByCtrlEnterChange(e.target.checked)}
                  className="h-4 w-4 rounded border text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
              </label>
              <p className="text-xs ml-3" style={{ color: 'var(--text-muted)' }}>
                When enabled, pressing Ctrl+Enter will send the message instead of just Enter. This is useful for IME users to avoid accidental sends.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {localIsOpen && (
        <div
          className="fixed inset-0 backdrop-blur-sm z-30 transition-opacity duration-150 ease-out"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={handleToggle}
        />
      )}
    </>
  );
};

export default QuickSettingsPanel;
