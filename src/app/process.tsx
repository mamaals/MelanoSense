import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import ProcessLoader from '../components/ProcessLoader';

type ProcessStage =
  | 'CONNECTING_DEVICE'
  | 'WAITING_FOR_CAPTURE'
  | 'PROCESSING_RESULT';

export default function ProcessPage() {
  const [processStage, setProcessStage] =
    useState<ProcessStage>('CONNECTING_DEVICE');

  async function runScanProcess() {
    try {
      // Dummy sementara.
      // Nanti ganti dengan fungsi koneksi perangkat sebenarnya.
      await delay(2500);

      setProcessStage('WAITING_FOR_CAPTURE');

      // Dummy sementara.
      // Nanti tunggu event/foto dari perangkat.
      await delay(4000);

      setProcessStage('PROCESSING_RESULT');

      // Dummy sementara.
      // Nanti tunggu hasil dari API/server.
      await delay(3000);

      router.replace('/history');
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Proses gagal',
        'Tidak dapat menyelesaikan pemeriksaan. Silakan coba kembali.',
      );

      router.back();
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      runScanProcess();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {processStage === 'CONNECTING_DEVICE' && (
          <ProcessLoader message="Menyambungkan ke alat MelanoSense" />
        )}

        {processStage === 'WAITING_FOR_CAPTURE' && (
          <ProcessLoader message="Silakan foto lesi menggunakan alat" />
        )}

        {processStage === 'PROCESSING_RESULT' && (
          <ProcessLoader message="Menganalisis hasil pemeriksaan" />
        )}
      </View>
    </SafeAreaView>
  );
}

function delay(duration: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, duration);
  });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
});
