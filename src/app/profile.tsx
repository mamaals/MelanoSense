import {
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserRound } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';

import Button from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCurrentUserProfile,
  isProfileComplete,
} from '../services/profileServices';
import type { Profile } from '../types/profile';
import { getSafeErrorMessage } from '../utils/userFacingErrors';

type ProfileStatus = 'LOADING' | 'SUCCESS' | 'ERROR' | 'INCOMPLETE';

function displayValue(value?: string | null) {
  return value && value.trim() !== '' ? value : '-';
}

function ProfileInfoItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{displayValue(value)}</Text>
    </View>
  );
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('LOADING');
  const [refreshing, setRefreshing] = useState(false);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const screenActiveRef = useRef(true);
  const logoutInFlightRef = useRef(false);
  const logoutDialogOpenRef = useRef(false);

  const fetchProfile = useCallback(async (showLoading = true) => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const requestId = ++requestIdRef.current;

    if (showLoading) {
      setProfileStatus('LOADING');
    }

    const request = (async () => {
      try {
        const { profile: fetchedProfile, error } = await getCurrentUserProfile();

        if (!screenActiveRef.current || requestId !== requestIdRef.current) {
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
        if (screenActiveRef.current && requestId === requestIdRef.current) {
          setProfileStatus('ERROR');
        }
      }
    })();

    inFlightRef.current = request;

    try {
      await request;
    } finally {
      if (inFlightRef.current === request) {
        inFlightRef.current = null;
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      screenActiveRef.current = true;
      void fetchProfile(true);

      return () => {
        screenActiveRef.current = false;
      };
    }, [fetchProfile]),
  );

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await fetchProfile(false);
    } finally {
      setRefreshing(false);
    }
  }

  function confirmLogout() {
    if (logoutDialogOpenRef.current || logoutInFlightRef.current) {
      return;
    }

    logoutDialogOpenRef.current = true;
    Alert.alert('Log Out', 'Anda yakin ingin keluar dari akun ini?', [
      {
        text: 'Batal',
        style: 'cancel',
        onPress: () => {
          logoutDialogOpenRef.current = false;
        },
      },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          logoutDialogOpenRef.current = false;
          void handleLogout();
        },
      },
    ], {
      cancelable: true,
      onDismiss: () => {
        logoutDialogOpenRef.current = false;
      },
    });
  }

  async function handleLogout() {
    if (logoutInFlightRef.current) {
      return;
    }

    logoutInFlightRef.current = true;
    setLoggingOut(true);

    try {
      await signOut();
      // Stack.Protected removes private history entries after auth changes.
      router.replace('/login');
    } catch (error) {
      Alert.alert(
        'Log Out gagal',
        getSafeErrorMessage(
          error,
          'Terjadi kesalahan saat keluar. Silakan coba lagi.',
          'auth',
        ),
      );
    } finally {
      logoutInFlightRef.current = false;
      setLoggingOut(false);
    }
  }

  const metadataName =
    typeof user?.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : null;
  const displayName = profile?.full_name ?? metadataName ?? '-';
  const email = user?.email;

  if (profileStatus === 'LOADING' && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007787" />
        <Text style={styles.loadingText}>Memuat profil...</Text>
      </View>
    );
  }

  if (profileStatus === 'ERROR' && !profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Profil belum dapat dimuat</Text>
          <Text style={styles.errorText}>
            Periksa koneksi internet Anda, lalu coba lagi.
          </Text>
          <Button
            title="Coba Lagi"
            variant="cyan"
            onPress={() => void fetchProfile(true)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007787"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            <UserRound size={24} color="#FFFFFF" strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>Profil</Text>
        </View>

        {profileStatus === 'ERROR' && (
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

        {profileStatus === 'INCOMPLETE' && (
          <View style={styles.incompleteBanner}>
            <Text style={styles.incompleteText}>
              Profil belum lengkap. Lengkapi empat data wajib agar dapat memulai pemeriksaan.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <ProfileInfoItem label="Nama" value={displayName} />
          <ProfileInfoItem label="Jenis Kelamin" value={profile?.gender} />
          <ProfileInfoItem label="Tanggal Lahir" value={profile?.birth_date} />
          <ProfileInfoItem label="Nomor Telepon" value={profile?.phone} />
          <ProfileInfoItem label="Email" value={email} />
        </View>

        <Button
          title="Edit Profil"
          variant="orange"
          shape="rounded"
          style={styles.editButton}
          onPress={() => router.push('/edit-profile')}
        />

        <Button
          title={loggingOut ? 'Keluar...' : 'Log Out'}
          variant="white"
          outline
          shape="rounded"
          style={styles.logoutButton}
          onPress={confirmLogout}
          disabled={loggingOut}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#007787',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontFamily: 'Poppins-SemiBold',
    color: '#2A2A2A',
  },
  card: {
    backgroundColor: '#F1FAF5',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  infoItem: {
    marginBottom: 14,
  },
  infoLabel: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2A2A2A',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#5F5F5F',
  },
  editButton: {
    marginTop: 22,
  },
  logoutButton: {
    marginTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    color: '#667085',
    fontFamily: 'Poppins-Regular',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
  },
  errorTitle: {
    color: '#2A2A2A',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 17,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    marginBottom: 12,
    color: '#8A4B08',
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorBanner: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FFF4E5',
    alignItems: 'center',
  },
  incompleteBanner: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F1FAF5',
  },
  incompleteText: {
    color: '#2A2A2A',
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
