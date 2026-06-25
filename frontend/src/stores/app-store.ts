import { create } from "zustand";

/** 右栏激活内容 — 与当前 tab 解耦，仅在用户点击具体文件/对话时才切换 */
export type ActiveContent =
  | { type: "file"; projectId: number; filePath: string }
  | { type: "conversation"; projectId: number; conversationId: number };

interface AppState {
  selectedProjectId: number | null;
  activeContent: ActiveContent | null;
  setSelectedProjectId: (id: number | null) => void;
  setActiveContent: (content: ActiveContent | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  selectedProjectId: null,
  activeContent: null,
  /** 切换项目时同时清空右栏内容 */
  setSelectedProjectId: (id) =>
    set({ selectedProjectId: id, activeContent: null }),
  setActiveContent: (content) => set({ activeContent: content }),
}));
