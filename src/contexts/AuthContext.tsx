import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Provider, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getSafeErrorMessage } from '@/utils/userFacingErrors';

WebBrowser.maybeCompleteAuthSession();

type SignUpOptions = {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
};

type SignUpResult = {
  needsEmailConfirmation: boolean;
};

export type AuthStatus =
  | 'INITIALIZING'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'ERROR';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  authStatus: AuthStatus;
  initializationError: Error | null;
  retrySessionInitialization: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (options: SignUpOptions) => Promise<SignUpResult>;
  signInWithOAuth: (provider: Extract<Provider, 'google' | 'apple'>) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase belum dikonfigurasi. Isi konfigurasi Supabase pada environment aplikasi.',
    );
  }
}

function getOAuthRedirectUrl() {
  return Linking.createURL('auth/callback');
}

function readUrlParam(url: string, key: string) {
  const [, queryString = ''] = url.split('?');
  const [query = '', hash = ''] = queryString.split('#');
  const hashOnly = url.includes('#') ? url.split('#')[1] : hash;
  const params = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hashOnly);

  return params.get(key) ?? hashParams.get(key);
}

async function processOAuthCallback(url: string) {
  const errorDescription = readUrlParam(url, 'error_description');
  const error = readUrlParam(url, 'error');

  if (error || errorDescription) {
    throw new Error(errorDescription || error || 'Login OAuth gagal.');
  }

  const code = readUrlParam(url, 'code');

  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return;
    }

    const { data, error: sessionCheckError } =
      await supabase.auth.getSession();

    if (!sessionCheckError && data.session) {
      return;
    }

    throw exchangeError;
  }

  const accessToken = readUrlParam(url, 'access_token');
  const refreshToken = readUrlParam(url, 'refresh_token');

  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      throw sessionError;
    }

    return;
  }

  // Callback dapat terbuka ulang setelah Fast Refresh/full reload.
  const { data, error: sessionCheckError } =
    await supabase.auth.getSession();

  if (sessionCheckError) {
    throw sessionCheckError;
  }

  // User sebenarnya sudah login, jadi callback tidak perlu diproses lagi.
  if (data.session) {
    return;
  }

  throw new Error('Callback OAuth tidak berisi kode sesi yang valid.');
}

const completedOAuthCallbacks = new Set<string>();
const inFlightOAuthCallbacks = new Map<string, Promise<void>>();

async function completeOAuthCallback(url: string) {
  if (completedOAuthCallbacks.has(url)) {
    return;
  }

  const existingRequest = inFlightOAuthCallbacks.get(url);

  if (existingRequest) {
    return existingRequest;
  }

  const request = processOAuthCallback(url);
  inFlightOAuthCallbacks.set(url, request);

  try {
    await request;
    completedOAuthCallbacks.add(url);
  } finally {
    inFlightOAuthCallbacks.delete(url);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('INITIALIZING');
  const [initializationError, setInitializationError] = useState<Error | null>(null);
  const mountedRef = useRef(false);
  const initializationInFlightRef = useRef<Promise<void> | null>(null);
  const signOutInFlightRef = useRef<Promise<void> | null>(null);

  const loadSession = useCallback(async () => {
    if (initializationInFlightRef.current) {
      return initializationInFlightRef.current;
    }

    setInitializing(true);
    setAuthStatus('INITIALIZING');
    setInitializationError(null);

    const request = (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!mountedRef.current) {
          return;
        }

        setSession(data.session);
        setAuthStatus(data.session ? 'AUTHENTICATED' : 'UNAUTHENTICATED');
        setInitializing(false);
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setInitializationError(
          new Error(
            getSafeErrorMessage(
              error,
              'Sesi belum dapat dipulihkan. Silakan coba lagi.',
              'auth',
            ),
          ),
        );
        setAuthStatus('ERROR');
        setInitializing(false);
      }
    })();

    initializationInFlightRef.current = request;

    try {
      await request;
    } finally {
      if (initializationInFlightRef.current === request) {
        initializationInFlightRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mountedRef.current) {
        return;
      }

      setSession(nextSession);
      setInitializationError(null);
      setAuthStatus(nextSession ? 'AUTHENTICATED' : 'UNAUTHENTICATED');
      setInitializing(false);
    });

    void loadSession();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [loadSession]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    ensureSupabaseConfigured();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  }, []);

  const signUpWithPassword = useCallback(async ({ email, password, metadata }: SignUpOptions) => {
    ensureSupabaseConfigured();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      throw error;
    }

    return {
      needsEmailConfirmation: Boolean(data.user && !data.session),
    };
  }, []);

  const signInWithOAuth = useCallback(
    async (provider: Extract<Provider, 'google' | 'apple'>) => {
      ensureSupabaseConfigured();

      const redirectTo = getOAuthRedirectUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.url) {
        throw new Error('URL OAuth tidak tersedia dari Supabase.');
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type !== 'success') {
        throw new Error('Login dibatalkan.');
      }

      await completeOAuthCallback(result.url);
    },
    [],
  );

  const signOut = useCallback(async () => {
    ensureSupabaseConfigured();

    if (signOutInFlightRef.current) {
      return signOutInFlightRef.current;
    }

    const request = (async () => {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setSession(null);
      setAuthStatus('UNAUTHENTICATED');
    })();

    signOutInFlightRef.current = request;

    try {
      await request;
    } finally {
      if (signOutInFlightRef.current === request) {
        signOutInFlightRef.current = null;
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      authStatus,
      initializationError,
      retrySessionInitialization: loadSession,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      signOut,
    }),
    [
      authStatus,
      initializationError,
      initializing,
      loadSession,
      session,
      signInWithOAuth,
      signInWithPassword,
      signOut,
      signUpWithPassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }

  return context;
}

export { completeOAuthCallback, getOAuthRedirectUrl };
