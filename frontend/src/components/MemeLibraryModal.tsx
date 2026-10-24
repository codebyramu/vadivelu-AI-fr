import React, { useState, useEffect } from 'react';
import { X, Play, Square, Star, Upload, Search, Music, Clock, Tag } from 'lucide-react';
import { MemeMetadata } from '../types';
import { api } from '../services/api';

interface MemeLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMeme?: (meme: MemeMetadata) => void;
}

export const MemeLibraryModal: React.FC<MemeLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectMeme,
}) => {
  const [memes, setMemes] = useState<MemeMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('all');
  const [playingMemeId, setPlayingMemeId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  
  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadEmotion, setUploadEmotion] = useState('shock');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadHint, setUploadHint] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMemes();
    } else {
      stopAudio();
    }
  }, [isOpen]);

  const loadMemes = async () => {
    setLoading(true);
    try {
      const data = await api.getMemes();
      setMemes(data);
    } finally {
      setLoading(false);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingMemeId(null);
  };

  const handlePlayPreview = (meme: MemeMetadata) => {
    if (playingMemeId === meme.id) {
      stopAudio();
      return;
    }

    stopAudio();
    const audio = new Audio(meme.audioUrl || `/audio/memes/${meme.id}.mp3`);
    audio.onended = () => setPlayingMemeId(null);
    audio.onerror = () => setPlayingMemeId(null);
    audioRef.current = audio;
    setPlayingMemeId(meme.id);
    audio.play().catch(() => setPlayingMemeId(null));
  };

  const handleToggleFavorite = async (meme: MemeMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextFavorite = !meme.isFavorite;
    setMemes(prev => prev.map(m => m.id === meme.id ? { ...m, isFavorite: nextFavorite } : m));
    await api.updateMeme(meme.id, { isFavorite: nextFavorite });
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', uploadTitle);
      formData.append('emotion', uploadEmotion);
      formData.append('tags', uploadTags);
      formData.append('contextHint', uploadHint);
      formData.append('file', uploadFile);

      const newMeme = await api.uploadMeme(formData);
      setMemes(prev => [newMeme, ...prev]);
      setShowUpload(false);
      setUploadTitle('');
      setUploadFile(null);
      setUploadTags('');
      setUploadHint('');
    } catch {
      // Mock add
      const fallbackMeme: MemeMetadata = {
        id: `meme-${Date.now()}`,
        title: uploadTitle,
        filePath: uploadFile.name,
        audioUrl: URL.createObjectURL(uploadFile),
        durationMs: 2000,
        tags: uploadTags.split(',').map(s => s.trim()).filter(Boolean),
        emotion: uploadEmotion,
        contextHint: uploadHint,
        cooldownSeconds: 20,
        useCount: 0,
        isFavorite: false,
      };
      setMemes(prev => [fallbackMeme, ...prev]);
      setShowUpload(false);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const emotions = ['all', 'shock', 'irony', 'celebration', 'awkward', 'comedy'];

  const filteredMemes = memes.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase()) ||
                          m.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesEmotion = selectedEmotion === 'all' || m.emotion.toLowerCase() === selectedEmotion.toLowerCase();
    return matchesSearch && matchesEmotion;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-gray-900 dark:text-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-100 dark:bg-pink-950/70 text-pink-600 dark:text-pink-400 flex items-center justify-center">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Meme Library Catalog</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Iconic audio reactions orchestrated by the Reaction Director
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{showUpload ? 'Back to Library' : 'Upload Meme'}</span>
            </button>
            <button
              onClick={() => { stopAudio(); onClose(); }}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Upload Drawer / Content */}
        {showUpload ? (
          <form onSubmit={handleUploadSubmit} className="p-6 overflow-y-auto space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Register New Meme Audio Clip</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Meme Title / Punchline</label>
              <input
                type="text"
                required
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                placeholder="e.g. Aahaa Oru Kodi / Enna Koduma Sir"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Emotion Category</label>
                <select
                  value={uploadEmotion}
                  onChange={e => setUploadEmotion(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-blue-500"
                >
                  <option value="shock">Shock / Astonishment</option>
                  <option value="irony">Irony / Sarcasm</option>
                  <option value="celebration">Celebration / Victory</option>
                  <option value="awkward">Awkward / Disbelief</option>
                  <option value="comedy">Laughter / Pure Comedy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={e => setUploadTags(e.target.value)}
                  placeholder="vadivelu, money, classic"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Context Prompt Hint</label>
              <input
                type="text"
                value={uploadHint}
                onChange={e => setUploadHint(e.target.value)}
                placeholder="When the AI recognizes unexpected news or sudden failure"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Audio File (MP3 / WAV)</label>
              <input
                type="file"
                accept="audio/*"
                required
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/50 file:text-blue-600 dark:file:text-blue-400 hover:file:bg-blue-100"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition"
              >
                {isUploading ? 'Uploading...' : 'Save & Register Meme'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Filter and Search Bar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search memes by title or tags..."
                  className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:border-blue-500"
                />
              </div>

              {/* Emotion pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {emotions.map(emotion => (
                  <button
                    key={emotion}
                    onClick={() => setSelectedEmotion(emotion)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition ${
                      selectedEmotion === emotion
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {emotion}
                  </button>
                ))}
              </div>
            </div>

            {/* Meme Grid / List */}
            <div className="overflow-y-auto p-4 space-y-2.5 flex-1">
              {loading ? (
                <div className="text-center py-12 text-sm text-gray-400">Loading catalog...</div>
              ) : filteredMemes.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400">No matching memes found.</div>
              ) : (
                filteredMemes.map(meme => {
                  const isPlaying = playingMemeId === meme.id;
                  return (
                    <div
                      key={meme.id}
                      onClick={() => onSelectMeme?.(meme)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition ${
                        isPlaying
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                          : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Play button */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handlePlayPreview(meme);
                          }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                            isPlaying
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600'
                          }`}
                        >
                          {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </button>

                        {/* Thumbnail if available */}
                        {meme.thumbnailUrl && (
                          <img
                            src={meme.thumbnailUrl}
                            alt={meme.title}
                            className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                          />
                        )}

                        {/* Title & Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{meme.title}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                              {meme.emotion}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {meme.contextHint || meme.tags.join(', ')}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {(meme.durationMs / 1000).toFixed(1)}s
                            </span>
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3" /> {meme.tags.slice(0, 3).join(', ')}
                            </span>
                            <span>Used {meme.useCount}x</span>
                          </div>
                        </div>
                      </div>

                      {/* Right actions */}
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <button
                          onClick={e => handleToggleFavorite(meme, e)}
                          className={`p-2 rounded-xl transition ${
                            meme.isFavorite
                              ? 'text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/30'
                              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${meme.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#12161f] flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Total catalog: {memes.length} iconic clips</span>
          <span>Automatic cooldown prevents repetitive audio playback</span>
        </div>
      </div>
    </div>
  );
};
