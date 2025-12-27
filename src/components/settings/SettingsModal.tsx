'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sun, Monitor } from 'lucide-react';
import { useThemeContext } from '@/components/layout/ThemeProvider';
import { useT } from '@/lib/i18n';

type TabType = 'general' | 'appearance' | 'editor' | 'ai';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useT();
  const { themeMode, setTheme } = useThemeContext();
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // General settings
  const [maxTurns, setMaxTurns] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('maxTurns') || '50', 10);
    }
    return 50;
  });
  const [budgetLimit, setBudgetLimit] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('budgetLimit') || '10');
    }
    return 10;
  });

  // Editor settings
  const [editorTheme, setEditorTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('editorTheme') || 'dark';
    }
    return 'dark';
  });
  const [editorFontSize, setEditorFontSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('editorFontSize') || '14', 10);
    }
    return 14;
  });
  const [editorWordWrap, setEditorWordWrap] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('editorWordWrap') === 'true';
    }
    return true;
  });
  const [editorMinimap, setEditorMinimap] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('editorMinimap') !== 'false';
    }
    return true;
  });

  // AI settings
  const [defaultModel, setDefaultModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('defaultModel') || 'claude-sonnet-4-20250514';
    }
    return 'claude-sonnet-4-20250514';
  });
  const [enableThinking, setEnableThinking] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('enableThinking') !== 'false';
    }
    return true;
  });

  // Save settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('maxTurns', maxTurns.toString());
      localStorage.setItem('budgetLimit', budgetLimit.toString());
      localStorage.setItem('editorTheme', editorTheme);
      localStorage.setItem('editorFontSize', editorFontSize.toString());
      localStorage.setItem('editorWordWrap', editorWordWrap.toString());
      localStorage.setItem('editorMinimap', editorMinimap.toString());
      localStorage.setItem('defaultModel', defaultModel);
      localStorage.setItem('enableThinking', enableThinking.toString());
    }
  }, [maxTurns, budgetLimit, editorTheme, editorFontSize, editorWordWrap, editorMinimap, defaultModel, enableThinking]);

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'general', label: t('settings.general'), icon: 'settings' },
    { id: 'appearance', label: t('settings.appearance'), icon: 'palette' },
    { id: 'editor', label: t('settings.editor'), icon: 'code' },
    { id: 'ai', label: t('settings.ai'), icon: 'spark' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-2xl max-h-[80vh] bg-[var(--bg-primary)] rounded-xl border border-[var(--border-default)] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('settings.title')}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex h-[500px]">
            {/* Sidebar */}
            <div className="w-48 border-r border-[var(--border-default)] p-4 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">{t('settings.limits')}</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">
                          {t('settings.maxTurns')}
                        </label>
                        <input
                          type="number"
                          value={maxTurns}
                          onChange={(e) => setMaxTurns(parseInt(e.target.value, 10) || 50)}
                          min={1}
                          max={200}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm"
                        />
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {t('settings.maxTurnsDescription')}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">
                          {t('settings.budgetLimit')}
                        </label>
                        <input
                          type="number"
                          value={budgetLimit}
                          onChange={(e) => setBudgetLimit(parseFloat(e.target.value) || 10)}
                          min={0.1}
                          step={0.1}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm"
                        />
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {t('settings.budgetLimitDescription')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">{t('settings.theme')}</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {(['dark', 'light', 'system'] as const).map((theme) => (
                        <button
                          key={theme}
                          onClick={() => setTheme(theme)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                            themeMode === theme
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                              : 'border-[var(--border-default)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          {theme === 'dark' ? <Moon className="w-6 h-6" /> : theme === 'light' ? <Sun className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                          <span className="text-sm capitalize">{theme}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'editor' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">{t('settings.codeEditor')}</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">{t('settings.theme')}</label>
                        <select
                          value={editorTheme}
                          onChange={(e) => setEditorTheme(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm"
                        >
                          <option value="dark">Dark</option>
                          <option value="light">Light</option>
                          <option value="dracula">Dracula</option>
                          <option value="monokai">Monokai</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">
                          {t('settings.fontSize')}: {editorFontSize}px
                        </label>
                        <input
                          type="range"
                          value={editorFontSize}
                          onChange={(e) => setEditorFontSize(parseInt(e.target.value, 10))}
                          min={10}
                          max={24}
                          className="w-full"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--text-secondary)]">{t('settings.wordWrap')}</span>
                        <button
                          onClick={() => setEditorWordWrap(!editorWordWrap)}
                          className={`w-12 h-6 rounded-full transition-colors ${
                            editorWordWrap ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                              editorWordWrap ? 'translate-x-6' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--text-secondary)]">{t('settings.showMinimap')}</span>
                        <button
                          onClick={() => setEditorMinimap(!editorMinimap)}
                          className={`w-12 h-6 rounded-full transition-colors ${
                            editorMinimap ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                              editorMinimap ? 'translate-x-6' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ai' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">{t('settings.aiSettings')}</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">{t('settings.defaultModel')}</label>
                        <select
                          value={defaultModel}
                          onChange={(e) => setDefaultModel(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm"
                        >
                          <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                          <option value="claude-opus-4-20250514">Claude Opus 4</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-[var(--text-secondary)]">{t('settings.extendedThinking')}</span>
                          <p className="text-xs text-[var(--text-tertiary)]">{t('settings.extendedThinkingDescription')}</p>
                        </div>
                        <button
                          onClick={() => setEnableThinking(!enableThinking)}
                          className={`w-12 h-6 rounded-full transition-colors ${
                            enableThinking ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                              enableThinking ? 'translate-x-6' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
