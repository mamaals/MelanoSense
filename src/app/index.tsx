import { ScrollView, StyleSheet, View, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import Button from '../components/Button';
import HeaderText from '../components/headerText';

const OpenScreen = () => {
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = Math.max(0, height - insets.top - insets.bottom);
  const spacing = Math.max(12, Math.min(24, availableHeight * 0.035 / fontScale));

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.container, { gap: spacing }]}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.imageContainer, { maxWidth: Math.min(360, availableHeight * 0.6) }]}>
          <Image source={require('../../assets/images/Logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="MelanoSense" />
        </View>
        <View style={styles.header}>
          <HeaderText text="Early Detection of Melanoma Disease" type="subtitle" />
        </View>

        <View style={styles.buttonContainer}>
          <Button title="Sign Up" variant="cyan" onPress={() => router.push('./register')} />

          <View style={styles.buttonGap} />

          <Button title="Log In" variant="darkgreen" onPress={() => router.push('./login')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default OpenScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
  },
  imageContainer: {
    width: '100%',
    alignSelf: 'center',
    // The supplied square PNG has white margins above/below the wordmark.
    // Center its unchanged image in a compact frame, preserving its proportions.
    aspectRatio: 2.6,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  logo: { width: '100%', aspectRatio: 1, flexShrink: 0 },
  header: {
    alignItems: 'center',
  },
  buttonContainer: {
    width: '100%',
  },
  buttonGap: {
    height: 10,
  },
});
