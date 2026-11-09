import { supabase } from '../lib/supabase';

type DisconnectResponse = {
  ok: true;
};

export async function disconnectCurrentDevice() {
  const { data, error } = await supabase.functions.invoke<DisconnectResponse>(
    'device-api/disconnect',
    {
      method: 'POST',
      body: {},
    },
  );

  if (error) {
    return { error };
  }

  if (!data?.ok) {
    return {
      error: new Error('Respons backend disconnect tidak valid.'),
    };
  }

  return { error: null };
}
