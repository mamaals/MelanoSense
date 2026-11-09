import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { disconnectCurrentDevice } from '../services/deviceServices';
import {
  getCurrentUserProfile,
  isProfileComplete as profileIsCompleteContract,
} from '../services/profileServices';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/profile';

import ProfileSegment from '../components/header';
import Button from '../components/Button';

const PROFILE_REFRESH_INTERVAL = 3000;

// Profile polling should not regenerate the SVG while the pairing token is unchanged.
const PairingCode = memo(function PairingCode({ token }: { token: string }) {
  const [size, setSize] = useState(220);
  return (
    <View
      style={styles.qrPlaceholder}
      onLayout={({ nativeEvent }) => {
        const availableSize = Math.floor(nativeEvent.layout.width) - 24;
        if (availableSize > 0) setSize(Math.min(220, availableSize));
      }}
    >
      <QRCode value={token} size={size} quietZone={12} />
    </View>
  );
});

type ProfileStatus = 'LOADING' | 'SUCCESS' | 'ERROR' | 'INCOMPLETE';

function isProfileComplete(profile: Profile | null) {
  if (typeof profileIsCompleteContract === 'function') {
    return profileIsCompleteContract(profile);
  }

  // Keeps the screen compatible with isolated service mocks while preserving
  // the same four-field product contract in the app service.
  return Boolean(
    profile?.full_name?.trim() &&
      profile?.phone?.trim() &&
      profile?.birth_date?.trim() &&
      profile?.gender?.trim(),
  );
}

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('LOADING');
  const [refreshing, setRefreshing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const isDisconnectDialogOpenRef = useRef(false);
  const disconnectInFlightRef = useRef(false);
  const profileRequestRef = useRef(0);
  const profileInFlightRef = useRef<Promise<void> | null>(null);
  const screenActiveRef = useRef(true);

  const fetchProfile = useCallback(async (showLoading = false) => {
    if (profileInFlightRef.current) {
      return profileInFlightRef.current;
    }

    const requestId = ++profileRequestRef.current;

    if (showLoading) {
      setProfileStatus('LOADING');
    }

    const request = (async () => {
      try {
        const {
          profile: fetchedProfile,
          error,
        } = await getCurrentUserProfile();

        if (!screenActiveRef.current || requestId !== profileRequestRef.current) {
          return;
        }

        if (error) {
          setProfileStatus('ERROR');
          return;
        }

        setProfile(fetchedProfile);
        setProfileStatus(
          fetchedProfile && isProfileComplete(fetchedProfile)
            ? 'SUCCESS'
            : 'INCOMPLETE',
        );
      } catch {
        if (screenActiveRef.current && requestId === profileRequestRef.current) {
          setProfileStatus('ERROR');
        }
      }
    })();

    profileInFlightRef.current = request;

    try {
      await request;
    } finally {
      if (profileInFlightRef.current === request) {
        profileInFlightRef.current = null;
      }
    }
  }, []);

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await fetchProfile(false);
    } finally {
      setRefreshing(false);
    }
  }

  async function disconnectDevice() {
    if (disconnectInFlightRef.current) {
      return;
    }

    disconnectInFlightRef.current = true;
    setIsDisconnecting(true);

    try {
      const { error } = await disconnectCurrentDevice();

      if (error) {
        Alert.alert(
          'Gagal memutuskan sambungan',
          error.message || 'Silakan coba lagi.',
        );
        return;
      }

      await fetchProfile(false);
    } finally {
      disconnectInFlightRef.current = false;
      setIsDisconnecting(false);
    }
  }

  function handleDisconnectPress() {
    if (
      isDisconnectDialogOpenRef.current ||
      disconnectInFlightRef.current
    ) {
      return;
    }

    isDisconnectDialogOpenRef.current = true;

    Alert.alert(
      'Putuskan Sambungan?',
      'Token pairing akun akan diganti.\n\n' +
        'Untuk menghubungkan kembali perangkat, aktifkan kembali mode pairing ' +
        'pada perangkat lalu pindai QR baru.',
      [
        {
          text: 'Batal',
          style: 'cancel',
          onPress: () => {
            isDisconnectDialogOpenRef.current = false;
          },
        },
        {
          text: 'Putuskan',
          style: 'destructive',
          onPress: () => {
            isDisconnectDialogOpenRef.current = false;
            void disconnectDevice();
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          isDisconnectDialogOpenRef.current = false;
        },
      },
    );
  }

  /*
   * Fetch awal ketika Home difocus.
   *
   * Setelah itu polling setiap 3 detik sebagai fallback
   * kalau Supabase Realtime sedang bermasalah.
   */
  useFocusEffect(
    useCallback(() => {
      screenActiveRef.current = true;
      void fetchProfile(true);

      const interval = setInterval(() => {
        void fetchProfile(false);
      }, PROFILE_REFRESH_INTERVAL);

      return () => {
        screenActiveRef.current = false;
        clearInterval(interval);
      };
    }, [fetchProfile]),
  );

  /*
   * Realtime subscription.
   *
   * Kalau database berubah:
   * false → true
   * atau
   * true → false
   *
   * UI langsung update tanpa menunggu polling.
   */
  useEffect(() => {
    const profileId = profile?.id;

    if (!profileId) {
      return;
    }

    const channelName =
      `profile-device-connection:` +
      `${profileId}:` +
      `${Date.now()}:` +
      `${Math.random()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profileId}`,
        },
        (payload) => {
          if (!screenActiveRef.current) {
            return;
          }

          profileRequestRef.current += 1;
          const nextProfile = payload.new as Profile;
          setProfile(nextProfile);
          setProfileStatus(
            isProfileComplete(nextProfile) ? 'SUCCESS' : 'INCOMPLETE',
          );
        },
      )
      .subscribe((status, error) => {
        // Polling remains the fallback when Realtime cannot subscribe.
        void status;
        void error;
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  if (profileStatus === 'LOADING') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#007787"
        />
      </View>
    );
  }

  const profileIsComplete = isProfileComplete(profile);

  // Informasi aktivitas dari backend, bukan indikator online berkelanjutan.
  const isDeviceDetected =
    profile?.is_currently_connected === true;

  return (
    <SafeAreaView style={styles.scrollView} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007787"
          />
        }
      >
        <ProfileSegment
          name={profile?.full_name ?? 'User'}
        />

        {profileStatus === 'ERROR' && profile && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Profil belum dapat diperbarui. Data terakhir tetap ditampilkan.
            </Text>
            <Button
              title="Coba Lagi"
              variant="white"
              outline
              shape="rounded"
              onPress={() => void fetchProfile(false)}
            />
          </View>
        )}

        {profileStatus === 'ERROR' && !profile && (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>
              Profil belum dapat dimuat. Periksa koneksi lalu coba lagi.
            </Text>
            <Button
              title="Coba Lagi"
              variant="cyan"
              onPress={() => void fetchProfile(true)}
            />
          </View>
        )}

        {profileStatus !== 'ERROR' || profile ? <View style={styles.content}>
          {!profileIsComplete && (
            <View style={styles.centerContent}>
              <Text style={styles.warningText}>
                <Text style={styles.bold}>
                  Perhatian,{' '}
                </Text>
                Harap lengkapi profil sebelum
              </Text>

              <Text style={styles.warningText}>
                memulai pemindaian
              </Text>

              <View style={styles.buttonWrapper}>
                <Button
                  title="Lengkapi Profil"
                  variant="orange"
                  shape="rounded"
                  onPress={() =>
                    router.push('/profile')
                  }
                />
              </View>
            </View>
          )}

          {profileIsComplete && (
            <View style={styles.centerContent}>
              {isDeviceDetected && (
                <Text style={styles.activityText}>
                  Perangkat terdeteksi
                </Text>
              )}

              <Text style={styles.infoText}>
                Scan QR ini menggunakan perangkat MelanoSense untuk
                menghubungkan akun Anda.
              </Text>

              {profile?.device_token && <PairingCode token={profile.device_token} />}
              <Text style={styles.helperText}>
                Setelah perangkat berhasil dipasangkan, tekan Mulai Pemeriksaan
                lalu lakukan pemindaian menggunakan tombol pada perangkat.
              </Text>

              <View style={styles.scanButton}>
                <Button
                  title="Mulai Pemeriksaan"
                  variant="darkgreen"
                  onPress={() =>
                    router.push('/process')
                  }
                />
              </View>

              {isDeviceDetected && (
                <View style={styles.disconnectButton}>
                  <Button
                    title={isDisconnecting ? 'Memutuskan...' : 'Putuskan Sambungan'}
                    variant="cyan"
                    disabled={isDisconnecting}
                    onPress={handleDisconnectPress}
                  />
                </View>
              )}
            </View>
          )}
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },

  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 24,
  },

  centerContent: {
    alignItems: 'center',
  },

  warningText: {
    fontSize: 13,
    color: '#2A2A2A',
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: 'Poppins-Regular',
  },

  infoText: {
    fontSize: 12,
    color: '#2A2A2A',
    textAlign: 'center',
    fontFamily: 'Poppins-Medium',
  },

  bold: {
    fontFamily: 'Poppins-Bold',
  },

  activityText: {
    color: '#007787',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 12,
  },

  errorBanner: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FFF4E5',
    alignItems: 'center',
  },

  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  errorText: {
    color: '#8A4B08',
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12,
  },

  helperText: {
    marginTop: 20,
    fontSize: 12,
    lineHeight: 19,
    color: '#667085',
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
  },

  buttonWrapper: {
    width: '100%',
    maxWidth: 240,
    marginTop: 11,
  },

  qrPlaceholder: {
    width: '100%',
    maxWidth: 244,
    aspectRatio: 1,
    marginTop: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  deviceImage: {
    width: 180,
    height: 120,
    backgroundColor: '#F1F1F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  scanButton: {
    width: '100%',
    maxWidth: 280,
    marginTop: 24,
  },

  disconnectButton: {
    width: '100%',
    maxWidth: 280,
    marginTop: 10,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
