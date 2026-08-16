import { StyleSheet, Text, View, ActivityIndicator, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getCurrentUserProfile } from '../services/profileServices';
import type { Profile } from '../types/profile';
import { useCallback, useState } from 'react';
import ProfileSegment from '../components/header';
import Button from '../components/Button';
import { QrCode } from 'lucide-react-native';

type HomeState =
  | 'PROFILE_INCOMPLETE'
  | 'DEVICE_NOT_CONNECTED'
  | 'DEVICE_CONNECTED';

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  async function fetchProfile() {
    setIsLoading(true);

    const { profile: fetchedProfile, error } = await getCurrentUserProfile();

    if (error) {
      console.log('Gagal mengambil profil:', error.message);
      setIsLoading(false);
      return;
    }

    setProfile(fetchedProfile);
    setIsLoading(false);
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007787" />
      </View>
    );
  }
  
  const isProfileComplete = Boolean(profile?.full_name && profile?.phone && profile?.birth_date && profile?.gender);
  const isDeviceConnected = false;

  let homeState: HomeState;

  if (!isProfileComplete) {
    homeState = 'PROFILE_INCOMPLETE';
  } else if (!isDeviceConnected) {
    homeState = 'DEVICE_NOT_CONNECTED';
  } else {
    homeState = 'DEVICE_CONNECTED';
  }


  return (
    <View style={styles.container}>
      <ProfileSegment name={profile?.full_name ?? 'User'}/>

      <View style={styles.content}>
        {homeState === 'PROFILE_INCOMPLETE' && (
          <View style={styles.centerContent}>
            <Text style={styles.warningText}>
              <Text style={styles.bold}>Perhatian, </Text>
              Harap lengkapi profil sebelum
            </Text>

            <Text style={styles.warningText}>memulai pemindaian</Text>

            <View style={styles.buttonWrapper}>
              <Button
                title="Lengkapi Profil"
                variant="orange"
                onPress={() => router.push('/profile')}
                shape='rounded'
              />
            </View>
          </View>
        )}

        {homeState === 'DEVICE_NOT_CONNECTED' && (
          <View style={styles.centerContent}>
            <Text style={styles.infoText}>
              Scan QR code ini dengan alat MelanoSense untuk
            </Text>
            <Text style={styles.infoText}>
              menyambungkan alat anda
            </Text>

            <View style={styles.qrPlaceholder}>
                <QrCode
                  value={profile.device_token}
                  size={220}
                />
            </View>
          </View>
        )}

        {homeState === 'DEVICE_CONNECTED' && (
          <View style={styles.centerContent}>
            <View style={styles.deviceImage}>
              <Text>Device Image</Text>
            </View>

            <Text style={styles.infoText}>
              Terhubung dengan Device: <Text style={styles.bold}>XAM2455</Text>
            </Text>

            <View style={styles.scanButton}>
              <Button
                title="Mulai Scan"
                variant="darkgreen"
                onPress={() => router.push('/process')}
              />
            </View>

            <View style={styles.disconnectButton}>
              <Button
                title="Putuskan Sambungan"
                variant="cyan"
                onPress={() => undefined}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 34,
    paddingTop: 76,
    paddingBottom: 120,
    backgroundColor: '#FFFFFF',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
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

  buttonWrapper: {
    width: 170,
    marginTop: 11,
  },

  qrPlaceholder: {
    width: 180,
    height: 180,
    marginTop: 28,
    backgroundColor: '#F1F1F1',
    justifyContent: 'center',
    alignItems: 'center',
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
    width: 190,
    marginTop: 24,
  },

  disconnectButton: {
    width: 190,
    marginTop: 10,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

});
