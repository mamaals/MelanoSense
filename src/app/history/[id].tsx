import { useLocalSearchParams } from 'expo-router';
import { Text, StyleSheet, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnalysisCard from '../../components/AnalysisCard';

const mockResult = {
  analysis: {
    asymmetry: {
      status: 'Terdeteksi',
      description:
        'Bentuk lesi memperlihatkan pola yang tidak simetris.',
    },

    border: {
      status: 'Tidak beraturan',
      description:
        'Tepi lesi terlihat bergerigi dan kurang terdefinisi.',
    },

    color: {
      status: 'Bervariasi',
      description:
        'Terdapat beberapa variasi warna pada area lesi.',
    },

    diameter: {
      status: 'Signifikan',
      description:
        'Ukuran lesi mendekati atau melebihi batas yang perlu diperhatikan.',
    },
  },
};


export default function HistoryDetailPage() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const result = mockResult;
    return (
    <SafeAreaView style={styles.safeArea}>
      <View>
        <Text></Text>
      </View>

        <ScrollView style={styles.container}>
                <Text>Hasil Pemeriksaan {id}</Text>

                <AnalysisCard
                title="Asymmetry"
                status={result.analysis.asymmetry.status}
                description={result.analysis.asymmetry.description}
                />

                <AnalysisCard
                title="Border"
                status={result.analysis.border.status}
                description={result.analysis.border.description}
                />

                <AnalysisCard
                title="Color"
                status={result.analysis.color.status}
                description={result.analysis.color.description}
                />

                <AnalysisCard
                title="Diameter"
                status={result.analysis.diameter.status}
                description={result.analysis.diameter.description}
                />
        </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },

    container: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 54,
        paddingBottom: 130,
        backgroundColor: '#FFFFFF',
    },
});

