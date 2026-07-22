import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';

import BottomNavbar from '../components/navbar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color="#007787" />
      <Text style={styles.loadingText}>Memeriksa sesi...</Text>
    </View>
  );
}

function RootNavigator() {
  const pathname = usePathname();
  const { initializing, session } = useAuth();

  if (initializing) {
    return <LoadingScreen />;
  }

  const isLoggedIn = Boolean(session);
  const hideNavbar = ['/', '/login', '/register', '/auth/callback'].includes(
    pathname
  );

  return (
    <View style={{ flex: 1 }}>
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
          <Stack.Screen name="explore" />
        </Stack.Protected>
      </Stack>

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
    'Manrope-Medium': require('../../assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../../assets/fonts/Manrope-SemiBold.ttf'),
    'Manrope-Bold': require('../../assets/fonts/Manrope-Bold.ttf'),
    'Manrope-Light': require('../../assets/fonts/Manrope-Light.ttf'),
  });

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
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
});
