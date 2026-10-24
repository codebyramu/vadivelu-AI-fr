import React, { useState, useEffect } from 'react';
import { X, Database, Plus, Trash2, Edit3, Check, Brain, AlertTriangle } from 'lucide-react';
import { MemoryItem } from '../types';
import { api } from '../services/api';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({ isOpen, onClose }) => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newContent, setNewContent] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMemories();
    }
  }, [isOpen]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const data = await api.getMemories();
      setMemories(data);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (item: MemoryItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  const handleSaveEdit = async (item: MemoryItem) => {
    if (!editContent.trim()) return;
    setMemories(prev => prev.map(m => m.id === item.id ? { ...m, content: editContent } : m));
    setEditingId(null);
    await api.updateMemory(item.id, { content: editContent });
  };

  const handleDelete = async (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
    await api.deleteMemory(id);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newContent.trim()) return;

    try {
      const created = await api.addMemory({ key: newKey.trim(), content: newContent.trim() });
      setMemories(prev => [created, ...prev]);
      setNewKey('');
      setNewContent('');
      setShowAddForm(false);
    } catch {
      // Handled
    }
  };

  const handleClearAll = async () => {
    await api.clearMemories();
    setMemories([]);
    setShowClearConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-gray-900 dark:text-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Memory Management</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Facts and preferences remembered across all conversations
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

        {/* Action bar */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">
            {memories.length} remembered {memories.length === 1 ? 'item' : 'items'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Cancel' : 'Add Memory'}</span>
            </button>
            {memories.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl text-xs font-medium transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Clear Confirmation Banner */}
        {showClearConfirm && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Delete all memories permanently? This cannot be undone.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-white/50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        )}

        {/* Add Memory Form */}
        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Add User Fact / Memory</h4>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Key (e.g. favorite_tea)"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                required
                placeholder="Fact content (e.g. Prefers Masala Chai with ginger, no sugar)"
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                className="col-span-2 px-3 py-2 text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-sm"
              >
                Save Memory
              </button>
            </div>
          </form>
        )}

        {/* Memories List */}
        <div className="overflow-y-auto p-6 space-y-3 flex-1">
          {loading ? (
            <div className="text-center py-12 text-sm text-gray-400">Loading memories...</div>
          ) : memories.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Database className="w-8 h-8 text-gray-400 mx-auto opacity-50" />
              <p className="text-sm font-medium text-gray-500">No active memories stored</p>
              <p className="text-xs text-gray-400">Vadivelu AI will automatically extract and save facts as you chat.</p>
            </div>
          ) : (
            memories.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 hover:border-gray-200 dark:hover:border-gray-700 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-bold tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 mb-1.5">
                      {item.key}
                    </span>

                    {editingId === item.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-900 border border-emerald-500 outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(item)}
                          className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-normal">
                        {item.content}
                      </p>
                    )}

                    <div className="text-[10px] text-gray-400 mt-2">
                      Saved {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-lg transition"
                      title="Edit memory"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                      title="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#12161f] text-xs text-gray-400 text-center">
          Vadivelu AI injects relevant memories into context to deliver deeply personalized humor and answers.
        </div>
      </div>
    </div>
  );
};
