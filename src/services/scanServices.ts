import type { ScanDetail, ScanHistoryItem, ScanObservation } from '../types/scans';
import { supabase } from '../lib/supabase';

const SCAN_IMAGES_BUCKET = 'scan-images';
const SCAN_IMAGE_URL_EXPIRES_IN_SECONDS = 60 * 60;

type GetHistoryParams = {
  page: number;
  pageSize?: number;
};

// userId berasal dari auth.getUser() saat observer dimulai; RLS tetap berlaku.
export async function getLatestScanForUser(userId: string, signal?: AbortSignal) {
  let query = supabase
    .from('scans')
    .select('id, user_id, created_at, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query.maybeSingle();
  return { scan: data as ScanObservation | null, error };
}

export async function getScanImageUrl(imageLocation: string | null) {
  const normalizedLocation = imageLocation?.trim();

  if (!normalizedLocation) {
    return { imageUrl: null, error: null };
  }

  if (/^https?:\/\//i.test(normalizedLocation)) {
    return { imageUrl: normalizedLocation, error: null };
  }

  const { data, error } = await supabase.storage
    .from(SCAN_IMAGES_BUCKET)
    .createSignedUrl(
      normalizedLocation,
      SCAN_IMAGE_URL_EXPIRES_IN_SECONDS,
    );

  if (error) {
    return { imageUrl: null, error };
  }

  if (!data?.signedUrl) {
    return {
      imageUrl: null,
      error: new Error('Signed URL gambar scan tidak tersedia.'),
    };
  }

  return { imageUrl: data.signedUrl, error: null };
}

export async function getCurrentUserScanHistory({
  page,
  pageSize = 3,
}: GetHistoryParams) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    return {
      scans: [] as ScanHistoryItem[],
      count: 0,
      error: userError,
    };
  }

  const user = userData.user;

  if (!user) {
    return {
      scans: [] as ScanHistoryItem[],
      count: 0,
      error: new Error('User belum login.'),
    };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from('scans')
    .select(
      `
        id,
        created_at,
        status,
        diagnosis
      `,
      { count: 'exact' },
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  return {
    scans: (data ?? []) as ScanHistoryItem[],
    count: count ?? 0,
    error,
  };
}

export async function getScanById(scanId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    return {
      scan: null,
      error: userError,
    };
  }

  const user = userData.user;

  if (!user) {
    return {
      scan: null,
      error: new Error('User belum login.'),
    };
  }

  const { data, error } = await supabase
    .from('scans')
    .select(
      `
        id,
        user_id,
        image_url,
        asymmetry,
        border,
        color,
        diameter,
        status,
        diagnosis,
        stage,
        confidence,
        recommendation
      `,
    )
    .eq('id', scanId)
    .eq('user_id', user.id)
    .maybeSingle();

  return { scan: data as ScanDetail | null, error };
}

export async function deleteCurrentUserScan(scanId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    return { error: userError };
  }

  const user = userData.user;

  if (!user) {
    return {
      error: new Error('User belum melakukan login.'),
    };
  }

  const { error } = await supabase
    .from('scans')
    .delete()
    .eq('id', scanId)
    .eq('user_id', user.id);

  return { error };
}
