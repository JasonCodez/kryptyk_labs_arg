// Core types for puzzle system

export type PuzzleType = 'jigsaw' | 'story' | 'sudoku';

export interface PuzzleBase {
  id: string;
  title: string;
  description: string;
  type: PuzzleType;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  pointsReward: number;
}

// Jigsaw Puzzle Types
export interface JigsawPuzzle extends PuzzleBase {
  type: 'jigsaw';
  imageUrl: string;
  pieceCount: number;
  aspectRatio: number; // width/height
  data: JigsawPuzzleData;
}

export interface JigsawPuzzleData {
  imageUrl: string;
  pieceCount: number;
  gridRows: number;
  gridCols: number;
  rotationEnabled: boolean;
  snapTolerance: number; // pixels
  timeLimit?: number; // seconds, optional
}

export interface JigsawPiece {
  id: string;
  row: number;
  col: number;
  x: number; // current x position
  y: number; // current y position
  rotation: number; // in radians
  isPlaced: boolean;
  texture: PIXI.Texture;
}

// Story Puzzle Types
export interface StoryPuzzle extends PuzzleBase {
  type: 'story';
  scenes: StoryScene[];
  startSceneId: string;
  data: StoryPuzzleData;
}

// Sudoku Puzzle Types
export interface SudokuPuzzle extends PuzzleBase {
  type: 'sudoku';
  // 9x9 grid, 0 = empty
  puzzleGrid: number[][];
  solutionGrid: number[][];
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' | 'extreme';
}

export interface StoryPuzzleData {
  scenes: StorySceneData[];
  startSceneId: string;
}

export interface StoryScene {
  id: string;
  title: string;
  backgroundImage?: string;
  characters: StoryCharacter[];
  choices: StoryChoice[];
  narrative: string;
  animations: SceneAnimation[];
}

export interface StorySceneData {
  id: string;
  title: string;
  backgroundImage?: string;
  characters: StoryCharacterData[];
  choices: StoryChoiceData[];
  narrative: string;
  animations: SceneAnimationData[];
}

export interface StoryCharacter {
  id: string;
  name: string;
  imageUrl: string;
  x: number;
  y: number;
  scale: number;
  animation?: string;
}

export interface StoryCharacterData {
  id: string;
  name: string;
  imageUrl: string;
  x: number;
  y: number;
  scale: number;
  animation?: string;
}

export interface StoryChoice {
  id: string;
  text: string;
  nextSceneId: string;
  prerequisite?: string; // condition to show this choice
}

export interface StoryChoiceData {
  id: string;
  text: string;
  nextSceneId: string;
  prerequisite?: string;
}

export interface SceneAnimation {
  targetId: string; // character or background id
  animationType: 'fade' | 'slide' | 'scale' | 'bounce' | 'custom';
  duration: number; // milliseconds
  delay: number; // milliseconds
  properties: Record<string, any>;
}

export interface SceneAnimationData {
  targetId: string;
  animationType: 'fade' | 'slide' | 'scale' | 'bounce' | 'custom';
  duration: number;
  delay: number;
  properties: Record<string, any>;
}

export interface PuzzleProgress {
  userId: string;
  puzzleId: string;
  startedAt: Date;
  completedAt?: Date;
  solved: boolean;
  attempts: number;
  timeSpent: number; // seconds
  progress: Record<string, any>; // puzzle-specific progress data
}

// Import PIXI types
import * as PIXI from 'pixi.js';
