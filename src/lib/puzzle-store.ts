import { create } from 'zustand';
import { JigsawPuzzle, StoryPuzzle, PuzzleType } from './puzzle-types';

interface PuzzleStore {
  // Current puzzle state
  currentPuzzle: JigsawPuzzle | StoryPuzzle | null;
  puzzleType: PuzzleType | null;
  
  // Progress tracking
  isCompleted: boolean;
  startTime: number | null;
  endTime: number | null;
  
  // Jigsaw-specific
  placedPieces: Set<string>;
  
  // Story-specific
  currentSceneId: string | null;
  visitedScenes: Set<string>;
  choices: Record<string, string>; // sceneId -> choiceId
  
  // Actions
  setPuzzle: (puzzle: JigsawPuzzle | StoryPuzzle, type: PuzzleType) => void;
  clearPuzzle: () => void;
  startPuzzle: () => void;
  completePuzzle: () => void;
  
  // Jigsaw actions
  addPlacedPiece: (pieceId: string) => void;
  removePlacedPiece: (pieceId: string) => void;
  checkJigsawComplete: (totalPieces: number) => boolean;
  
  // Story actions
  setCurrentScene: (sceneId: string) => void;
  recordChoice: (sceneId: string, choiceId: string) => void;
  markSceneVisited: (sceneId: string) => void;
}

export const usePuzzleStore = create<PuzzleStore>((set, get) => ({
  currentPuzzle: null,
  puzzleType: null,
  isCompleted: false,
  startTime: null,
  endTime: null,
  placedPieces: new Set(),
  currentSceneId: null,
  visitedScenes: new Set(),
  choices: {},
  
  setPuzzle: (puzzle, type) => set({
    currentPuzzle: puzzle,
    puzzleType: type,
    isCompleted: false,
    startTime: null,
    endTime: null,
    placedPieces: new Set(),
    currentSceneId: type === 'story' ? (puzzle as StoryPuzzle).startSceneId : null,
    visitedScenes: type === 'story' ? new Set([(puzzle as StoryPuzzle).startSceneId]) : new Set(),
    choices: {},
  }),
  
  clearPuzzle: () => set({
    currentPuzzle: null,
    puzzleType: null,
    isCompleted: false,
    startTime: null,
    endTime: null,
    placedPieces: new Set(),
    currentSceneId: null,
    visitedScenes: new Set(),
    choices: {},
  }),
  
  startPuzzle: () => set({ startTime: Date.now() }),
  
  completePuzzle: () => set({ 
    isCompleted: true,
    endTime: Date.now(),
  }),
  
  // Jigsaw actions
  addPlacedPiece: (pieceId) => set((state) => ({
    placedPieces: new Set(state.placedPieces).add(pieceId),
  })),
  
  removePlacedPiece: (pieceId) => set((state) => {
    const newSet = new Set(state.placedPieces);
    newSet.delete(pieceId);
    return { placedPieces: newSet };
  }),
  
  checkJigsawComplete: (totalPieces) => {
    const state = get();
    return state.placedPieces.size === totalPieces;
  },
  
  // Story actions
  setCurrentScene: (sceneId) => set((state) => ({
    currentSceneId: sceneId,
    visitedScenes: new Set(state.visitedScenes).add(sceneId),
  })),
  
  recordChoice: (sceneId, choiceId) => set((state) => ({
    choices: {
      ...state.choices,
      [sceneId]: choiceId,
    },
  })),
  
  markSceneVisited: (sceneId) => set((state) => ({
    visitedScenes: new Set(state.visitedScenes).add(sceneId),
  })),
}));
