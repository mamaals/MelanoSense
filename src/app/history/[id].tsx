import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Download,
  Mail,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';

import AnalysisCard from '../../components/AnalysisCard';
import { supabase } from '../../lib/supabase';

type AnalysisItem = {
  status: string;
  description: string;
};

type ExaminationResult = {
  analysis: {
    asymmetry: AnalysisItem;
    border: AnalysisItem;
    color: AnalysisItem;
    diameter: AnalysisItem;
  };

  conclusion: {
    label: string;
    severity: string;
    stage: string;
    confidence: number;
    recommendation: string;
  };
};

const mockResult: ExaminationResult = {
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

  conclusion: {
    label: 'Indikasi Risiko Tinggi',
    severity: 'Tingkat keparahan tinggi',
    stage: 'Stadium belum dapat ditentukan',
    confidence: 80,
    recommendation:
      'Disarankan melakukan pemeriksaan lanjutan bersama tenaga medis.',
  },
};

type BusyAction = 'download' | 'email' | null;

export default function HistoryDetailPage() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const scanId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  // Sementara masih mock. Nanti diganti hasil getScanById(scanId).
  const result = mockResult;

  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  async function createResultPdf() {
    const html = buildResultHtml(result, scanId ?? '-');

    const { uri } = await Print.printToFileAsync({
      html,
    });

    return uri;
  }

  async function handleDownload() {
    try {
      setBusyAction('download');

      const pdfUri = await createResultPdf();
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

      const pdfUri = await createResultPdf();

      await MailComposer.composeAsync({
        recipients: [user.email],
        subject: `Hasil Pemeriksaan MelanoSense ${scanId ?? ''}`,
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
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

            <ConclusionSection
              conclusion={result.conclusion}
            />
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
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Download
                  size={21}
                  color="#FFFFFF"
                  strokeWidth={2.5}
                />
              )
            }
            disabled={busyAction !== null}
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
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Mail
                  size={21}
                  color="#FFFFFF"
                  strokeWidth={2.5}
                />
              )
            }
            disabled={busyAction !== null}
            onPress={handleSendEmail}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type ConclusionSectionProps = {
  conclusion: ExaminationResult['conclusion'];
};

function ConclusionSection({
  conclusion,
}: ConclusionSectionProps) {
  return (
    <View style={styles.conclusionSection}>
      <Text style={styles.sectionTitle}>Kesimpulan</Text>

      <View style={styles.conclusionRow}>
        <View style={styles.warningCircle}>
          <CircleAlert
            size={52}
            color="#FF5050"
            strokeWidth={2.5}
          />
        </View>

        <View style={styles.conclusionContent}>
          <Text style={styles.conclusionTitle}>
            {conclusion.label}
          </Text>

          <Text style={styles.conclusionSeverity}>
            {conclusion.severity}
          </Text>

          <Text style={styles.conclusionDescription}>
            {conclusion.recommendation}
          </Text>
        </View>
      </View>

      <View style={styles.conclusionRow}>
        <View style={styles.confidenceCircle}>
          <Text style={styles.confidenceValue}>
            {conclusion.confidence}%
          </Text>
        </View>

        <View style={styles.conclusionContent}>
          <Text style={styles.conclusionTitle}>
            {conclusion.stage}
          </Text>

          <Text style={styles.conclusionDescription}>
            Tingkat keyakinan sistem terhadap hasil analisis
            adalah {conclusion.confidence}%.
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
            ${escapeHtml(conclusion.label)}
          </p>

          <p>
            <strong>Tingkat keparahan:</strong>
            ${escapeHtml(conclusion.severity)}
          </p>

          <p>
            <strong>Stadium:</strong>
            ${escapeHtml(conclusion.stage)}
          </p>

          <p>
            <strong>Tingkat keyakinan:</strong>
            ${conclusion.confidence}%
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

  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 60,
    backgroundColor: '#FFFFFF',
  },

  sectionTitle: {
    fontSize: 26,
    fontFamily: 'Poppins-SemiBold',
    color: '#171717',
    marginBottom: 22,
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

  warningCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 9,
    borderColor: '#FF5050',
    justifyContent: 'center',
    alignItems: 'center',
  },

  confidenceCircle: {
    width: 96,
    height: 96,
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

  conclusionContent: {
    flex: 1,
  },

  conclusionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Medium',
    color: '#202020',
    marginBottom: 5,
  },

  conclusionSeverity: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#D92D20',
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
  },

  actionButtonText: {
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