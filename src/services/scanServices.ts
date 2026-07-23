import { Scan, ScanHistoryItem } from '../types/scans';
import { supabase } from '../lib/supabase';

type getHistoryParams = {
    page: number;
    pageSize?: number;
};

export async function getCurrentUserScanHistory({page, pageSize =3,}: getHistoryParams) {
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
        error: new Error('User belum login'),
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
        risk_level,
        confidence,
        conclusion,
        status,
        stage
        `,
        { count: 'exact' }
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
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
        error: new Error('User belum login'),
        };
    }

    const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('id', scanId)
        .eq('user_id', user.id)
        .single();

    return { scan: data as Scan | null, error,};
}

export async function deleteCurrentUserScan(scanId: string) {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
        return { error: userError };
    }

    const user = userData.user;

    if (!user) {
        return {
        error: new Error('User belum melakukan login'),
        };
    }

    const { error } = await supabase
        .from('scans')
        .delete()
        .eq('id', scanId)
        .eq('user_id', user.id);

    return { error };
}
