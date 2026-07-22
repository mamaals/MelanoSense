import { supabase } from "../lib/supabase";
import { Profile } from '../types/profile';

export async function getCurrentUserProfile() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
        return {
            profile: null,
            error: userError,
        };
    }

    const user = userData.user;

    if(!user) {
        return{
            profile: null,
            error: new Error('User belum login'),
        };
    }

    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    
    return {
        profile: data as Profile | null,
        error,
    };
}

export async function updateCurrentUserProfile(payload: { full_name?: string; phone?: string; birth_date?: string; gender?: string;}) {
    const { data:userData, error:userError } = await supabase.auth.getUser();

    if (userError){
        return {
            profile: null,
            error: userError,
        };
    }

    const user = userData.user;

    if(!user) {
        return {
            profile: null,
            error: new Error("user belum melakukan login"),
        }
    }

    const {data, error} = await supabase.from('profiles').update({...payload, updated_at: new Date().toISOString(),}).eq('id',user.id).select().single();

    return {
        profile: data as Profile | null,
        error,
    };
}