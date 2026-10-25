import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  ShieldCheck,
  Key,
  Volume2,
  Sparkles,
  UserCheck,
  Sun,
  Moon,
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
    } catch {
      // Ignored
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
      desc: 'Analytical, code-focused, and detail-oriented with smart comedic timing.',
      emoji: '🔬',
    },
  ];

  const totalKeys = healthStatus?.keyRotation?.totalKeys ?? 0;
  const activeKeys = healthStatus?.keyRotation?.activeKeysCount ?? 0;
  const configuredKeys = healthStatus?.keyRotation?.keys || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-black dark:text-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-black">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
            <h2 className="text-base font-semibold text-black dark:text-white">Settings & Preferences</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-black dark:hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-xs font-medium">
          <button
            onClick={() => setActiveTab('personality')}
            className={`px-4 py-3 border-b-2 font-semibold transition ${
              activeTab === 'personality'
                ? 'border-black text-black dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Personality Presets
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`px-4 py-3 border-b-2 font-semibold transition ${
              activeTab === 'voice'
                ? 'border-black text-black dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Voice & Audio
          </button>
          <button
            onClick={() => setActiveTab('gemini')}
            className={`px-4 py-3 border-b-2 font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'gemini'
                ? 'border-black text-black dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <span>Gemini API Keys</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeKeys > 0
                  ? 'bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border border-neutral-300 dark:border-neutral-700'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {activeKeys} active
            </span>
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-3 border-b-2 font-semibold transition ${
              activeTab === 'preferences'
                ? 'border-black text-black dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Theme & Preferences
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-white dark:bg-black">
          {/* TAB 1: Personality */}
          {activeTab === 'personality' && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
                          ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white ring-1 ring-black dark:ring-white'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-black text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-lg">{preset.emoji}</span>
                        <h4 className="text-xs font-semibold">{preset.title}</h4>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">{preset.desc}</p>
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                  Assistant Voice Tone
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['female', 'male'] as const).map(gender => {
                    const isSelected = localSettings.voiceGender === gender;
                    return (
                      <button
                        key={gender}
                        onClick={() => handleVoiceGenderSelect(gender)}
                        className={`p-3.5 rounded-2xl border text-sm font-semibold capitalize flex items-center justify-center gap-2 transition ${
                          isSelected
                            ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white ring-1 ring-black dark:ring-white'
                            : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-black'
                        }`}
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>{gender === 'female' ? 'Natural Female Voice' : 'Natural Male Voice'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                  Voice Input Interaction Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleVoiceModeSelect('continuous')}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      localSettings.voiceMode === 'continuous'
                        ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white ring-1 ring-black dark:ring-white'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-black'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-1">Continuous Mode (Hands-free)</div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Speaks and listens automatically with turn detection</p>
                  </button>
                  <button
                    onClick={() => handleVoiceModeSelect('push_to_talk')}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      localSettings.voiceMode === 'push_to_talk'
                        ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white ring-1 ring-black dark:ring-white'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-black'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-1">Push-to-Talk Mode</div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Hold mic button while talking and release to submit</p>
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="flex justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
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
                    className="w-full accent-black dark:accent-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
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
                    className="w-full accent-black dark:accent-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Gemini API Keys */}
          {activeTab === 'gemini' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-black dark:text-white shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-black dark:text-white">
                      Intelligent Round-Robin Rotator Active
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Rotates requests across configured Gemini keys with quota failover and cooldown recovery.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white border border-neutral-300 dark:border-neutral-700">
                  {activeKeys > 0 ? `${activeKeys} READY` : 'KEYS NEEDED'}
                </span>
              </div>

              {/* Add / Update Keys Form */}
              <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-3">
                <label className="block text-xs font-semibold text-black dark:text-white">
                  Configure Gemini API Keys
                </label>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Paste your Gemini API keys below (one key per line). They will be securely stored on the backend in your local <code className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">.env</code> and rotated round-robin:
                </p>
                <textarea
                  rows={3}
                  value={keysInput}
                  onChange={e => setKeysInput(e.target.value)}
                  placeholder="AIzaSy...&#10;AIzaSy..."
                  className="w-full text-xs font-mono p-3 rounded-xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />

                {keySaveMessage && (
                  <div
                    className={`text-xs px-3 py-2 rounded-xl flex items-center gap-2 ${
                      keySaveMessage.type === 'success'
                        ? 'bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border border-neutral-300 dark:border-neutral-700'
                        : 'bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border border-neutral-300 dark:border-neutral-700'
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
                    className="px-4 py-2 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black disabled:opacity-40 text-xs font-semibold rounded-xl transition"
                  >
                    {isSavingKeys ? 'Saving...' : 'Save & Rotate Keys'}
                  </button>
                </div>
              </div>

              {/* Configured Keys List */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Configured Keys Pool ({totalKeys})
                </h4>
                {configuredKeys.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 text-center text-xs text-neutral-500">
                    No keys currently in the rotation pool. Paste your keys above or edit <code className="font-mono">.env</code>.
                  </div>
                ) : (
                  configuredKeys.map((k, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                    >
                      <div className="flex items-center gap-2.5">
                        <Key className="w-4 h-4 text-neutral-400" />
                        <span className="text-xs font-medium">{k.alias}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            k.status === 'healthy'
                              ? 'bg-white'
                              : 'bg-neutral-500'
                          }`}
                        ></span>
                        <span className="text-[11px] font-semibold uppercase text-neutral-700 dark:text-neutral-300">
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
              <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-black dark:text-white">Appearance Theme</h4>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Choose between Pure White, Full Black, or automatic System theme</p>
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
                        ? 'border-black dark:border-white bg-white dark:bg-neutral-900 text-black dark:text-white ring-1 ring-black dark:ring-white shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center">
                      <Sun className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Light Theme</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">Pure white & dark</div>
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
                        ? 'border-black dark:border-white bg-white dark:bg-neutral-900 text-black dark:text-white ring-1 ring-black dark:ring-white shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Dark Theme</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">Full black & white</div>
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
                        ? 'border-black dark:border-white bg-white dark:bg-neutral-900 text-black dark:text-white ring-1 ring-black dark:ring-white shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">System Default</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">Follows OS theme</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                <div>
                  <h4 className="text-xs font-semibold text-black dark:text-white">Meme Audio Clips</h4>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Play iconic audio soundbites interleaved with speech</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !localSettings.memesEnabled;
                    setLocalSettings(s => ({ ...s, memesEnabled: next }));
                    onSaveSettings({ memesEnabled: next });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out relative flex items-center p-0.5 cursor-pointer ${
                    localSettings.memesEnabled
                      ? 'bg-black dark:bg-white'
                      : 'bg-neutral-300 dark:bg-neutral-700'
                  }`}
                  role="switch"
                  aria-checked={localSettings.memesEnabled}
                >
                  <span
                    className={`w-5 h-5 rounded-full transition-transform duration-200 ease-out shadow-sm ${
                      localSettings.memesEnabled
                        ? 'translate-x-5 bg-white dark:bg-black'
                        : 'translate-x-0 bg-white dark:bg-neutral-400'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                <div>
                  <h4 className="text-xs font-semibold text-black dark:text-white">Long-Term Memory Engine</h4>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Extract facts and retain user preferences across chats</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !localSettings.memoryEnabled;
                    setLocalSettings(s => ({ ...s, memoryEnabled: next }));
                    onSaveSettings({ memoryEnabled: next });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out relative flex items-center p-0.5 cursor-pointer ${
                    localSettings.memoryEnabled
                      ? 'bg-black dark:bg-white'
                      : 'bg-neutral-300 dark:bg-neutral-700'
                  }`}
                  role="switch"
                  aria-checked={localSettings.memoryEnabled}
                >
                  <span
                    className={`w-5 h-5 rounded-full transition-transform duration-200 ease-out shadow-sm ${
                      localSettings.memoryEnabled
                        ? 'translate-x-5 bg-white dark:bg-black'
                        : 'translate-x-0 bg-white dark:bg-neutral-400'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black rounded-xl text-xs font-semibold shadow-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
