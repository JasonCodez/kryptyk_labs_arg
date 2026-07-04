import { create } from "zustand";
import type { SlotSpinResultLike } from "@/components/puzzle/SlotMachineModal";

interface SlotModalState {
  pendingSpins: SlotSpinResultLike[] | null;
  setPendingSpins: (spins: SlotSpinResultLike[] | null) => void;
  clearPendingSpins: () => void;
}

export const useSlotModalStore = create<SlotModalState>((set) => ({
  pendingSpins: null,
  setPendingSpins: (spins) => set({ pendingSpins: spins }),
  clearPendingSpins: () => set({ pendingSpins: null }),
}));
