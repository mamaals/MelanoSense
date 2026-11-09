export type Profile = {
    id: string;
    full_name: string | null;
    phone: string | null;
    birth_date: string | null;
    gender: string | null;
    device_token: string;
    is_currently_connected: boolean;
    device_last_seen_at: string | null;
    created_at: string;
    updated_at: string;
}
