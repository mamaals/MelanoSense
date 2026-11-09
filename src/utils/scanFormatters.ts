export const DATA_NOT_AVAILABLE = 'Data tidak tersedia';
export const RESULT_NOT_AVAILABLE = 'Hasil belum tersedia';

// Pi/backend menyimpan probabilitas 0–1. Tampilkan maksimal satu desimal.
export function formatConfidence(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    return DATA_NOT_AVAILABLE;
  }
  return `${Number((value * 100).toFixed(1))}%`;
}

export function normalizeResultValue(value?: string | null): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '';
}

const unavailableValues = new Set([
  '', 'null', 'undefined', 'nan', 'infinity', '_infinity',
  'unknown', 'unavailable', 'data_tidak_tersedia', 'tingkat_keyakinan',
]);

export function formatDataValue(value?: string | null): string {
  return unavailableValues.has(normalizeResultValue(value))
    ? DATA_NOT_AVAILABLE
    : value!.trim();
}

const resultLabels: Record<string, string> = {
  non_melanoma: 'Non Melanoma',
  nonmelanoma: 'Non Melanoma',
  melanoma: 'Melanoma',
  risk_detected: 'Risiko Terdeteksi',
  low_risk: 'Risiko Rendah',
  high_risk: 'Risiko Tinggi',
  high_severity: 'Risiko Tinggi',
};

function humanizeLabel(value: string): string {
  return value.split('_').filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function formatDiagnosis(value?: string | null): string {
  const normalized = normalizeResultValue(value);
  if (unavailableValues.has(normalized) || ['pending', 'processing', 'queued'].includes(normalized)) {
    return RESULT_NOT_AVAILABLE;
  }
  return resultLabels[normalized] ?? humanizeLabel(normalized);
}

export function formatStatus(value?: string | null): string {
  const normalized = normalizeResultValue(value);
  if (unavailableValues.has(normalized)) return DATA_NOT_AVAILABLE;
  const statusLabels: Record<string, string> = {
    completed: 'Selesai', pending: 'Diproses', processing: 'Diproses', queued: 'Dalam Antrean',
  };
  return statusLabels[normalized] ?? resultLabels[normalized] ?? humanizeLabel(normalized);
}
