import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import BottomNavbar from '../components/navbar';
import Button from '../components/Button';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.loadingContainer}>
      <ActivityIndicator color="#007787" />
      <Text style={styles.loadingText}>Memeriksa sesi...</Text>
    </SafeAreaView>
  );
}

function AuthErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Sesi belum dapat dipulihkan</Text>
      <Text style={styles.errorText}>
        Periksa koneksi internet Anda, lalu coba lagi.
      </Text>
      <Button title="Coba Lagi" variant="cyan" onPress={onRetry} />
    </View>
  );
}

function RootNavigator() {
  const pathname = usePathname();
  const {
    authStatus,
    initializing,
    retrySessionInitialization,
    session,
  } = useAuth();

  if (initializing) {
    return <LoadingScreen />;
  }

  if (authStatus === 'ERROR') {
    return <AuthErrorScreen onRetry={() => void retrySessionInitialization()} />;
  }

  const isLoggedIn = Boolean(session);
  const hideNavbar = ['/', '/login', '/register', '/auth/callback'].includes(
    pathname
  );

  return (
    <View style={styles.root}>
      <View style={styles.navigator}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!isLoggedIn}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
          </Stack.Protected>

          <Stack.Screen name="auth/callback" />

          <Stack.Protected guard={isLoggedIn}>
            <Stack.Screen name="home" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="guide" />
            <Stack.Screen name="history" />
            <Stack.Screen name="history/[id]" />
            <Stack.Screen name="process" />
          </Stack.Protected>
        </Stack>
      </View>

      {isLoggedIn && !hideNavbar && <BottomNavbar />}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),

    'Manrope-Regular': require('../../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Bold': require('../../assets/fonts/Manrope-Bold.ttf'),
  });

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator color="#007787" />
          <Text style={styles.startupText}>Menyiapkan aplikasi...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  navigator: { flex: 1, minHeight: 0 },
  startupText: { marginTop: 14, color: '#2A2A2A', textAlign: 'center' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 14,
    color: '#2A2A2A',
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  errorTitle: {
    color: '#2A2A2A',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 17,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    marginBottom: 20,
    color: '#667085',
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    textAlign: 'center',
  },
});
