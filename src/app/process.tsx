import { useCallback, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import type { RealtimeChannel } from '@supabase/supabase-js';

import Button from '../components/Button';
import ProcessLoader from '../components/ProcessLoader';
import { supabase } from '../lib/supabase';
import { getLatestScanForUser } from '../services/scanServices';
import type { ScanObservation } from '../types/scans';

const SCAN_POLL_INTERVAL = 2500;

export default function ProcessPage() {
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Guard milik satu sesi fokus: callback lama tetap tidak aktif setelah Retry.
      let active = true;
      let handled = false;
      let pollInFlight = false;
      let channel: RealtimeChannel | undefined;
      let interval: ReturnType<typeof setInterval> | undefined;
      let appStateListener: ReturnType<typeof AppState.addEventListener> | undefined;
      const controller = new AbortController();

      function stopObserving() {
        active = false;
        controller.abort();
        clearInterval(interval);
        appStateListener?.remove();
        appStateListener = undefined;
        if (channel) {
          void supabase.removeChannel(channel).catch((removeError: unknown) => {
            console.warn('Gagal membersihkan observer scan:', removeError);
          });
          channel = undefined;
        }
      }

      async function startObserving() {
        setInitializing(true);
        setError(null);
        setPollingError(false);

        let initializationError = 'Tidak dapat memeriksa sesi login. Silakan coba lagi.';

        try {
          const { data, error: authError } = await supabase.auth.getUser();
          if (!active) return;
          if (authError) throw authError;
          if (!data.user) {
            setError('Sesi login tidak tersedia. Silakan masuk kembali.');
            setInitializing(false);
            return;
          }

          const userId = data.user.id;
          initializationError = 'Tidak dapat memuat acuan pemeriksaan. Silakan coba lagi.';
          const { scan: baseline, error: baselineError } =
            await getLatestScanForUser(userId, controller.signal);
          if (!active) return;
          if (baselineError) throw baselineError;

          // Baseline tetap sepanjang sesi. Riwayat lama tidak menyelesaikan proses,
          // termasuk ketika baseline dihapus lalu polling menemukan row lebih lama.
          function handleScan(scan: Partial<ScanObservation> | null) {
            if (
              !active || handled || AppState.currentState !== 'active' ||
              !scan?.id || scan.user_id !== userId ||
              scan.status !== 'completed' || !scan.created_at ||
              !Number.isFinite(Date.parse(scan.created_at)) ||
              (baseline && (
                scan.id === baseline.id ||
                Date.parse(scan.created_at) < Date.parse(baseline.created_at)
              ))
            ) return;

            // Pi meng-insert completed setelah inference dan upload selesai.
            handled = true;
            stopObserving();
            router.replace({ pathname: '/history/[id]', params: { id: scan.id } });
          }

          async function checkLatestScan() {
            if (!active || handled || pollInFlight || AppState.currentState !== 'active') return;
            pollInFlight = true;
            try {
              const { scan, error: queryError } =
                await getLatestScanForUser(userId, controller.signal);
              if (!active || handled) return;
              if (queryError) throw queryError;
              setPollingError(false);
              handleScan(scan);
            } catch {
              if (active && !handled) setPollingError(true);
            } finally {
              pollInFlight = false;
            }
          }

          // Polling tidak bergantung pada keberhasilan transport Realtime.
          interval = setInterval(() => void checkLatestScan(), SCAN_POLL_INTERVAL);
          appStateListener = AppState.addEventListener('change', (state) => {
            if (state === 'active') void checkLatestScan();
          });
          setInitializing(false);

          try {
            channel = supabase.channel(`scan-results:${userId}:${retryAttempt}:${Date.now()}:${Math.random()}`);
            channel.on<ScanObservation>(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'scans', filter: `user_id=eq.${userId}` },
              ({ new: scan }) => handleScan(scan),
            ).subscribe((status) => {
              if (!active || handled) return;
              if (status === 'SUBSCRIBED') {
                // Catch-up menutup gap baseline -> subscription siap (juga reconnect).
                void checkLatestScan();
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(`Realtime scan ${status}; pemeriksaan berkala tetap berjalan.`);
              }
            });
          } catch (subscriptionError) {
            console.warn('Realtime scan tidak tersedia; pemeriksaan berkala tetap berjalan.', subscriptionError);
          }

          // Catch-up awal juga berjalan jika subscription tidak pernah siap.
          void checkLatestScan();
        } catch (initializationFailure) {
          if (!active) return;
          console.warn('Gagal menyiapkan observer scan:', initializationFailure);
          setError(initializationError);
          setInitializing(false);
        }
      }

      void startObserving();
      return stopObserving;
    }, [retryAttempt]),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.safeArea} contentContainerStyle={styles.container}>
        {error ? (
          <>
            <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
            <Button
              title="Coba Lagi"
              variant="darkgreen"
              style={styles.button}
              onPress={() => setRetryAttempt((attempt) => attempt + 1)}
            />
          </>
        ) : (
          <>
            <ProcessLoader message={initializing
              ? 'Menyiapkan penantian hasil pemeriksaan...'
              : 'Menunggu hasil pemeriksaan...'} />
            {!initializing && (
              <Text style={styles.helperText}>
                Lakukan pemindaian menggunakan perangkat MelanoSense.{'\n\n'}
                Tekan tombol pemeriksaan pada perangkat. Hasil akan muncul otomatis setelah proses selesai.
              </Text>
            )}
            {pollingError && (
              <Text style={styles.helperText}>
                Hasil belum dapat diperiksa. Periksa koneksi internet Anda; aplikasi akan mencoba kembali secara otomatis.
              </Text>
            )}
          </>
        )}
        <Button
          title="Kembali"
          style={styles.button}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/home');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  helperText: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
    color: '#667085',
    lineHeight: 22,
  },
  errorText: { textAlign: 'center', fontFamily: 'Poppins-Regular', color: '#B42318' },
  button: { width: '100%', maxWidth: 280, marginTop: 20 },
});
