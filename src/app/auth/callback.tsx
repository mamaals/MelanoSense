import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  completeOAuthCallback,
  getOAuthRedirectUrl,
  useAuth,
} from '@/contexts/AuthContext';
import { getSafeErrorMessage } from '@/utils/userFacingErrors';
import Button from '@/components/Button';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackPage() {
  const params = useLocalSearchParams();
  const { session, initializing } = useAuth();
  const handledRef = useRef(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  const code = firstParam(params.code);
  const error = firstParam(params.error);
  const errorDescription = firstParam(params.error_description);
  const hasCallbackData = Boolean(code || error || errorDescription);

  useEffect(() => {
    let cancelled = false;

    if (initializing || handledRef.current) {
      return () => {
        cancelled = true;
      };
    }

    handledRef.current = true;

    if (session) {
      router.replace('/home');
      return () => {
        cancelled = true;
      };
    }

    if (!hasCallbackData) {
      return () => {
        cancelled = true;
      };
    }

    async function finishCallback() {
      try {
        const query = new URLSearchParams();

        if (code) {
          query.set('code', code);
        }

        if (error) {
          query.set('error', error);
        }

        if (errorDescription) {
          query.set('error_description', errorDescription);
        }

        const callbackUrl = `${getOAuthRedirectUrl()}?${query.toString()}`;
        await completeOAuthCallback(callbackUrl);

        if (!cancelled) {
          router.replace('/home');
        }
      } catch (callbackFailure) {
        if (!cancelled) {
          setCallbackError(
            getSafeErrorMessage(
              callbackFailure,
              'Login OAuth gagal. Silakan coba lagi.',
              'auth',
            ),
          );
        }
      }
    }

    void finishCallback();

    return () => {
      cancelled = true;
    };
  }, [code, error, errorDescription, hasCallbackData, initializing, session]);

  const message = callbackError
    ?? (hasCallbackData
      ? 'Menyelesaikan login...'
      : 'Data login tidak ditemukan. Kembali ke halaman login.');

  if (callbackError || !hasCallbackData) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{message}</Text>
        <Button
          title="Kembali ke Login"
          variant="cyan"
          onPress={() => router.replace('/login')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#007787" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },

  message: {
    marginTop: 14,
    marginBottom: 20,
    color: '#2A2A2A',
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    textAlign: 'center',
  },
});
