import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Download,
  Mail,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';

import AnalysisCard from '../../components/AnalysisCard';
import { supabase } from '../../lib/supabase';
import {
  getScanById,
  getScanImageUrl,
} from '../../services/scanServices';
import type { ScanDetail } from '../../types/scans';
import {
  DATA_NOT_AVAILABLE, formatConfidence, formatDataValue,
  formatDiagnosis, formatStatus, normalizeResultValue,
} from '../../utils/scanFormatters';

type AnalysisItem = {
  status: string;
  description: string;
};

type ExaminationResult = {
  imageUrl: string | null;
  analysis: {
    asymmetry: AnalysisItem;
    border: AnalysisItem;
    color: AnalysisItem;
    diameter: AnalysisItem;
  };

  conclusion: {
    label: string | null;
    severity: string | null;
    stage: string;
    confidence: number | null;
    recommendation: string;
  };
};


type DiagnosisTone = 'safe' | 'danger' | 'neutral';

type DiagnosisVisual = {
  title: string;
  subtitle: string;
  accentColor: string;
  tone: DiagnosisTone;
};

const DIAGNOSIS_ACCENT = {
  safe: '#2EAF62',
  danger: '#FF5050',
  neutral: '#D97706',
} as const;

function getDiagnosisVisual(
  diagnosis?: string | null,
  status?: string | null,
): DiagnosisVisual {
  const normalizedDiagnosis = normalizeResultValue(diagnosis);
  const normalizedStatus = normalizeResultValue(status);
  const isDangerous =
    ['melanoma', 'risk_detected', 'high_risk', 'high_severity'].includes(
      normalizedDiagnosis,
    ) ||
    ['risk_detected', 'high_risk', 'high_severity', 'critical'].includes(
      normalizedStatus,
    );
  const isPending =
    ['pending', 'processing', 'queued', 'unknown'].includes(
      normalizedDiagnosis,
    ) ||
    ['pending', 'processing', 'queued', 'unknown'].includes(normalizedStatus);
  const isNonMelanoma = ['non_melanoma', 'nonmelanoma'].includes(
    normalizedDiagnosis,
  );

  let tone: DiagnosisTone = 'neutral';

  if (!isPending && isDangerous) {
    tone = 'danger';
  } else if (!isPending && isNonMelanoma) {
    tone = 'safe';
  }

  return {
    title: formatDiagnosis(diagnosis),
    subtitle: formatStatus(status),
    accentColor: DIAGNOSIS_ACCENT[tone],
    tone,
  };
}

function mapAnalysisItem(value: string | null): AnalysisItem {
  return {
    status: formatDataValue(value),
    description: '',
  };
}

function mapScanToExaminationResult(
  scan: ScanDetail,
  imageUrl: string | null,
): ExaminationResult {
  return {
    imageUrl,
    analysis: {
      asymmetry: mapAnalysisItem(scan.asymmetry),
      border: mapAnalysisItem(scan.border),
      color: mapAnalysisItem(scan.color),
      diameter: mapAnalysisItem(scan.diameter),
    },
    conclusion: {
      label: scan.diagnosis,
      severity: scan.status,
      stage: formatDataValue(scan.stage),
      confidence: scan.confidence,
      recommendation: formatDataValue(scan.recommendation),
    },
  };
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

  return 'Hasil pemeriksaan gagal dimuat.';
}

type BusyAction = 'download' | 'email' | null;

export default function HistoryDetailPage() {
  const { width, fontScale } = useWindowDimensions();
  const compactConclusion = width < 360 || fontScale > 1.2;
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const scanId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [result, setResult] = useState<ExaminationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [imageState, setImageState] = useState<'none' | 'loading' | 'ready' | 'error'>('none');

  useEffect(() => {
    let isActive = true;

    async function fetchScan() {
      setResult(null);
      setError(null);
      setShowFullAnalysis(false);
      setImageState('none');

      if (!scanId) {
        setLoading(false);
        setError('ID pemeriksaan tidak tersedia.');
        return;
      }

      setLoading(true);

      try {
        const response = await getScanById(scanId);

        if (!isActive) {
          return;
        }

        if (response.error) {
          setError(getErrorMessage(response.error));
          setLoading(false);
          return;
        }

        if (!response.scan) {
          setError(
            'Pemeriksaan tidak ditemukan atau Anda tidak memiliki akses.',
          );
          setLoading(false);
          return;
        }

        // Hasil teks/PDF tetap tersedia saat penandatanganan atau unduhan gambar lambat.
        setResult(mapScanToExaminationResult(response.scan, null));
        setLoading(false);
        if (!response.scan.image_url?.trim()) return;

        setImageState('loading');

        try {
          const imageResponse = await getScanImageUrl(
            response.scan.image_url,
          );

          if (!isActive) return;

          if (imageResponse.error || !imageResponse.imageUrl) {
            setImageState('error');
            console.warn(
              'Gagal mengambil gambar scan:',
              imageResponse.error?.message ?? 'URL gambar tidak tersedia.',
            );
          } else {
            setResult(mapScanToExaminationResult(response.scan, imageResponse.imageUrl));
          }
        } catch (imageError) {
          if (!isActive) return;
          setImageState('error');
          console.warn(
            'Gagal mengambil gambar scan:',
            getErrorMessage(imageError),
          );
        }

      } catch (fetchError) {
        if (isActive) {
          setError(getErrorMessage(fetchError));
          setLoading(false);
        }
      }
    }

    void fetchScan();

    return () => {
      isActive = false;
    };
  }, [scanId]);

  async function createResultPdf(
    examinationResult: ExaminationResult,
    resultScanId: string,
  ) {
    const html = buildResultHtml(examinationResult, resultScanId);

    const { uri } = await Print.printToFileAsync({
      html,
    });

    return uri;
  }

  async function handleDownload() {
    if (!result || !scanId) {
      Alert.alert(
        'Hasil belum tersedia',
        'Tunggu hingga hasil pemeriksaan selesai dimuat.',
      );
      return;
    }

    try {
      setBusyAction('download');

      const pdfUri = await createResultPdf(result, scanId);
      const sharingAvailable = await Sharing.isAvailableAsync();

      if (!sharingAvailable) {
        Alert.alert(
          'Tidak dapat menyimpan',
          'Fitur penyimpanan atau berbagi file tidak tersedia pada perangkat ini.',
        );
        return;
      }

      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Simpan hasil pemeriksaan',
      });
    } catch (error) {
      Alert.alert(
        'Gagal membuat hasil',
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat membuat PDF.',
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSendEmail() {
    if (!result || !scanId) {
      Alert.alert(
        'Hasil belum tersedia',
        'Tunggu hingga hasil pemeriksaan selesai dimuat.',
      );
      return;
    }

    try {
      setBusyAction('email');

      const mailAvailable =
        await MailComposer.isAvailableAsync();

      if (!mailAvailable) {
        Alert.alert(
          'Aplikasi email tidak tersedia',
          'Pastikan perangkat memiliki aplikasi email yang sudah dikonfigurasi.',
        );
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user?.email) {
        Alert.alert(
          'Email tidak ditemukan',
          'Akun ini belum memiliki alamat email.',
        );
        return;
      }

      const pdfUri = await createResultPdf(result, scanId);

      await MailComposer.composeAsync({
        recipients: [user.email],
        subject: `Hasil Pemeriksaan MelanoSense ${scanId}`,
        body:
          'Berikut terlampir hasil pemeriksaan MelanoSense Anda. ' +
          'Hasil ini merupakan analisis awal dan bukan pengganti diagnosis tenaga medis.',
        attachments: [pdfUri],
      });
    } catch (error) {
      Alert.alert(
        'Gagal menyiapkan email',
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat menyiapkan email.',
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <ArrowLeft
            size={28}
            color="#007787"
            strokeWidth={2.5}
          />

          <Text style={styles.backText}>Kembali</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#007787" />
          <Text style={styles.stateText}>Memuat hasil pemeriksaan...</Text>
        </View>
      ) : error || !result ? (
        <View style={styles.stateContainer}>
          <Text style={styles.errorText}>
            {error || 'Hasil pemeriksaan tidak ditemukan.'}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.stateBackButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.stateBackButtonText}>Kembali</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {imageState !== 'none' && (
            <View style={styles.scanImageContainer}>
              {result.imageUrl && imageState !== 'error' && (
                <Image
                  key={result.imageUrl}
                  source={{ uri: result.imageUrl }}
                  style={styles.scanImage}
                  contentFit="cover"
                  transition={200}
                  onLoad={() => setImageState('ready')}
                  onError={() => {
                    setImageState('error');
                    console.warn('Gambar scan gagal dimuat.');
                  }}
                  accessibilityLabel="Foto lesi hasil pemeriksaan"
                />
              )}
              {imageState === 'loading' && (
                <View style={styles.imagePlaceholder}>
                  <ActivityIndicator color="#007787" />
                  <Text style={styles.stateText}>Memuat gambar...</Text>
                </View>
              )}
              {imageState === 'error' && (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.stateText}>Gambar tidak tersedia.</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.sectionTitle}>Analisis ABCD</Text>

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

          {showFullAnalysis && (
            <>
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

              <ConclusionSection conclusion={result.conclusion} compact={compactConclusion} />
            </>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.toggleButton,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              setShowFullAnalysis((previousValue) => !previousValue)
            }
          >
            <Text style={styles.toggleText}>
              {showFullAnalysis
                ? 'Tampilkan Lebih Sedikit'
                : 'Tampilkan Analisis Lengkap'}
            </Text>

            {showFullAnalysis ? (
              <ChevronUp
                size={30}
                color="#007787"
                strokeWidth={3}
              />
            ) : (
              <ChevronDown
                size={30}
                color="#007787"
                strokeWidth={3}
              />
            )}
          </Pressable>

          <View style={styles.actionContainer}>
            <ActionButton
              label={
                busyAction === 'download'
                  ? 'Menyiapkan PDF...'
                  : 'Unduh Hasil'
              }
              icon={
                busyAction === 'download' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Download
                    size={21}
                    color="#FFFFFF"
                    strokeWidth={2.5}
                  />
                )
              }
              disabled={busyAction !== null || !result}
              onPress={handleDownload}
            />

            <ActionButton
              label={
                busyAction === 'email'
                  ? 'Menyiapkan Email...'
                  : 'Kirim Email'
              }
              icon={
                busyAction === 'email' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Mail
                    size={21}
                    color="#FFFFFF"
                    strokeWidth={2.5}
                  />
                )
              }
              disabled={busyAction !== null || !result}
              onPress={handleSendEmail}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type ConclusionSectionProps = {
  conclusion: ExaminationResult['conclusion'];
  compact: boolean;
};

function ConclusionSection({
  conclusion,
  compact,
}: ConclusionSectionProps) {
  const diagnosisVisual = getDiagnosisVisual(
    conclusion.label,
    conclusion.severity,
  );
  const DiagnosisIcon =
    diagnosisVisual.tone === 'safe'
      ? CircleCheck
      : diagnosisVisual.tone === 'danger'
        ? CircleAlert
        : CircleHelp;
  const confidenceText = formatConfidence(conclusion.confidence);

  return (
    <View style={styles.conclusionSection}>
      <Text style={styles.sectionTitle}>Kesimpulan</Text>

      <View style={[styles.conclusionRow, compact && styles.compactRow]}>
        <View
          style={[
            styles.diagnosisCircle,
            { borderColor: diagnosisVisual.accentColor },
          ]}
        >
          <DiagnosisIcon
            size={52}
            color={diagnosisVisual.accentColor}
            strokeWidth={2.5}
          />
        </View>

        <View style={[styles.conclusionContent, compact && styles.compactContent]}>
          <Text
            style={[
              styles.conclusionTitle,
              { color: diagnosisVisual.accentColor },
            ]}
          >
            {diagnosisVisual.title}
          </Text>

          <Text
            style={[
              styles.diagnosisSubtitle,
              { color: diagnosisVisual.accentColor },
            ]}
          >
            {diagnosisVisual.subtitle}
          </Text>

          <Text style={styles.conclusionDescription}>
            {conclusion.recommendation}
          </Text>
        </View>
      </View>

      <View style={[styles.conclusionRow, compact && styles.compactRow]}>
        <View style={styles.confidenceCircle}>
          <Text style={[
            styles.confidenceValue,
            confidenceText === DATA_NOT_AVAILABLE && styles.confidenceUnavailable,
          ]}>
            {confidenceText}
          </Text>
        </View>

        <View style={[styles.conclusionContent, compact && styles.compactContent]}>
          <Text style={styles.conclusionTitle}>
            {conclusion.stage}
          </Text>

          <Text style={styles.conclusionDescription}>
            {confidenceText === DATA_NOT_AVAILABLE
              ? DATA_NOT_AVAILABLE
              : `Tingkat keyakinan sistem terhadap hasil analisis adalah ${confidenceText}.`}
          </Text>
        </View>
      </View>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onPress: () => void;
};

function ActionButton({
  label,
  icon,
  disabled = false,
  onPress,
}: ActionButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon}
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function buildResultHtml(
  result: ExaminationResult,
  scanId: string,
) {
  const { analysis, conclusion } = result;

  return `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="UTF-8" />

        <style>
          body {
            font-family: Arial, sans-serif;
            color: #202020;
            padding: 32px;
          }

          h1 {
            color: #007787;
            margin-bottom: 6px;
          }

          h2 {
            margin-top: 28px;
            border-bottom: 2px solid #92DAD7;
            padding-bottom: 8px;
          }

          .item {
            margin-bottom: 18px;
          }

          .item-title {
            font-size: 18px;
            font-weight: bold;
          }

          .status {
            color: #007787;
            font-weight: bold;
          }

          .conclusion {
            margin-top: 24px;
            padding: 18px;
            border-radius: 10px;
            background-color: #F1FAF5;
          }

          .warning {
            margin-top: 28px;
            font-size: 11px;
            color: #666666;
          }
        </style>
      </head>

      <body>
        <h1>Hasil Pemeriksaan MelanoSense</h1>
        <p>ID pemeriksaan: ${escapeHtml(scanId)}</p>

        <h2>Analisis ABCD</h2>

        ${createAnalysisHtml(
          'Asymmetry',
          analysis.asymmetry,
        )}

        ${createAnalysisHtml(
          'Border',
          analysis.border,
        )}

        ${createAnalysisHtml(
          'Color',
          analysis.color,
        )}

        ${createAnalysisHtml(
          'Diameter',
          analysis.diameter,
        )}

        <div class="conclusion">
          <h2>Kesimpulan</h2>

          <p>
            <strong>Indikasi:</strong>
            ${escapeHtml(formatDiagnosis(conclusion.label))}
          </p>

          <p>
            <strong>Status pemeriksaan:</strong>
            ${escapeHtml(formatStatus(conclusion.severity))}
          </p>

          <p>
            <strong>Stadium:</strong>
            ${escapeHtml(conclusion.stage)}
          </p>

          <p>
            <strong>Tingkat keyakinan:</strong>
            ${escapeHtml(formatConfidence(conclusion.confidence))}
          </p>

          <p>
            <strong>Rekomendasi:</strong>
            ${escapeHtml(conclusion.recommendation)}
          </p>
        </div>

        <p class="warning">
          Hasil ini merupakan analisis awal dan tidak menggantikan
          diagnosis atau konsultasi dengan tenaga medis.
        </p>
      </body>
    </html>
  `;
}

function createAnalysisHtml(
  title: string,
  analysis: AnalysisItem,
) {
  return `
    <div class="item">
      <div class="item-title">${escapeHtml(title)}</div>

      <p>
        <span class="status">
          ${escapeHtml(analysis.status)}.
        </span>

        ${escapeHtml(analysis.description)}
      </p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  topBar: {
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    elevation: 3,
  },

  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },

  backText: {
    fontSize: 22,
    fontFamily: 'Poppins-SemiBold',
    color: '#007787',
  },

  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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

  stateBackButton: {
    marginTop: 18,
    borderRadius: 6,
    backgroundColor: '#008896',
    paddingHorizontal: 22,
    paddingVertical: 11,
  },

  stateBackButtonText: {
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },

  sectionTitle: {
    fontSize: 26,
    fontFamily: 'Poppins-SemiBold',
    color: '#171717',
    marginBottom: 22,
  },

  scanImageContainer: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F2F4F7',
    marginBottom: 28,
  },

  scanImage: {
    width: '100%',
    height: '100%',
  },

  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  conclusionSection: {
    marginTop: 6,
  },

  conclusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 30,
  },

  diagnosisCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  confidenceCircle: {
    minWidth: 96,
    minHeight: 96,
    maxWidth: '100%',
    padding: 8,
    borderRadius: 48,
    borderWidth: 9,
    borderColor: '#FFA17A',
    justifyContent: 'center',
    alignItems: 'center',
  },

  confidenceValue: {
    fontSize: 22,
    fontFamily: 'Poppins-Medium',
    color: '#FF8F67',
  },

  confidenceUnavailable: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 4,
    color: '#667085',
  },

  conclusionContent: {
    flex: 1,
    minWidth: 0,
  },
  compactRow: { flexDirection: 'column', alignItems: 'flex-start', gap: 12 },
  compactContent: { flex: 0, width: '100%' },

  conclusionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Medium',
    color: '#202020',
    marginBottom: 5,
  },

  diagnosisSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 5,
  },

  conclusionDescription: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Poppins-Regular',
    color: '#777777',
  },

  toggleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    marginBottom: 22,
  },

  toggleText: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#00899A',
    marginBottom: 4,
  },

  actionContainer: {
    gap: 10,
  },

  actionButton: {
    minHeight: 54,
    borderRadius: 6,
    backgroundColor: '#008896',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  actionButtonText: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
  },

  disabledButton: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.7,
  },
});
