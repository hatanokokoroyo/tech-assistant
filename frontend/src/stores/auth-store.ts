import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserInfo {
  id: number;
  username: string;
  alias_name: string | null;
  created_at: string;
}

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  setToken: (token: string) => void;
  setUser: (user: UserInfo) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => {
        set({ token: null, user: null });
        window.location.href = "/login";
      },
    }),
    {
      name: "tech-assistant-auth",
      partialize: (state) => ({ token: state.token }),
    },
  ),
);
