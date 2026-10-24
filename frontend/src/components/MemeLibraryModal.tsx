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
    const audio = new Audio(meme.audioUrl || `/memes/${meme.id}.mp3`);
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
      // Ignored
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-black dark:text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black dark:text-white">Meme Library Catalog</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Iconic audio reactions orchestrated by the Reaction Director
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black rounded-xl text-xs font-semibold transition shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{showUpload ? 'Back to Library' : 'Upload Meme'}</span>
            </button>
            <button
              onClick={() => { stopAudio(); onClose(); }}
              className="p-2 text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Upload Drawer / Content */}
        {showUpload ? (
          <form onSubmit={handleUploadSubmit} className="p-6 overflow-y-auto space-y-4 bg-white dark:bg-black">
            <h3 className="text-sm font-semibold text-black dark:text-white">Register New Meme Audio Clip</h3>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Meme Title / Punchline</label>
              <input
                type="text"
                required
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                placeholder="e.g. Aahaa Oru Kodi / Enna Koduma Sir"
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Emotion Category</label>
                <select
                  value={uploadEmotion}
                  onChange={e => setUploadEmotion(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
                >
                  <option value="shock">Shock / Astonishment</option>
                  <option value="irony">Irony / Sarcasm</option>
                  <option value="celebration">Celebration / Victory</option>
                  <option value="awkward">Awkward / Disbelief</option>
                  <option value="comedy">Laughter / Pure Comedy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={e => setUploadTags(e.target.value)}
                  placeholder="vadivelu, comedy, classic"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Context Prompt Hint</label>
              <input
                type="text"
                value={uploadHint}
                onChange={e => setUploadHint(e.target.value)}
                placeholder="When the AI recognizes unexpected surprise or funny defeat"
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Audio File (MP3 / WAV)</label>
              <input
                type="file"
                accept="audio/*"
                required
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-neutral-200 dark:file:bg-neutral-800 file:text-black dark:file:text-white hover:file:opacity-90"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="px-4 py-2 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black disabled:opacity-40 rounded-xl text-xs font-semibold transition"
              >
                {isUploading ? 'Uploading...' : 'Save & Register Meme'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Filter and Search Bar */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center gap-3 bg-white dark:bg-black">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search memes by title or tags..."
                  className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
                />
              </div>

              {/* Emotion pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {emotions.map(emotion => (
                  <button
                    key={emotion}
                    onClick={() => setSelectedEmotion(emotion)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                      selectedEmotion === emotion
                        ? 'bg-black text-white dark:bg-white dark:text-black'
                        : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {emotion}
                  </button>
                ))}
              </div>
            </div>

            {/* Meme Grid / List */}
            <div className="overflow-y-auto p-4 space-y-2.5 flex-1 bg-white dark:bg-black">
              {loading ? (
                <div className="text-center py-12 text-sm text-neutral-400">Loading catalog...</div>
              ) : filteredMemes.length === 0 ? (
                <div className="text-center py-12 text-sm text-neutral-400">No matching memes found.</div>
              ) : (
                filteredMemes.map(meme => {
                  const isPlaying = playingMemeId === meme.id;
                  return (
                    <div
                      key={meme.id}
                      onClick={() => onSelectMeme?.(meme)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition cursor-pointer ${
                        isPlaying
                          ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-900'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 hover:border-neutral-300 dark:hover:border-neutral-700'
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
                              ? 'bg-black text-white dark:bg-white dark:text-black shadow-md'
                              : 'bg-white dark:bg-neutral-900 text-black dark:text-white border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                          }`}
                        >
                          {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </button>

                        {/* Thumbnail if available */}
                        {meme.thumbnailUrl && (
                          <img
                            src={meme.thumbnailUrl}
                            alt={meme.title}
                            className="w-10 h-10 rounded-xl object-cover border border-neutral-300 dark:border-neutral-700 shrink-0"
                          />
                        )}

                        {/* Title & Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-black dark:text-white truncate">{meme.title}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wide bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white">
                              {meme.emotion}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                            {meme.contextHint || meme.tags.join(', ')}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1">
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
                              ? 'text-black dark:text-white bg-neutral-200 dark:bg-neutral-800'
                              : 'text-neutral-400 hover:text-black dark:hover:text-white'
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
        <div className="px-6 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>Total catalog: {memes.length} iconic clips</span>
          <span>Automatic cooldown prevents repetitive audio playback</span>
        </div>
      </div>
    </div>
  );
};
