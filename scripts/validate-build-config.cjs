const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

function validateClientKey(value, hostname) {
  if (typeof value !== 'string' || !value || value.trim() !== value) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(value)) return true;

  // Legacy anon JWTs remain supported. Decoding checks the key's claimed role;
  // it does not replace server-side verification or prove the key is still valid.
  try {
    const parts = value.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload.role === 'anon'
      && payload.ref === hostname.split('.')[0]
      && (!payload.exp || payload.exp * 1000 > Date.now());
  } catch {
    return false;
  }
}

function validateBuildConfig({ env, app, packageJson, eas, profile }) {
  const errors = [];
  const settings = eas.build?.[profile];
  if (!['preview', 'production'].includes(profile) || !settings) {
    errors.push('Pilih build profile preview atau production.');
  }
  if (packageJson.packageManager !== 'pnpm@11.23.0') {
    errors.push('packageManager harus tetap pnpm@11.23.0.');
  }
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(app.android?.package ?? '')
      || /(^|\.)(example|placeholder)(\.|$)/.test(app.android?.package ?? '')) {
    errors.push('Tetapkan android.package yang telah disetujui sebelum build.');
  }
  if (!Number.isInteger(app.android?.versionCode) || app.android.versionCode < 1) {
    errors.push('android.versionCode harus berupa integer positif.');
  }

  const expectedHostname = eas.build?.base?.env?.MELANOSENSE_SUPABASE_HOST;
  let hostname;
  try {
    const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL);
    if (url.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
        || url.username || url.password || url.port || url.search || url.hash
        || !['', '/'].includes(url.pathname)) throw new Error('invalid');
    hostname = url.hostname;
    if (!expectedHostname || hostname !== expectedHostname) {
      errors.push('EXPO_PUBLIC_SUPABASE_URL tidak cocok dengan target project yang dipin.');
    }
  } catch {
    errors.push('EXPO_PUBLIC_SUPABASE_URL wajib berupa URL Supabase Cloud HTTPS yang valid.');
  }

  const keyNames = ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  const selectedKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!selectedKey) errors.push('EAS environment wajib menyediakan publishable key atau legacy anon key.');
  for (const name of keyNames) {
    if (env[name] !== undefined && !validateClientKey(env[name], hostname ?? '')) {
      errors.push(`${name} harus berupa client-safe publishable key atau legacy anon JWT untuk project ini.`);
    }
  }
  if (keyNames.every((name) => env[name]) && env[keyNames[0]] !== env[keyNames[1]]) {
    errors.push('Gunakan satu nama key Supabase agar precedence anon/publishable tidak ambigu.');
  }
  if (Object.keys(env).some((name) => name.startsWith('EXPO_PUBLIC_')
      && /SERVICE_ROLE|SECRET|ACCESS_TOKEN|INGEST|PRIVATE_KEY|PASSWORD/.test(name))) {
    errors.push('Backend/device credentials tidak boleh memakai prefix EXPO_PUBLIC_.');
  }
  if (env.EAS_NO_FROZEN_LOCKFILE) {
    errors.push('Frozen lockfile tidak boleh dinonaktifkan.');
  }
  return errors;
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
  const profile = process.argv[2] ?? process.env.EAS_BUILD_PROFILE;
  const errors = validateBuildConfig({
    env: process.env,
    app: readJson('app.json').expo,
    packageJson: readJson('package.json'),
    eas: readJson('eas.json'),
    profile,
  });
  if (!existsSync(path.join(root, 'pnpm-lock.yaml'))) errors.push('pnpm-lock.yaml wajib tersedia.');
  if (errors.length) {
    // Never echo environment values, JWT payloads, or API responses.
    console.error('Build configuration preflight FAILED:\n' + errors.map((message) => `- ${message}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Build configuration preflight PASS (${profile}); credential values withheld.`);
  }
}

module.exports = { validateBuildConfig };
