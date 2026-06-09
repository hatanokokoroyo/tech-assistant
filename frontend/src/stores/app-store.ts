import { create } from "zustand";

interface AppState {
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  selectedProjectId: null,
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
}));
