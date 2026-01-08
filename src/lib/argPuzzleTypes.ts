/**
 * ARG Puzzle Type Definitions
 * Defines all supported puzzle types for the ARG system
 */

export type PuzzleType = 
  | 'cipher'
  | 'image-analysis'
  | 'audio-spectrum'
  | 'text-extraction'
  | 'coordinates'
  | 'multi-step'
  | 'steganography'
  | 'morse-code';

export type CipherType = 'caesar' | 'atbash' | 'vigenere' | 'substitution';

// ===== Cipher Puzzle =====
export interface CipherPuzzleData {
  cipherType: CipherType;
  encryptedText: string;
  plainText: string;
  key?: string | number; // e.g., shift value for Caesar
  clue: string;
}

// ===== Image Analysis =====
export interface ImageAnalysisPuzzleData {
  imageUrl: string;
  hiddenText: string;
  analysisMethod: 'color-picker' | 'pixel-analysis' | 'metadata' | 'visual';
  clue: string;
}

// ===== Audio Spectrum =====
export interface AudioSpectrumPuzzleData {
  audioUrl: string;
  encodingType: 'morse-code' | 'frequency' | 'whitespace';
  decodedMessage: string;
  clue: string;
}

// ===== Text Extraction =====
export interface TextExtractionPuzzleData {
  sourceText: string;
  extractionMethod: 'first-letters' | 'hidden-words' | 'acrostic' | 'pattern';
  extractedText: string;
  clue: string;
}

// ===== Coordinates =====
export interface CoordinatePuzzleData {
  latitude: number;
  longitude: number;
  displayText?: string; // What to show players
  hint: string;
}

// ===== Multi-Step =====
export interface MultiStepPuzzleData {
  steps: {
    stepNumber: number;
    question: string;
    answer: string;
    hint?: string;
  }[];
  finalAnswer: string;
}

// ===== Steganography =====
export interface SteganographyPuzzleData {
  imageUrl: string;
  hiddenMessage: string;
  extractionMethod: 'lsb' | 'color-shift' | 'frequency';
  clue: string;
}

// ===== Morse Code =====
export interface MorseCodePuzzleData {
  morseCode: string;
  decodedMessage: string;
  speed?: number; // WPM for audio
  clue: string;
}

// Union type for all puzzle data
export type ARGPuzzleDataType =
  | CipherPuzzleData
  | ImageAnalysisPuzzleData
  | AudioSpectrumPuzzleData
  | TextExtractionPuzzleData
  | CoordinatePuzzleData
  | MultiStepPuzzleData
  | SteganographyPuzzleData
  | MorseCodePuzzleData;

// ===== Cipher Utilities =====
export const cipherFunctions = {
  caesar: {
    encrypt: (text: string, shift: number) => {
      if (!text) return '';
      return text.split('').map(char => {
        if (/[a-z]/.test(char)) {
          return String.fromCharCode((char.charCodeAt(0) - 97 + shift) % 26 + 97);
        } else if (/[A-Z]/.test(char)) {
          return String.fromCharCode((char.charCodeAt(0) - 65 + shift) % 26 + 65);
        }
        return char;
      }).join('');
    },
    decrypt: (text: string, shift: number) => {
      return cipherFunctions.caesar.encrypt(text, 26 - shift);
    },
  },
  atbash: {
    encrypt: (text: string) => {
      if (!text) return '';
      return text.split('').map(char => {
        if (/[a-z]/.test(char)) {
          return String.fromCharCode(122 - (char.charCodeAt(0) - 97));
        } else if (/[A-Z]/.test(char)) {
          return String.fromCharCode(90 - (char.charCodeAt(0) - 65));
        }
        return char;
      }).join('');
    },
    decrypt: (text: string) => cipherFunctions.atbash.encrypt(text), // Atbash is symmetric
  },
};
