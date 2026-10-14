import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types/user';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
}

function getInitialAuthState(): Pick<AuthState, 'user' | 'token' | 'isAuthenticated'> {
  if (typeof window === 'undefined') {
    return {
      user: null,
      token: null,
      isAuthenticated: false,
    };
  }

  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (!authStorage) {
      return {
        user: null,
        token: null,
        isAuthenticated: false,
      };
    }

    const parsed = JSON.parse(authStorage);
    const state = parsed?.state;
    const token = typeof state?.token === 'string' && state.token.trim() !== '' ? state.token : null;
    const user = state?.user ?? null;

    return {
      user,
      token,
      isAuthenticated: Boolean(token),
    };
  } catch {
    return {
      user: null,
      token: null,
      isAuthenticated: false,
    };
  }
}

const initialAuthState = getInitialAuthState();

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: initialAuthState.user,
      token: initialAuthState.token,
      isAuthenticated: initialAuthState.isAuthenticated,
      login: (token: string, user: User) => {
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },
      setToken: (token: string) => {
        set({ token, isAuthenticated: true, user: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
