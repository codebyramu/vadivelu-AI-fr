import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Key,
  Volume2,
  Mic,
  UserCheck,
  Sparkles,
  Moon,
  Sun,
  ShieldCheck,
  Plus,
  Check,
  AlertCircle,
  Laptop,
} from 'lucide-react';
import { UserSettings, PersonalityPreset, VoiceGender } from '../types';
import { api, HealthStatus } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (settings: Partial<UserSettings>) => void;
  isDarkTheme: boolean;
  themeChoice: 'light' | 'dark' | 'system';
  onSelectTheme: (theme: 'light' | 'dark' | 'system') => void;
  onToggleTheme: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  isDarkTheme,
  themeChoice,
  onSelectTheme,
  onToggleTheme,
}) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'personality' | 'voice' | 'gemini' | 'preferences'>('personality');

  // API Keys Form state
  const [keysInput, setKeysInput] = useState('');
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      loadHealth();
    }
  }, [isOpen]);

  const loadHealth = async () => {
    try {
      const data = await api.getHealth();
      setHealthStatus(data);
    } catch (e) {
      console.warn('Failed to load health:', e);
    }
  };

  const handleSaveKeys = async () => {
    const rawKeys = keysInput
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0 && !k.startsWith('#'));

    if (rawKeys.length === 0) {
      setKeySaveMessage({ type: 'error', text: 'Please enter at least one valid Gemini API key.' });
      return;
    }

    setIsSavingKeys(true);
    setKeySaveMessage(null);
    try {
      const res = await api.saveGeminiKeys(rawKeys);
      setKeySaveMessage({ type: 'success', text: `Saved ${rawKeys.length} Gemini API keys successfully!` });
      setKeysInput('');
      await loadHealth();
    } catch (err: any) {
      setKeySaveMessage({ type: 'error', text: err.message || 'Failed to save API keys.' });
    } finally {
      setIsSavingKeys(false);
    }
  };

  if (!isOpen) return null;

  const handlePresetSelect = (preset: PersonalityPreset) => {
    const updated = { ...localSettings, defaultPersonality: preset };
    setLocalSettings(updated);
    onSaveSettings({ defaultPersonality: preset });
  };

  const handleVoiceGenderSelect = (gender: VoiceGender) => {
    const updated = { ...localSettings, voiceGender: gender };
    setLocalSettings(updated);
    onSaveSettings({ voiceGender: gender });
  };

  const handleVoiceModeSelect = (mode: 'push_to_talk' | 'continuous') => {
    const updated = { ...localSettings, voiceMode: mode };
    setLocalSettings(updated);
    onSaveSettings({ voiceMode: mode });
  };

  const personalityPresets: Array<{ id: PersonalityPreset; title: string; desc: string; emoji: string }> = [
    {
      id: 'funny_friend',
      title: 'Funny Friend',
      desc: 'Witty, loyal buddy who uses classic Vadivelu punchlines and laughs with you.',
      emoji: '😄',
    },
    {
      id: 'sarcastic',
      title: 'Sarcastic & Ironic',
      desc: 'Dry sarcasm, playful roasts, and sharp counter-questions when mistakes happen.',
      emoji: '😏',
    },
    {
      id: 'normal',
      title: 'Balanced Assistant',
      desc: 'Helpful and polite with occasional tasteful comedic reactions.',
      emoji: '✨',
    },
    {
      id: 'high_energy',
      title: 'High Energy',
      desc: 'Enthusiastic celebrations, dramatic exclamations, and fast-paced quips.',
      emoji: '⚡',
    },
    {
      id: 'calm_supportive',
      title: 'Calm & Supportive',
      desc: 'Gentle, comforting warmth with comforting humor when stressed.',
      emoji: '☕',
    },
    {
      id: 'study_technical',
      title: 'Study & Technical',
      desc: 'Deep technical accuracy for coding and math, using humor only to explain tough concepts.',
      emoji: '🔬',
    },
  ];

  const totalKeys = healthStatus?.keyRotation?.totalKeys ?? 0;
  const activeKeys = healthStatus?.keyRotation?.activeKeysCount ?? 0;
  const configuredKeys = healthStatus?.keyRotation?.keys || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Settings & Preferences</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex px-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#12161f] text-xs font-medium">
          <button
            onClick={() => setActiveTab('personality')}
            className={`px-4 py-3 border-b-2 font-semibold transition ${
              activeTab === 'personality'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Personality Presets
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`px-4 py-3 border-b-2 font-semibold transition ${
              activeTab === 'voice'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Voice & Audio
          </button>
          <button
            onClick={() => setActiveTab('gemini')}
            className={`px-4 py-3 border-b-2 font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'gemini'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span>Gemini API Keys</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeKeys > 0 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-amber-100 dark:bg-amber-950 text-amber-600'
              }`}
            >
              {activeKeys} active
            </span>
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-3 border-b-2 font-semibold transition ${
              activeTab === 'preferences'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Theme & Preferences
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: Personality */}
          {activeTab === 'personality' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose the default conversational personality for new voice chats. You can also override this per conversation.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {personalityPresets.map(preset => {
                  const isSelected = localSettings.defaultPersonality === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset.id)}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition relative ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-[#12161f]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-lg">{preset.emoji}</span>
                        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">{preset.title}</h4>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{preset.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Voice & Audio */}
          {activeTab === 'voice' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Assistant Voice Tone
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['female', 'male'] as const).map(gender => (
                    <button
                      key={gender}
                      onClick={() => handleVoiceGenderSelect(gender)}
                      className={`p-3.5 rounded-2xl border text-sm font-semibold capitalize flex items-center justify-center gap-2 transition ${
                        localSettings.voiceGender === gender
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                          : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{gender === 'female' ? 'Natural Female Voice' : 'Natural Male Voice'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Voice Input Interaction Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleVoiceModeSelect('continuous')}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      localSettings.voiceMode === 'continuous'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                        : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-1">Continuous Mode (Hands-free)</div>
                    <p className="text-[11px] text-gray-400">Speaks and listens automatically with turn detection</p>
                  </button>
                  <button
                    onClick={() => handleVoiceModeSelect('push_to_talk')}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      localSettings.voiceMode === 'push_to_talk'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                        : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-1">Push-to-Talk Mode</div>
                    <p className="text-[11px] text-gray-400">Hold mic button while talking and release to submit</p>
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    <span>Speech Output Volume</span>
                    <span>{Math.round(localSettings.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={localSettings.volume}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setLocalSettings(s => ({ ...s, volume: val }));
                      onSaveSettings({ volume: val });
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    <span>Meme Audio Volume</span>
                    <span>{Math.round(localSettings.memeVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={localSettings.memeVolume}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setLocalSettings(s => ({ ...s, memeVolume: val }));
                      onSaveSettings({ memeVolume: val });
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Gemini API Keys */}
          {activeTab === 'gemini' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                      Intelligent Round-Robin Rotator Active
                    </h4>
                    <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                      Rotates requests across configured Gemini keys with quota failover and cooldown recovery.
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                    activeKeys > 0
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {activeKeys > 0 ? `${activeKeys} READY` : 'KEYS NEEDED'}
                </span>
              </div>

              {/* Add / Update Keys Form */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 space-y-3">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Configure Gemini API Keys
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Paste your Gemini API keys below (one key per line). They will be securely stored on the backend in your local <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[10px]">.env</code> and rotated round-robin:
                </p>
                <textarea
                  rows={3}
                  value={keysInput}
                  onChange={e => setKeysInput(e.target.value)}
                  placeholder="AIzaSy...\nAIzaSy...\nAIzaSy..."
                  className="w-full text-xs font-mono p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {keySaveMessage && (
                  <div
                    className={`text-xs px-3 py-2 rounded-xl flex items-center gap-2 ${
                      keySaveMessage.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    {keySaveMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{keySaveMessage.text}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveKeys}
                    disabled={isSavingKeys || !keysInput.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                  >
                    {isSavingKeys ? 'Saving...' : 'Save & Rotate Keys'}
                  </button>
                </div>
              </div>

              {/* Configured Keys List */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Configured Keys Pool ({totalKeys})
                </h4>
                {configuredKeys.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center text-xs text-gray-500">
                    No keys currently in the rotation pool. Paste your keys above or edit <code className="font-mono">.env</code>.
                  </div>
                ) : (
                  configuredKeys.map((k, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30"
                    >
                      <div className="flex items-center gap-2.5">
                        <Key className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-medium">{k.alias}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            k.status === 'healthy'
                              ? 'bg-emerald-500 animate-pulse'
                              : k.status === 'cooldown'
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                        ></span>
                        <span
                          className={`text-[11px] font-semibold uppercase ${
                            k.status === 'healthy'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : k.status === 'cooldown'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {k.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Theme & Preferences */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              {/* Light / Dark / System Theme Selection */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30 space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Appearance Theme</h4>
                  <p className="text-[11px] text-gray-400">Choose between Light, Dark, or automatic System theme</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Light Theme */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTheme('light');
                      setLocalSettings(s => ({ ...s, theme: 'light' }));
                    }}
                    className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition ${
                      themeChoice === 'light'
                        ? 'border-blue-600 bg-white dark:bg-[#121622] text-blue-600 dark:text-blue-400 ring-2 ring-blue-500 shadow-sm'
                        : 'border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-[#10141e]/60 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
                      <Sun className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Light Theme</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Creamy white surfaces</div>
                    </div>
                  </button>

                  {/* Dark Theme */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTheme('dark');
                      setLocalSettings(s => ({ ...s, theme: 'dark' }));
                    }}
                    className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition ${
                      themeChoice === 'dark'
                        ? 'border-blue-600 bg-white dark:bg-[#121622] text-blue-600 dark:text-blue-400 ring-2 ring-blue-500 shadow-sm'
                        : 'border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-[#10141e]/60 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-400 flex items-center justify-center">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Dark Theme</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Charcoal near-black</div>
                    </div>
                  </button>

                  {/* System Theme */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTheme('system');
                      setLocalSettings(s => ({ ...s, theme: 'system' }));
                    }}
                    className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition ${
                      themeChoice === 'system'
                        ? 'border-blue-600 bg-white dark:bg-[#121622] text-blue-600 dark:text-blue-400 ring-2 ring-blue-500 shadow-sm'
                        : 'border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-[#10141e]/60 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">System Default</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Follows OS theme</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30">
                <div>
                  <h4 className="text-xs font-semibold">Meme Audio Clips</h4>
                  <p className="text-[11px] text-gray-400">Play iconic audio soundbites interleaved with speech</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.memesEnabled}
                  onChange={e => {
                    const checked = e.target.checked;
                    setLocalSettings(s => ({ ...s, memesEnabled: checked }));
                    onSaveSettings({ memesEnabled: checked });
                  }}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30">
                <div>
                  <h4 className="text-xs font-semibold">Long-Term Memory Engine</h4>
                  <p className="text-[11px] text-gray-400">Extract facts and retain user preferences across chats</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.memoryEnabled}
                  onChange={e => {
                    const checked = e.target.checked;
                    setLocalSettings(s => ({ ...s, memoryEnabled: checked }));
                    onSaveSettings({ memoryEnabled: checked });
                  }}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#12161f] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium shadow-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
