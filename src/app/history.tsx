import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentUserScanHistory } from '../services/scanServices';
import { formatDiagnosis } from '../utils/scanFormatters';

type HistoryItem = {
  id: string;
  date: string;
  result: string;
};

const ITEMS_PER_PAGE = 3;
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatExaminationDate(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 'Tanggal tidak tersedia';
  }

  return dateFormatter.format(date);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Riwayat pemeriksaan gagal dimuat.';
}

export default function HistoryPage() {
  const [pageRequest, setPageRequest] = useState({ page: 1, refresh: false });
  const currentPage = pageRequest.page;
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const displayedTotalPages = Math.max(totalPages, 1);

  const fetchHistory = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(!pageRequest.refresh);
    setRefreshing(pageRequest.refresh);
    setError(null);

    try {
      const response = await getCurrentUserScanHistory({
        page: pageRequest.page,
        pageSize: ITEMS_PER_PAGE,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (response.error) {
        setHistoryData([]);
        setTotalCount(0);
        setError(getErrorMessage(response.error));
        setLoading(false);
        return;
      }

      const lastPage = Math.max(
        Math.ceil(response.count / ITEMS_PER_PAGE),
        1,
      );

      setTotalCount(response.count);

      if (pageRequest.page > lastPage) {
        setPageRequest({ page: lastPage, refresh: false });
        return;
      }

      setHistoryData(
        response.scans.map((scan) => ({
          id: scan.id,
          date: formatExaminationDate(scan.created_at),
          result: formatDiagnosis(scan.diagnosis),
        })),
      );
      setLoading(false);
    } catch (fetchError) {
      if (requestId === requestIdRef.current) {
        setHistoryData([]);
        setTotalCount(0);
        setError(getErrorMessage(fetchError));
        setLoading(false);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [pageRequest]);

  useFocusEffect(
    useCallback(() => {
      void fetchHistory();

      return () => {
        requestIdRef.current += 1;
      };
    }, [fetchHistory]),
  );

  function goToPreviousPage() {
    if (!refreshing && currentPage > 1) {
      requestIdRef.current += 1;
      setPageRequest({ page: currentPage - 1, refresh: false });
    }
  }

  function goToNextPage() {
    if (!refreshing && currentPage < totalPages) {
      requestIdRef.current += 1;
      setPageRequest({ page: currentPage + 1, refresh: false });
    }
  }

  function handleRefresh() {
    // Invalidasi langsung, sebelum effect fetch berikutnya dijalankan.
    requestIdRef.current += 1;
    setRefreshing(true);
    setPageRequest({ page: 1, refresh: true });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Text style={styles.title}>Histori Pemeriksaan</Text>

        <View style={styles.pageContainer}>
          <Text style={styles.pageText}>
            Page {currentPage} of {displayedTotalPages}
          </Text>
        </View>

        {loading ? (
          <ScrollView contentContainerStyle={styles.stateContainer}>
            <ActivityIndicator size="large" color="#007787" />
            <Text style={styles.stateText}>Memuat histori pemeriksaan...</Text>
          </ScrollView>
        ) : error ? (
          <ScrollView contentContainerStyle={styles.stateContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => void fetchHistory()}
            >
              <Text style={styles.retryButtonText}>Coba Lagi</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <FlatList
            style={styles.listViewport}
            data={historyData}
            alwaysBounceVertical
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007787" />
            }
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
            ListFooterComponent={totalCount > 0 ? (
                <View style={styles.pagination}>
                  <Pressable
                    onPress={goToPreviousPage}
                    accessibilityLabel="Halaman sebelumnya"
                    disabled={refreshing || currentPage === 1}
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
                    accessibilityLabel="Halaman berikutnya"
                    disabled={refreshing || currentPage === totalPages}
                    style={[
                      styles.pageButton,
                      currentPage === totalPages && styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.pageButtonText}>›</Text>
                  </Pressable>
                </View>
            ) : null}
          />
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
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },

  title: {
    fontFamily: 'Poppins-Medium',
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
    flexGrow: 1,
    gap: 12,
    paddingBottom: 8,
  },
  listViewport: { flex: 1, minHeight: 0 },

  stateContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  stateText: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
    color: '#667085',
  },

  errorText: {
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
    color: '#B42318',
  },

  retryButton: {
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#007787',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  retryButtonText: {
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
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
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 8,
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
  },

  paginationText: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    color: '#252525',
  },

  empty: {
    textAlign: 'center',
    marginTop: 32,
    fontFamily: 'Poppins-Regular',
    color: '#98A2B3',
  },
});
