import React, { useState, useEffect } from 'react';
import { X, Settings, Key, Volume2, Mic, UserCheck, Sparkles, Moon, Sun, ShieldCheck } from 'lucide-react';
import { UserSettings, PersonalityPreset, VoiceGender } from '../types';
import { api, HealthStatus } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (settings: Partial<UserSettings>) => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  isDarkTheme,
  onToggleTheme,
}) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'personality' | 'voice' | 'gemini' | 'preferences'>('personality');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      api.getHealth().then(setHealthStatus).catch(() => {});
    }
  }, [isOpen]);

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

  const handleMemeFrequencySelect = (freq: 'low' | 'normal' | 'high') => {
    const updated = { ...localSettings, memeFrequency: freq };
    setLocalSettings(updated);
    onSaveSettings({ memeFrequency: freq });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-gray-900 dark:text-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Settings & Configuration</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Customize Gemini intelligence, personality presets, and voice audio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-gray-200 dark:border-gray-800 gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('personality')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'personality'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Personality Presets
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'voice'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Voice & Audio
          </button>
          <button
            onClick={() => setActiveTab('gemini')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'gemini'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Gemini Rotator Status
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'preferences'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Theme & Options
          </button>
        </div>

        {/* Tab Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* TAB 1: Personality */}
          {activeTab === 'personality' && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Choose AI Persona
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {personalityPresets.map(preset => {
                  const isSelected = localSettings.defaultPersonality === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset.id)}
                      className={`p-4 rounded-2xl text-left border transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-blue-500'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/40 dark:bg-gray-800/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{preset.emoji}</span>
                        <span className="text-sm font-semibold">{preset.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {preset.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Meme Frequency */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Meme Reaction Frequency
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['low', 'normal', 'high'] as const).map(freq => (
                    <button
                      key={freq}
                      onClick={() => handleMemeFrequencySelect(freq)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium capitalize border transition ${
                        localSettings.memeFrequency === freq
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {freq === 'low' && 'Subtle (Low)'}
                      {freq === 'normal' && 'Standard (Balanced)'}
                      {freq === 'high' && 'Vibrant (High)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Voice & Audio */}
          {activeTab === 'voice' && (
            <div className="space-y-5">
              {/* Voice Gender */}
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

              {/* Voice Input Mode */}
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
                    <p className="text-[11px] text-gray-400">Speaks and listens automatically with silence detection</p>
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

              {/* Volume Sliders */}
              <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    <span>Speech Volume</span>
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

          {/* TAB 3: Gemini Status */}
          {activeTab === 'gemini' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                      Multi-Key Intelligent Rotator Active
                    </h4>
                    <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                      Distributes requests round-robin across Gemini 2.5 Flash keys with quota failover.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                  {healthStatus?.status || 'HEALTHY'}
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Active Keys Pool ({healthStatus?.totalKeys ?? 2} Configured)
                </h4>
                {(healthStatus?.keysStatus || [
                  { alias: 'Key-1 (Gemini 2.5 Flash)', status: 'healthy', consecutiveFailures: 0 },
                  { alias: 'Key-2 (Gemini 1.5 Flash)', status: 'healthy', consecutiveFailures: 0 },
                ]).map((k, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <Key className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-medium">{k.alias}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                        {k.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Theme & Preferences */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30">
                <div>
                  <h4 className="text-xs font-semibold">Appearance Theme</h4>
                  <p className="text-[11px] text-gray-400">Toggle between Apple Light and Dark space themes</p>
                </div>
                <button
                  onClick={onToggleTheme}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium transition"
                >
                  {isDarkTheme ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                  <span>{isDarkTheme ? 'Dark' : 'Light'}</span>
                </button>
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
