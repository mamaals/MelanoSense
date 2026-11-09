import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type InstructionItemProps = {
  number: number;
  children: React.ReactNode;
};

function InstructionItem({ number, children }: InstructionItemProps) {
  return (
    <View style={styles.instructionRow}>
      <Text style={styles.instructionNumber}>{number}.</Text>
      <Text style={styles.instructionText}>{children}</Text>
    </View>
  );
}

export default function GuidePage() {
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

      <View style={styles.header}>
        <Text style={styles.title}>Panduan</Text>
      </View>

      <View style={styles.card}>

        <View style={styles.instructions}>
          <InstructionItem number={1}>
            Lengkapi profil, lalu buka menu Scan di aplikasi untuk menampilkan QR
            pairing akun Anda. Raspberry Pi membaca QR yang ditampilkan di layar mobile.
          </InstructionItem>

          <InstructionItem number={2}>
            Setelah pairing, tekan Mulai Pemeriksaan di aplikasi untuk membuka
            layar menunggu hasil. Arahkan perangkat MelanoSense ke lesi.
          </InstructionItem>

          <Image
            source={require('../../assets/images/panduan-scan.png')}
            style={styles.guideImage}
            resizeMode="contain"
          />

          <InstructionItem number={3}>
            Mulai pemindaian dengan tombol fisik pemeriksaan atau tombol Enter
            pada Raspberry Pi. Pemindaian dimulai dari perangkat tersebut.
          </InstructionItem>

          <InstructionItem number={4}>
            Mobile menunggu hasil pemeriksaan baru melalui Supabase. Setelah hasil
            selesai, aplikasi otomatis membuka detail analisis ABCD dan kesimpulan.
          </InstructionItem>

          <InstructionItem number={5}>
            Hasil deteksi yang sudah lampau dapat dilihat kembali dalam menu
            histori.
          </InstructionItem>
        </View>

      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },


  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },


  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Medium',
    color: '#303030',
    marginBottom: 25,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#000000'
  },

  instructions: {
    width: '100%',
  },

  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },

  instructionNumber: {
    width: 24,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Poppins-Regular',
    color: '#303030',
  },

  instructionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Poppins-Regular',
    color: '#303030',
  },

  guideImage: {
    width: '100%',
    height: 180,
    marginTop: 4,
    marginBottom: 24,
  },
});
