import { Alert, StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserRound } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import { getCurrentUserProfile } from '../services/profileServices';
import { Profile } from '../types/profile';
import Button from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';

function displayValue(value?: string) {
  return value && value.trim() !== '' ? value : '-';
}

function ProfileInfoItem({label,value,}: {label: string; value?: string;}) {
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
  const [isLoading, setIsLoading] = useState(true);

  async function fetchProfile() {
    setIsLoading(true);

    const { profile, error } = await getCurrentUserProfile();

    if (error) {
      console.log('Gagal mengambil profile:', error.message);
      setIsLoading(false);
      return;
    }

    setProfile(profile);
    setIsLoading(false);
  }

  // fetch profile
  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007787" />
      </View>
    );
  }

  const metadataName = typeof user?.user_metadata?.name === 'string'? user.user_metadata.name : null;
  const displayName = profile?.full_name ?? metadataName ?? '-';
  const email = user?.email;

  function confirmLogout() {
    Alert.alert('Log Out', 'Anda yakin ingin keluar dari akun ini?', [
      {
        text: 'Batal',
        style: 'cancel',
      },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: handleLogout,
      },
    ]);
  }

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await signOut();
      router.replace('/login');
    } catch (error) {
      Alert.alert(
        'Log Out gagal',
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat keluar. Silakan coba lagi.'
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <UserRound size={24} color="#FFFFFF" strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>Profil</Text>
        </View>

        <View style={styles.card}>
          <ProfileInfoItem label="Nama" value={displayName} />
          <ProfileInfoItem label="Jenis Kelamin" value={profile?.gender ?? "-"} />
          <ProfileInfoItem label="Tempat Tanggal Lahir" value={profile?.birth_date ?? "-"}/>
          <ProfileInfoItem label="Nomor Telepon" value={profile?.phone ?? "-"} />
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
    paddingTop: 54,
    paddingBottom: 130,
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
    height: 48,
    marginTop: 22,
  },

  logoutButton: {
    height: 48,
    marginTop: 10,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
