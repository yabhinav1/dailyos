import { create } from "zustand";

interface CommandPaletteState {
  isOpen: boolean;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  isOpen: false,
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
}));
