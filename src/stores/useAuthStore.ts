/**
 * Auth store — JWT lives in memory only (never localStorage).
 * Cleared on page refresh — intentional security behaviour.
 */
import { create } from 'zustand';

interface AuthState {
  token: string | null;
  expiresAt: string | null;
  setAuth: (token: string, expiresAt: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token:     null,
  expiresAt: null,
  setAuth:   (token, expiresAt) => set({ token, expiresAt }),
  clearAuth: () => set({ token: null, expiresAt: null }),
}));
