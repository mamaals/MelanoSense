export function getSafeErrorMessage(
  error: unknown,
  fallback: string,
  kind: 'auth' | 'profile' = 'profile',
) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (kind === 'auth') {
    if (message.includes('invalid login credentials')) {
      return 'Email atau password salah.';
    }

    if (message.includes('email not confirmed')) {
      return 'Email belum dikonfirmasi. Periksa inbox Anda.';
    }

    if (message.includes('user already registered')) {
      return 'Email tersebut sudah terdaftar.';
    }

    if (message.includes('password')) {
      return 'Password tidak memenuhi persyaratan.';
    }
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Koneksi bermasalah. Periksa internet lalu coba lagi.';
  }

  return fallback;
}
