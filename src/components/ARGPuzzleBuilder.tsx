'use client';

import { useState } from 'react';
import { PuzzleType, CipherType, CipherPuzzleData } from '@/lib/argPuzzleTypes';

interface ARGPuzzleFormData {
  title: string;
  description: string;
  puzzleType: PuzzleType;
  difficulty: 'easy' | 'medium' | 'hard';
  orderIndex: number;
  solution: string;
  hints: string[];
  puzzleData: Record<string, any>;
}

export default function ARGPuzzleBuilder({ phaseId }: { phaseId: string }) {
  const [formData, setFormData] = useState<ARGPuzzleFormData>({
    title: '',
    description: '',
    puzzleType: 'cipher',
    difficulty: 'medium',
    orderIndex: 1,
    solution: '',
    hints: [],
    puzzleData: {},
  });

  const [currentHint, setCurrentHint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'orderIndex' ? parseInt(value) : value,
    }));
  };

  const handlePuzzleDataChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      puzzleData: {
        ...prev.puzzleData,
        [key]: value,
      },
    }));
  };

  const addHint = () => {
    if (currentHint.trim()) {
      setFormData((prev) => ({
        ...prev,
        hints: [...prev.hints, currentHint],
      }));
      setCurrentHint('');
    }
  };

  const removeHint = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      hints: prev.hints.filter((_, i) => i !== index),
    }));
  };

  const renderPuzzleTypeFields = () => {
    switch (formData.puzzleType) {
      case 'cipher':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-semibold text-gray-300">Cipher Configuration</h4>
            
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Cipher Type</label>
              <select
                value={formData.puzzleData.cipherType || 'caesar'}
                onChange={(e) => handlePuzzleDataChange('cipherType', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
              >
                <option value="caesar">Caesar (Shift)</option>
                <option value="atbash">Atbash</option>
                <option value="vigenere">Vigenère</option>
                <option value="substitution">Substitution</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Plain Text (Original)</label>
              <input
                type="text"
                value={formData.puzzleData.plainText || ''}
                onChange={(e) => handlePuzzleDataChange('plainText', e.target.value)}
                placeholder="e.g., HELLO WORLD"
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Encrypted Text</label>
              <input
                type="text"
                value={formData.puzzleData.encryptedText || ''}
                onChange={(e) => handlePuzzleDataChange('encryptedText', e.target.value)}
                placeholder="e.g., KHOOR ZRUOG"
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
              />
            </div>

            {formData.puzzleData.cipherType === 'caesar' && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Shift Value</label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={formData.puzzleData.key || 3}
                  onChange={(e) => handlePuzzleDataChange('key', parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Clue for Players</label>
              <textarea
                value={formData.puzzleData.clue || ''}
                onChange={(e) => handlePuzzleDataChange('clue', e.target.value)}
                placeholder="Help players understand what they're decoding"
                rows={3}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
              />
            </div>
          </div>
        );

      case 'text-extraction':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-semibold text-gray-300">Text Extraction Configuration</h4>
            
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Extraction Method</label>
              <select
                value={formData.puzzleData.extractionMethod || 'first-letters'}
                onChange={(e) => handlePuzzleDataChange('extractionMethod', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
              >
                <option value="first-letters">First Letters</option>
                <option value="hidden-words">Hidden Words</option>
                <option value="acrostic">Acrostic</option>
                <option value="pattern">Pattern</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Source Text</label>
              <textarea
                value={formData.puzzleData.sourceText || ''}
                onChange={(e) => handlePuzzleDataChange('sourceText', e.target.value)}
                placeholder="Paste the text that contains the hidden message"
                rows={5}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Extracted Text (Answer)</label>
              <input
                type="text"
                value={formData.puzzleData.extractedText || ''}
                onChange={(e) => handlePuzzleDataChange('extractedText', e.target.value)}
                placeholder="What should be extracted"
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Clue</label>
              <textarea
                value={formData.puzzleData.clue || ''}
                onChange={(e) => handlePuzzleDataChange('clue', e.target.value)}
                placeholder="Guide players on how to extract the answer"
                rows={3}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
              />
            </div>
          </div>
        );

      case 'coordinates':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-semibold text-gray-300">Coordinates Configuration</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.puzzleData.latitude || ''}
                  onChange={(e) => handlePuzzleDataChange('latitude', parseFloat(e.target.value))}
                  placeholder="e.g., 40.7128"
                  className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.puzzleData.longitude || ''}
                  onChange={(e) => handlePuzzleDataChange('longitude', parseFloat(e.target.value))}
                  placeholder="e.g., -74.0060"
                  className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Display Text (for players)</label>
              <input
                type="text"
                value={formData.puzzleData.displayText || ''}
                onChange={(e) => handlePuzzleDataChange('displayText', e.target.value)}
                placeholder="e.g., Find the location of..."
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Hint</label>
              <textarea
                value={formData.puzzleData.hint || ''}
                onChange={(e) => handlePuzzleDataChange('hint', e.target.value)}
                placeholder="Help players find these coordinates"
                rows={3}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="text-gray-400 text-sm italic">
            Configure {formData.puzzleType} puzzle fields here
          </div>
        );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/arg/puzzles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          phaseId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create puzzle');
      }

      setMessage({ type: 'success', text: 'ARG Puzzle created successfully!' });
      setFormData({
        title: '',
        description: '',
        puzzleType: 'cipher',
        difficulty: 'medium',
        orderIndex: 1,
        solution: '',
        hints: [],
        puzzleData: {},
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'An error occurred' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">Create ARG Puzzle</h3>
        <p className="text-gray-400">Build engaging ARG puzzles for your phases</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/30 border border-green-600 text-green-200'
              : 'bg-red-900/30 border border-red-600 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-300">Basic Information</h4>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Puzzle Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., The Founder Cipher"
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="What is this puzzle about?"
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Puzzle Type *</label>
              <select
                name="puzzleType"
                value={formData.puzzleType}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
              >
                <option value="cipher">Cipher</option>
                <option value="text-extraction">Text Extraction</option>
                <option value="coordinates">Coordinates</option>
                <option value="image-analysis">Image Analysis</option>
                <option value="audio-spectrum">Audio Spectrum</option>
                <option value="morse-code">Morse Code</option>
                <option value="steganography">Steganography</option>
                <option value="multi-step">Multi-Step</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Difficulty *</label>
              <select
                name="difficulty"
                value={formData.difficulty}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Order Index</label>
            <input
              type="number"
              name="orderIndex"
              value={formData.orderIndex}
              onChange={handleInputChange}
              min="1"
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
            />
          </div>
        </div>

        {/* Puzzle Type Specific Fields */}
        {renderPuzzleTypeFields()}

        {/* Solution */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-semibold text-gray-300">Answer & Hints</h4>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Solution/Answer *</label>
            <input
              type="text"
              name="solution"
              value={formData.solution}
              onChange={handleInputChange}
              placeholder="What is the correct answer?"
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Add Hints</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={currentHint}
                onChange={(e) => setCurrentHint(e.target.value)}
                placeholder="Add a hint..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHint())}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
              />
              <button
                type="button"
                onClick={addHint}
                className="px-4 py-2 rounded-lg bg-[#3891A6] text-white hover:opacity-90 transition"
              >
                Add
              </button>
            </div>

            {formData.hints.length > 0 && (
              <div className="space-y-2">
                {formData.hints.map((hint, index) => (
                  <div key={index} className="flex justify-between items-center bg-slate-700/30 p-3 rounded-lg">
                    <span className="text-gray-300 text-sm">{hint}</span>
                    <button
                      type="button"
                      onClick={() => removeHint(index)}
                      className="text-red-400 hover:text-red-300 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-6 py-3 rounded-lg bg-[#3891A6] text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Puzzle'}
        </button>
      </form>
    </div>
  );
}
