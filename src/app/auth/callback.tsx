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
  useAuth,
} from '@/contexts/AuthContext';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackPage() {
  const params = useLocalSearchParams();
  const { session, initializing } = useAuth();

  const handledRef = useRef(false);
  const [message, setMessage] = useState('Menyelesaikan login...');

  const code = firstParam(params.code);
  const error = firstParam(params.error);
  const errorDescription = firstParam(params.error_description);

  useEffect(() => {
    // Tunggu AuthContext membaca session dari AsyncStorage.
    if (initializing || handledRef.current) {
      return;
    }

    // Callback terbuka ulang, tetapi user sebenarnya sudah login.
    if (session) {
      handledRef.current = true;
      router.replace('/home');
      return;
    }

    // User belum login dan callback tidak berisi data OAuth.
    if (!code && !error && !errorDescription) {
      handledRef.current = true;
      setMessage('Data login tidak ditemukan. Kembali ke halaman login...');

      const timeout = setTimeout(() => {
        router.replace('/login');
      }, 1200);

      return () => clearTimeout(timeout);
    }

    handledRef.current = true;

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

        const callbackUrl =
          `melanosense://auth/callback?${query.toString()}`;

        await completeOAuthCallback(callbackUrl);

        router.replace('/home');
      } catch (callbackError) {
        const errorMessage =
          callbackError instanceof Error
            ? callbackError.message
            : 'Login OAuth gagal. Silakan coba lagi.';

        setMessage(errorMessage);

        setTimeout(() => {
          router.replace('/login');
        }, 1200);
      }
    }

    void finishCallback();
  }, [
    code,
    error,
    errorDescription,
    initializing,
    session,
  ]);

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
    color: '#2A2A2A',
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    textAlign: 'center',
  },
});