import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Provider, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type SignUpOptions = {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
};

type SignUpResult = {
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (options: SignUpOptions) => Promise<SignUpResult>;
  signInWithOAuth: (provider: Extract<Provider, 'google' | 'apple'>) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase belum dikonfigurasi. Isi EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_ANON_KEY di file .env.'
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

async function completeOAuthCallback(url: string) {
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

    const { data } = await supabase.auth.getSession();

    if (data.session) {
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setInitializing(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
    []
  );

  const signOut = useCallback(async () => {
    ensureSupabaseConfigured();

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      signOut,
    }),
    [
      initializing,
      session,
      signInWithOAuth,
      signInWithPassword,
      signOut,
      signUpWithPassword,
    ]
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
