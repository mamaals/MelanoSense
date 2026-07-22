import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

type HistoryItem = {
  id: string;
  date: string;
  result: string;
};

const historyData: HistoryItem[] = [
  {
    id: '1',
    date: '12 Juli 2026',
    result: 'Risiko Rendah',
  },
  {
    id: '2',
    date: '8 Juli 2026',
    result: 'Perlu Pemeriksaan Lanjutan',
  },
  {
    id: '3',
    date: '3 Juli 2026',
    result: 'Risiko Rendah',
  },
  {
    id: '4',
    date: '1 Juli 2026',
    result: 'Perlu Pemeriksaan Lanjutan',
  },
  {
    id: '5',
    date: '28 Juni 2026',
    result: 'Risiko Rendah',
  },
  {
    id: '6',
    date: '20 Juni 2026',
    result: 'Risiko Sedang',
  },
];

const ITEMS_PER_PAGE = 3;

export default function HistoryPage() {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(historyData.length / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  const currentData = historyData.slice(startIndex, endIndex);

  function goToPreviousPage() {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }

  function goToNextPage() {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Histori Pemeriksaan</Text>

        <View style={styles.pageContainer}>
          <Text style={styles.pageText}>
            Page {currentPage} of {totalPages}
          </Text>
        </View>

        <FlatList
          data={currentData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/history/[id]',
                  params: { id: item.id },
                })
              }
            >
              <Text style={styles.date}>{item.date}</Text>

              <Text style={styles.label}>Hasil</Text>
              <Text style={styles.result}>{item.result}</Text>

              <View style={styles.footer}>
                <Text style={styles.detail}>Lihat Detail →</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Belum ada histori pemeriksaan.
            </Text>
          }
        />

        {historyData.length > 0 && (
          <View style={styles.pagination}>
            <Pressable
              onPress={goToPreviousPage}
              disabled={currentPage === 1}
              style={[
                styles.pageButton,
                currentPage === 1 && styles.disabledButton,
              ]}
            >
              <Text style={styles.pageButtonText}>‹</Text>
            </Pressable>

            <Text style={styles.paginationText}>
              {currentPage} / {totalPages}
            </Text>

            <Pressable
              onPress={goToNextPage}
              disabled={currentPage === totalPages}
              style={[
                styles.pageButton,
                currentPage === totalPages && styles.disabledButton,
              ]}
            >
              <Text style={styles.pageButtonText}>›</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 110,
    backgroundColor: '#FFFFFF',
  },

  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 28,
    color: '#000000',
    marginBottom: 10,
  },

  pageContainer: {
    alignItems: 'flex-end',
    marginBottom: 14,
  },

  pageText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#667085',
  },

  list: {
    gap: 12,
  },

  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#F6FAFA',
    borderWidth: 1,
    borderColor: '#DDEBEC',
  },

  date: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: '#667085',
    marginBottom: 12,
  },

  label: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#667085',
  },

  result: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#007787',
    marginTop: 2,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
  },

  detail: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#007787',
  },

  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 18,
  },

  pageButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#007787',
    justifyContent: 'center',
    alignItems: 'center',
  },

  disabledButton: {
    opacity: 0.3,
  },

  pageButtonText: {
    fontSize: 24,
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
    lineHeight: 26,
  },

  paginationText: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    color: '#252525',
  },

  empty: {
    textAlign: 'center',
    marginTop: 100,
    fontFamily: 'Poppins-Regular',
    color: '#98A2B3',
  },
});