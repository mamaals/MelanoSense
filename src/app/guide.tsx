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
            Sambungkan alat dengan aplikasi dengan melakukan scan QR dari alat
            ke aplikasi atau masukkan kode alat ke dalam aplikasi pada halaman
            scan.
          </InstructionItem>

          <InstructionItem number={2}>
            Setelah alat terhubung, scan lesi dengan cara mengeklik tombol yang
            berada pada alat.
          </InstructionItem>

          <Image
            source={require('../../assets/images/panduan-scan.png')}
            style={styles.guideImage}
            resizeMode="contain"
          />

          <InstructionItem number={3}>
            Hasil deteksi akan muncul pada layar alat.
          </InstructionItem>

          <InstructionItem number={4}>
            Untuk melihat hasil analisis yang lebih detail, periksa hasil scan
            pada aplikasi.
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
    paddingHorizontal: 42,
    paddingTop: 54,
    paddingBottom: 150,
  },


  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  title: {
    fontSize: 36,
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