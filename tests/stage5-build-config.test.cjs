/* global __dirname */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { validateBuildConfig } = require('../scripts/validate-build-config.cjs');

const root = path.join(__dirname, '..');
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));

function fixture() {
  const eas = readJson('eas.json');
  eas.build.base.env.MELANOSENSE_SUPABASE_HOST = 'abcdefghijklmnopqrst.supabase.co';
  const app = readJson('app.json').expo;
  app.android.package = 'com.test.melanosense';
  return {
    profile: 'preview', eas, app, packageJson: readJson('package.json'),
    env: {
      EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_fixture_only',
    },
  };
}

const jwt = (role, ref = 'abcdefghijklmnopqrst') => [
  Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role, ref, exp: 4102444800 })).toString('base64url'),
  'synthetic_signature_not_a_credential',
].join('.');

test('SDK 57 stays on a fixed Hermes patch with native dependencies aligned to Expo', () => {
  const pkg = readJson('package.json');
  const expo = readJson('node_modules/expo/package.json');
  const bundled = readJson('node_modules/expo/bundledNativeModules.json');
  const [major, minor, patch] = expo.version.split('.').map(Number);
  assert.equal(major, 57, 'do not jump to SDK 58');
  assert.ok(minor > 0 || patch >= 17, 'include both Hermes memory and development-startup fixes');
  for (const name of ['react-native', 'react-native-reanimated', 'react-native-worklets']) {
    assert.equal(pkg.dependencies[name], bundled[name], `${name} uses the SDK-selected native version`);
    assert.equal(readJson(`node_modules/${name}/package.json`).version, bundled[name]);
  }
  const hermesTag = readFileSync(path.join(root, 'node_modules/react-native/sdks/.hermesv1version'), 'utf8').trim();
  const match = /^hermes-v250829098\.0\.(\d+)$/.exec(hermesTag);
  assert.ok(match && Number(match[1]) >= 16, 'installed React Native must contain the fixed Hermes V1 engine');
  assert.equal(pkg.devDependencies['react-test-renderer'], pkg.dependencies.react, 'test renderer matches the SDK React version');
  const plugins = readJson('app.json').expo.plugins.map((plugin) => Array.isArray(plugin) ? plugin[0] : plugin);
  for (const name of ['expo-router', 'expo-font', 'expo-sharing', 'expo-mail-composer', 'expo-image', 'expo-status-bar']) {
    assert.ok(plugins.includes(name), `${name} config plugin remains configured`);
  }
});

test('EAS profiles pin tooling and produce standalone release APK and AAB artifacts', () => {
  const eas = readJson('eas.json');
  assert.equal(eas.cli.version, '20.4.0');
  assert.equal(eas.cli.appVersionSource, 'local');
  assert.equal(eas.build.base.pnpm, '11.23.0');
  assert.equal(eas.build.base.node, '24.15.0');
  assert.equal(eas.build.base.corepack, false);
  assert.equal(eas.build.base.developmentClient, false);
  assert.equal(eas.build.base.env.EXPO_NO_DOTENV, '1');
  assert.equal(eas.build.base.android.image, 'ubuntu-26.04-jdk-17-ndk-r27b-sdk-57');
  for (const profile of ['preview', 'production']) {
    assert.equal(eas.build[profile].extends, 'base');
    assert.equal(eas.build[profile].environment, profile);
    assert.equal(eas.build[profile].android.autoIncrement, false);
    assert.equal(eas.build[profile].android.gradleCommand, undefined);
  }
  assert.equal(eas.build.preview.distribution, 'internal');
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.production.distribution, 'store');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.equal(readJson('package.json').scripts['eas-build-pre-install'], 'node ./scripts/validate-build-config.cjs');
});

test('Build preflight accepts client publishable keys and matching legacy anon JWT claims', () => {
  const input = fixture();
  assert.deepEqual(validateBuildConfig(input), []);
  delete input.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  input.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = jwt('anon');
  assert.deepEqual(validateBuildConfig(input), []);
});

test('Build preflight rejects missing and placeholder environment configuration', () => {
  const input = fixture();
  input.env = {};
  assert.ok(validateBuildConfig(input).some((error) => error.includes('EXPO_PUBLIC_SUPABASE_URL')));
  assert.ok(validateBuildConfig(input).some((error) => error.includes('key')));
  input.env = { EXPO_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key' };
  assert.ok(validateBuildConfig(input).length >= 2);
});

test('Build preflight rejects privileged keys and EXPO_PUBLIC backend/device credentials without echoing values', () => {
  for (const value of ['sb_secret_synthetic_do_not_ship', 'sbp_synthetic_do_not_ship', jwt('service_role')]) {
    const input = fixture();
    input.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = value;
    const errors = validateBuildConfig(input);
    assert.ok(errors.length);
    assert.ok(!errors.join('\n').includes(value));
  }
  const input = fixture();
  input.env.EXPO_PUBLIC_DEVICE_INGEST_SECRET = 'synthetic_device_secret';
  assert.ok(validateBuildConfig(input).some((error) => error.includes('Backend/device')));
});

test('Build preflight rejects ambiguous key precedence and anon keys for a different project', () => {
  const input = fixture();
  input.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = jwt('anon');
  assert.ok(validateBuildConfig(input).some((error) => error.includes('ambigu')));
  delete input.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  input.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = jwt('anon', 'differentprojectrefxx');
  assert.ok(validateBuildConfig(input).some((error) => error.includes('client-safe')));
});

test('Build preflight requires approved Android identity, positive versionCode, pinned project and frozen lockfile', () => {
  const input = fixture();
  delete input.app.android.package;
  input.app.android.versionCode = 0;
  input.env.EXPO_PUBLIC_SUPABASE_URL = 'https://zyxwvutsrqponmlkjihg.supabase.co';
  input.env.EAS_NO_FROZEN_LOCKFILE = '1';
  const errors = validateBuildConfig(input);
  for (const field of ['android.package', 'versionCode', 'project', 'Frozen']) {
    assert.ok(errors.some((error) => error.includes(field)));
  }
});

test('EAS hook refuses to use local dotenv as a substitute for build environment values', () => {
  const env = { ...process.env, EAS_BUILD_PROFILE: 'preview' };
  for (const name of Object.keys(env)) if (name.startsWith('EXPO_PUBLIC_')) delete env[name];
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/validate-build-config.cjs')], { env, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(result.stderr, /key/);
});

test('Build archive excludes local credentials while the environment example contains placeholders only', () => {
  const ignore = readFileSync(path.join(root, '.easignore'), 'utf8').split(/\r?\n/);
  for (const pattern of ['.env', '.env.*', '!.env.example', '.aws/', '.codex/', 'credentials.json']) {
    assert.ok(ignore.includes(pattern));
  }
  const example = readFileSync(path.join(root, '.env.example'), 'utf8');
  assert.match(example, /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key/);
  assert.doesNotMatch(example, /sb_publishable_|sb_secret_|sbp_|eyJ/);
  assert.equal(readJson('app.json').expo.scheme, 'melanosense');
  const versionCode = readJson('app.json').expo.android.versionCode;
  assert.ok(Number.isInteger(versionCode) && versionCode > 0);
});
