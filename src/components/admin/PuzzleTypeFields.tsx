'use client';

import React, { JSX, useEffect } from 'react';
import dynamic from 'next/dynamic';
// Dynamically import the advanced Escape Room Designer (client-side only)
const EscapeRoomDesigner = dynamic(() => import("@/app/escape-rooms/Designer"), { ssr: false });

interface PuzzleTypeFieldsProps {
  puzzleType: string;
  puzzleData: Record<string, unknown>;
  onDataChange: (key: string, value: unknown) => void;
}

export default function PuzzleTypeFields({ puzzleType, puzzleData, onDataChange }: PuzzleTypeFieldsProps) {
  const asString = (value: unknown, fallback = ''): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return fallback;
  };

  const asNumber = (value: unknown, fallback: number): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return fallback;
  };

  const asNumberOrEmpty = (value: unknown): number | '' => {
    if (value == null || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return '';
  };

  const asStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter((v) => typeof v === 'string') as string[];
    if (typeof value === 'string') {
      return value
        .split(/\r?\n|,/g)
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return [];
  };

  const updateValidationRule = (key: string, value: unknown) => {
    const existing = (puzzleData.validationRules && typeof puzzleData.validationRules === 'object')
      ? (puzzleData.validationRules as Record<string, unknown>)
      : {};
    onDataChange('validationRules', { ...existing, [key]: value });
  };

  const renderJigsawFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Grid Rows</label>
          <input
            type="number"
            min={2}
            max={50}
            value={asNumber(puzzleData.gridRows, 3)}
            onChange={(e) => onDataChange('gridRows', parseInt(e.target.value, 10))}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Grid Cols</label>
          <input
            type="number"
            min={2}
            max={50}
            value={asNumber(puzzleData.gridCols, 4)}
            onChange={(e) => onDataChange('gridCols', parseInt(e.target.value, 10))}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Snap Tolerance (px)</label>
        <input
          type="number"
          min={1}
          max={100}
          value={asNumber(puzzleData.snapTolerance, 12)}
          onChange={(e) => onDataChange('snapTolerance', parseInt(e.target.value, 10))}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        />
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={Boolean(puzzleData.rotationEnabled)}
          onChange={(e) => onDataChange('rotationEnabled', e.target.checked)}
          className="h-4 w-4"
        />
        Rotation Enabled
      </label>
    </div>
  );

  const renderCodeMasterFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Scenario</label>
        <textarea
          value={asString(puzzleData.scenario, '')}
          onChange={(e) => onDataChange('scenario', e.target.value)}
          placeholder="Describe the mission and what's broken"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Language</label>
          <select
            value={asString(puzzleData.language, 'html')}
            onChange={(e) => onDataChange('language', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
          >
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Validation Mode</label>
          <select
            value={asString(puzzleData.validationMode, 'exact')}
            onChange={(e) => onDataChange('validationMode', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
          >
            <option value="exact">Exact Match</option>
            <option value="contains">Must Contain</option>
            <option value="regex">Regex</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Broken Code</label>
        <textarea
          value={asString(puzzleData.brokenCode, '')}
          onChange={(e) => onDataChange('brokenCode', e.target.value)}
          placeholder="Paste the broken code"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-32 font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Prefill CSS (optional)</label>
        <textarea
          value={asString(puzzleData.prefillCss, '')}
          onChange={(e) => onDataChange('prefillCss', e.target.value)}
          placeholder="Optional CSS to prefill styles.css"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24 font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Expected Fix</label>
        <textarea
          value={asString(puzzleData.expectedFix, '')}
          onChange={(e) => onDataChange('expectedFix', e.target.value)}
          placeholder="What should the fixed code look like?"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-32 font-mono"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Must Contain (comma or newline)</label>
          <textarea
            value={asStringArray((puzzleData.validationRules as Record<string, unknown> | undefined)?.mustContain).join('\n')}
            onChange={(e) => updateValidationRule('mustContain', asStringArray(e.target.value))}
            placeholder="e.g., <nav>"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Must Not Contain (comma or newline)</label>
          <textarea
            value={asStringArray((puzzleData.validationRules as Record<string, unknown> | undefined)?.mustNotContain).join('\n')}
            onChange={(e) => updateValidationRule('mustNotContain', asStringArray(e.target.value))}
            placeholder="e.g., <center>"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Regex (optional)</label>
        <input
          type="text"
          value={asString((puzzleData.validationRules as Record<string, unknown> | undefined)?.regex, '')}
          onChange={(e) => updateValidationRule('regex', e.target.value)}
          placeholder="e.g., <nav>.*</nav>"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={Boolean((puzzleData.validationRules as Record<string, unknown> | undefined)?.ignoreCase)}
            onChange={(e) => updateValidationRule('ignoreCase', e.target.checked)}
            className="h-4 w-4"
          />
          Ignore Case
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={Boolean((puzzleData.validationRules as Record<string, unknown> | undefined)?.ignoreWhitespace)}
            onChange={(e) => updateValidationRule('ignoreWhitespace', e.target.checked)}
            className="h-4 w-4"
          />
          Ignore Whitespace
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={(puzzleData.validationRules as Record<string, unknown> | undefined)?.colorFlex !== false}
            onChange={(e) => updateValidationRule('colorFlex', e.target.checked)}
            className="h-4 w-4"
          />
          Match Color Names (e.g., blue)
        </label>
      </div>
    </div>
  );

  const renderCipherFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Cipher Type</label>
        <select
          value={asString(puzzleData.cipherType, 'caesar')}
          onChange={(e) => onDataChange('cipherType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="caesar">Caesar Cipher</option>
          <option value="atbash">Atbash Cipher</option>
          <option value="vigenere">Vigenère Cipher</option>
          <option value="substitution">Substitution Cipher</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Shift/Key (for applicable ciphers)</label>
        <input
          type="text"
          value={asString(puzzleData.key, '')}
          onChange={(e) => onDataChange('key', e.target.value)}
          placeholder="e.g., 3 for Caesar or 'SECRET' for Vigenère"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Encrypted Message</label>
        <textarea
          value={asString(puzzleData.encryptedMessage, '')}
          onChange={(e) => onDataChange('encryptedMessage', e.target.value)}
          placeholder="The encrypted message for players to solve"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
    </div>
  );

  const renderTextExtractionFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Extraction Type</label>
        <select
            value={asString(puzzleData.extractionType, 'firstLetters')}
          onChange={(e) => onDataChange('extractionType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="firstLetters">First Letters</option>
          <option value="lastLetters">Last Letters</option>
          <option value="keywords">Keywords</option>
          <option value="positions">Specific Positions</option>
          <option value="highlighted">Highlighted Words</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Source Text</label>
        <textarea
            value={asString(puzzleData.sourceText, '')}
          onChange={(e) => onDataChange('sourceText', e.target.value)}
          placeholder="The text from which players extract the answer"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Hint for Extraction (optional)</label>
        <input
          type="text"
            value={asString(puzzleData.extractionHint, '')}
          onChange={(e) => onDataChange('extractionHint', e.target.value)}
          placeholder="e.g., 'Take the first letter of each line'"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
    </div>
  );

  if (puzzleType === 'jigsaw') {
    return renderJigsawFields();
  }

  if (puzzleType === 'code_master') {
    return renderCodeMasterFields();
  }

  const renderCoordinatesFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Latitude</label>
          <input
            type="number"
            step="0.0001"
            value={asNumberOrEmpty(puzzleData.latitude)}
            onChange={(e) => onDataChange('latitude', e.target.value === '' ? undefined : parseFloat(e.target.value))}
            placeholder="e.g., 40.7128"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Longitude</label>
          <input
            type="number"
            step="0.0001"
            value={asNumberOrEmpty(puzzleData.longitude)}
            onChange={(e) => onDataChange('longitude', e.target.value === '' ? undefined : parseFloat(e.target.value))}
            placeholder="e.g., -74.0060"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Accuracy Radius (meters)</label>
        <input
          type="number"
          value={asNumber(puzzleData.radius, 100)}
          onChange={(e) => onDataChange('radius', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Location Description</label>
        <textarea
          value={asString(puzzleData.locationDescription, '')}
          onChange={(e) => onDataChange('locationDescription', e.target.value)}
          placeholder="Describe the location clues for players"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
    </div>
  );

  const renderImageAnalysisFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Analysis Type</label>
        <select
          value={asString(puzzleData.analysisType, 'hotZones')}
          onChange={(e) => onDataChange('analysisType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="hotZones">Click Hot Zones</option>
          <option value="colorDetection">Color Detection</option>
          <option value="patternMatching">Pattern Matching</option>
          <option value="hiddenElements">Hidden Elements</option>
          <option value="qrCode">QR Code/Barcode</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Analysis Instructions</label>
        <textarea
          value={asString(puzzleData.instructions, '')}
          onChange={(e) => onDataChange('instructions', e.target.value)}
          placeholder="Describe what players need to find or analyze"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Image URL</label>
        <input
          type="url"
          value={asString(puzzleData.imageUrl, '')}
          onChange={(e) => onDataChange('imageUrl', e.target.value)}
          placeholder="Upload image via media manager first"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
    </div>
  );

  const renderAudioSpectrumFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Spectrum Type</label>
        <select
          value={asString(puzzleData.spectrumType, 'frequencies')}
          onChange={(e) => onDataChange('spectrumType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="frequencies">Frequency Analysis</option>
          <option value="spectralPattern">Spectral Pattern</option>
          <option value="waveform">Waveform Analysis</option>
          <option value="hidden">Hidden Message in Audio</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Audio URL</label>
        <input
          type="url"
          value={asString(puzzleData.audioUrl, '')}
          onChange={(e) => onDataChange('audioUrl', e.target.value)}
          placeholder="Upload audio via media manager first"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Instructions</label>
        <textarea
          value={asString(puzzleData.audioInstructions, '')}
          onChange={(e) => onDataChange('audioInstructions', e.target.value)}
          placeholder="What should players listen for or analyze?"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
    </div>
  );

  const renderMorseCodeFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Morse Code Sequence</label>
        <textarea
          value={asString(puzzleData.morseSequence, '')}
          onChange={(e) => onDataChange('morseSequence', e.target.value)}
          placeholder="e.g., '.... . .-.. .-.. ---'"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Provide Reference Chart</label>
        <select
          value={asString(puzzleData.provideChart, 'yes')}
          onChange={(e) => onDataChange('provideChart', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="yes">Yes - Show Morse Code Chart</option>
          <option value="no">No - Players must know Morse Code</option>
          <option value="partial">Partial - Limited reference</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Audio Representation</label>
        <input
          type="url"
          value={asString(puzzleData.audioUrl, '')}
          onChange={(e) => onDataChange('audioUrl', e.target.value)}
          placeholder="Optional: Audio file of morse code (upload via media manager)"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
    </div>
  );

  const renderSteganographyFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Steganography Type</label>
        <select
          value={asString(puzzleData.stegoType, 'lsb')}
          onChange={(e) => onDataChange('stegoType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="lsb">Least Significant Bit (LSB)</option>
          <option value="whitespace">Whitespace Encoding</option>
          <option value="headerData">Image Header Data</option>
          <option value="frequencyDomain">Frequency Domain</option>
          <option value="colorChannels">Color Channels</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Stego Image URL</label>
        <input
          type="url"
          value={asString(puzzleData.stegoImageUrl, '')}
          onChange={(e) => onDataChange('stegoImageUrl', e.target.value)}
          placeholder="Upload image via media manager first"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Extraction Method Description</label>
        <textarea
          value={asString(puzzleData.extractionMethod, '')}
          onChange={(e) => onDataChange('extractionMethod', e.target.value)}
          placeholder="Describe how to extract the hidden data"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Tools Hint (optional)</label>
        <input
          type="text"
          value={asString(puzzleData.toolsHint, '')}
          onChange={(e) => onDataChange('toolsHint', e.target.value)}
          placeholder="e.g., 'Try using tools like Steghide or ExifTool'"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
    </div>
  );

  const renderMultiStepFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Number of Steps</label>
        <input
          type="number"
          min="2"
          max="10"
          value={asNumber(puzzleData.numSteps, 2)}
          onChange={(e) => onDataChange('numSteps', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Chain Type</label>
        <select
          value={asString(puzzleData.chainType, 'linear')}
          onChange={(e) => onDataChange('chainType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="linear">Linear - Each step leads to next</option>
          <option value="convergent">Convergent - Multiple paths to answer</option>
          <option value="branching">Branching - Different endings</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Step Descriptions</label>
        <textarea
          value={asString(puzzleData.stepDescriptions, '')}
          onChange={(e) => onDataChange('stepDescriptions', e.target.value)}
          placeholder="Describe each step separated by newlines"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Step Answers</label>
        <textarea
          value={asString(puzzleData.stepAnswers, '')}
          onChange={(e) => onDataChange('stepAnswers', e.target.value)}
          placeholder="Comma-separated answers for each step"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
    </div>
  );


  const renderMathFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Math Type</label>
        <select
          value={asString(puzzleData.mathType, 'arithmetic')}
          onChange={(e) => onDataChange('mathType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="arithmetic">Arithmetic</option>
          <option value="algebra">Algebra</option>
          <option value="geometry">Geometry</option>
          <option value="sequence">Number Sequence</option>
          <option value="probability">Probability</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Problem Statement</label>
        <textarea
          value={asString(puzzleData.problemStatement, '')}
          onChange={(e) => onDataChange('problemStatement', e.target.value)}
          placeholder="State the math problem or equation"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Show Working (optional)</label>
        <textarea
          value={asString(puzzleData.workingExample, '')}
          onChange={(e) => onDataChange('workingExample', e.target.value)}
          placeholder="Example working/solution (for hints)"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
    </div>
  );

  const renderPatternFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Pattern Type</label>
        <select
          value={asString(puzzleData.patternType, 'visual')}
          onChange={(e) => onDataChange('patternType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="visual">Visual Pattern</option>
          <option value="sequence">Sequence</option>
          <option value="grid">Grid Pattern</option>
          <option value="symbolic">Symbolic Pattern</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Pattern Description</label>
        <textarea
          value={asString(puzzleData.patternDescription, '')}
          onChange={(e) => onDataChange('patternDescription', e.target.value)}
          placeholder="Describe the pattern for players"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Pattern Image URL</label>
        <input
          type="url"
          value={asString(puzzleData.patternImageUrl, '')}
          onChange={(e) => onDataChange('patternImageUrl', e.target.value)}
          placeholder="Upload pattern image via media manager"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
    </div>
  );

  // Advanced Escape Room Designer integration
  const renderEscapeRoomFields = () => {
    // Only render the EscapeRoomDesigner, no extra wrapper or heading
    return (
      <EscapeRoomDesigner
        initialData={puzzleData}
        editId={typeof puzzleData === 'object' && puzzleData && 'editId' in puzzleData ? (puzzleData.editId as string) : undefined}
        onChange={(designerData: any) => {
          onDataChange('escapeRoomData', designerData);
          if (designerData && typeof designerData.title === 'string') {
            onDataChange('title', designerData.title);
          }
        }}
      />
    );
  };

  const typeSpecificRenders: Record<string, () => JSX.Element> = {
    cipher: renderCipherFields,
    text_extraction: renderTextExtractionFields,
    coordinates: renderCoordinatesFields,
    image_analysis: renderImageAnalysisFields,
    audio_spectrum: renderAudioSpectrumFields,
    morse_code: renderMorseCodeFields,
    steganography: renderSteganographyFields,
    multi_step: renderMultiStepFields,
    math: renderMathFields,
    pattern: renderPatternFields,
    escape_room: renderEscapeRoomFields,
  };

  const renderer = typeSpecificRenders[puzzleType];

  // For escape_room, do not wrap in config card or heading
  if (puzzleType === 'escape_room') {
    return renderer ? renderer() : null;
  }
  return (
    <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6 space-y-4">
      <h4 className="text-lg font-bold text-white mb-4">⚙️ {puzzleType.replace(/_/g, ' ').toUpperCase()} Configuration</h4>
      {renderer ? renderer() : <p className="text-gray-400">No additional configuration for this type</p>}
    </div>
  );
}
