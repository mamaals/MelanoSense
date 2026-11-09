// Native drawing, text measurement and OS dialogs still need physical APK acceptance.
/* global __dirname */
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '..');
const flatten = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const text = (node) => node.findAllByType('Text').map((item) => item.children.filter((child) => typeof child === 'string').join('')).join('\n');
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false },
    }).outputText;
    vm.runInNewContext(source, {
      exports, console, Date, setTimeout, clearTimeout,
      require: (id) => {
        if (id in mocks) return mocks[id];
        if (id.startsWith('.')) {
          const base = path.resolve(path.dirname(filename), id);
          if (base.endsWith('.png')) return base;
          const target = ['.ts', '.tsx'].map((ext) => base + ext).find(existsSync);
          assert.ok(target, `Missing import: ${id}`);
          return load(target);
        }
        return require(id);
      },
    }, { filename });
    return exports;
  }
  return load;
}

const dates = loader()('src/utils/birthDate.ts');
const localDate = (value) => dates.parseCalendarDate(value);

test('Calendar parsing validates leap years, malformed dates, empty values and years below 100', () => {
  for (const value of ['', '2001-02-29', '1900-02-29', '2005-07-32', '2005-13-17', '2005-7-17', '0000-01-01', '2005-07-17T00:00:00Z']) {
    assert.equal(dates.parseCalendarDate(value), null, value);
    assert.equal(dates.formatBirthDate(value), '', value);
  }
  for (const value of ['2000-02-29', '2024-02-29', '2005-07-17', '0099-07-17', '0001-01-01']) {
    assert.equal(dates.serializeCalendarDate(localDate(value)), value);
  }
  assert.equal(dates.formatBirthDate('2005-07-17'), '17 Juli 2005');
  assert.equal(dates.formatBirthDate('2000-02-29'), '29 Februari 2000');
  assert.equal(dates.serializeCalendarDate(new Date(NaN)), null);
  assert.equal(dates.serializeCalendarDate(new Date(10000, 0, 1)), null);
});

test('Birth dates reject future calendar days and accept today regardless of time of day', () => {
  const today = new Date(2026, 9, 28, 0, 1);
  for (const value of ['', '2026-10-29', '2027-01-01', '2026-02-30']) {
    assert.equal(dates.isAllowedBirthDate(value, today), false, value);
  }
  for (const value of ['2005-07-17', '2026-10-28']) {
    assert.equal(dates.isAllowedBirthDate(value, today), true, value);
  }
});

for (const timezone of ['Asia/Bangkok', 'Pacific/Kiritimati', 'America/Los_Angeles', 'Pacific/Pago_Pago']) {
  test(`Calendar date round trips without UTC day shifting in ${timezone}`, () => {
    const script = `
      const fs = require('node:fs'), ts = require('typescript'), vm = require('node:vm');
      function load(file, mocks = {}) {
        const exports = {};
        vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS }
        }).outputText, { exports, Date, require: (id) => mocks[id] });
        return exports;
      }
      const validation = load('src/utils/profileValidation.ts');
      const dates = load('src/utils/birthDate.ts', { './profileValidation': validation });
      const values = ['2005-07-17', '2000-02-29', '2024-03-10', '2024-11-03', '0099-07-17'];
      const results = values.map(value => dates.serializeCalendarDate(dates.parseCalendarDate(value)));
      const fromNative = dates.serializeCalendarDate(new Date(2005, 6, 17, 0, 0));
      console.log(JSON.stringify({ results, fromNative, offset: new Date(2005, 6, 17).getTimezoneOffset() }));
    `;
    const result = spawnSync(process.execPath, ['-e', script], { cwd: root, env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.notEqual(output.offset, 0, 'test must actually run in the requested non-UTC timezone');
    assert.deepEqual(output.results, ['2005-07-17', '2000-02-29', '2024-03-10', '2024-11-03', '0099-07-17']);
    assert.equal(output.fromNative, '2005-07-17');
  });
}

async function mount(t, file, options = {}) {
  const env = {
    os: 'android', pickerCalls: [], dismissals: [], alerts: [], saves: [], changes: [], navigations: [], keyboardDismissals: 0,
    value: '2005-07-17', disabled: false,
    dimensions: { width: 360, height: 800, fontScale: 1, scale: 1 },
    insets: { top: 24, bottom: 24, left: 0, right: 0 },
    profile: { full_name: 'Demo', gender: 'male', birth_date: '2005-07-17', phone: '+62 812345678' },
    ...options,
  };
  const mocks = {
    'react-native': {
      ...Object.fromEntries(['View', 'Text', 'TextInput', 'Image', 'Pressable', 'ScrollView', 'Modal', 'KeyboardAvoidingView', 'ActivityIndicator'].map((name) => [name, name])),
      StyleSheet: { create: (styles) => styles }, Platform: { OS: env.os },
      Keyboard: { dismiss: () => env.keyboardDismissals++ },
      Alert: { alert: (...args) => env.alerts.push(args) },
      useWindowDimensions: () => env.dimensions,
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => env.insets },
    '@react-native-community/datetimepicker': {
      default: 'DateTimePicker',
      DateTimePickerAndroid: {
        open: (args) => env.pickerCalls.push(args),
        dismiss: (mode) => { env.dismissals.push(mode); return Promise.resolve(); },
      },
    },
    'lucide-react-native': { CalendarDays: 'CalendarDays', UserRound: 'UserRound' },
    '@react-native-picker/picker': { Picker: Object.assign((props) => React.createElement('Picker', props, props.children), { Item: 'PickerItem' }) },
    'expo-router': { router: { back: () => env.navigations.push('back'), push: (route) => env.navigations.push(route) } },
    '../services/profileServices': {
      getCurrentUserProfile: async () => ({ profile: env.profile, error: env.loadError }),
      updateCurrentUserProfile: async (payload) => {
        env.saves.push(payload);
        if (env.saveThrows) throw new Error('temporary network error');
        return { error: env.saveError };
      },
    },
  };
  const Component = loader(mocks)(file).default;
  let tree;
  const render = () => React.createElement(Component, {
    value: env.value, disabled: env.disabled,
    onChange: (value) => { env.changes.push(value); env.value = value; },
  });
  await act(async () => { tree = create(render()); });
  // EditProfile defers its initial load until after mount.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1)); });
  env.tree = tree;
  env.rerender = () => act(async () => tree.update(render()));
  env.button = (label) => tree.root.findAllByType('Pressable').find((item) => text(item) === label);
  env.dateField = () => tree.root.findAllByType('Pressable').find((item) => item.props.accessibilityLabel?.startsWith('Tanggal Lahir,'));
  env.unmount = () => act(async () => tree.unmount());
  t.after(env.unmount);
  return env;
}

test('Android opens the native picker from existing local date; Batal preserves it and OK changes it', async (t) => {
  const env = await mount(t, 'src/components/BirthDateField.tsx');
  assert.match(text(env.tree.root), /17 Juli 2005/);
  assert.equal(env.tree.root.findAllByType('TextInput').length, 0);
  assert.ok(flatten(env.dateField().props.style).minHeight >= 48);
  await act(async () => env.dateField().props.onPress());
  assert.equal(env.keyboardDismissals, 1);
  const picker = env.pickerCalls[0];
  assert.equal(dates.serializeCalendarDate(picker.value), '2005-07-17');
  assert.equal(picker.value.getHours(), 12);
  assert.equal(picker.mode, 'date');
  assert.equal(picker.display, 'default');
  assert.equal(dates.serializeCalendarDate(picker.maximumDate), dates.serializeCalendarDate(new Date()));
  assert.equal(picker.positiveButton.label, 'OK');
  assert.equal(picker.negativeButton.label, 'Batal');
  await act(async () => env.dateField().props.onPress());
  assert.equal(env.pickerCalls.length, 1, 'double tapping does not open multiple dialogs');
  await act(async () => picker.onDismiss());
  assert.equal(env.changes.length, 0);
  await act(async () => env.dateField().props.onPress());
  await act(async () => env.pickerCalls[1].onValueChange({}, localDate('2000-02-29')));
  await env.rerender();
  assert.deepEqual(env.changes, ['2000-02-29']);
  assert.match(text(env.tree.root), /29 Februari 2000/);
});

test('Empty/invalid existing dates have a safe picker default; invalid and future selections are rejected', async (t) => {
  const env = await mount(t, 'src/components/BirthDateField.tsx', { value: '' });
  assert.match(text(env.tree.root), /Pilih tanggal lahir/);
  await act(async () => env.dateField().props.onPress());
  assert.equal(dates.serializeCalendarDate(env.pickerCalls[0].value), dates.serializeCalendarDate(new Date()));
  await act(async () => env.pickerCalls[0].onValueChange({}, new Date(NaN)));
  assert.equal(env.changes.length, 0);
  env.value = '2001-02-29';
  await env.rerender();
  await act(async () => env.dateField().props.onPress());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await act(async () => env.pickerCalls[1].onValueChange({}, tomorrow));
  assert.equal(env.changes.length, 0);
});

test('Disabled picker blocks interaction; unmount dismisses an open dialog and ignores late callbacks', async (t) => {
  const env = await mount(t, 'src/components/BirthDateField.tsx', { disabled: true });
  assert.equal(env.dateField().props.disabled, true);
  await act(async () => env.dateField().props.onPress());
  assert.equal(env.pickerCalls.length, 0);
  env.disabled = false;
  await env.rerender();
  await act(async () => env.dateField().props.onPress());
  await env.unmount();
  assert.deepEqual(env.dismissals, ['date']);
  env.pickerCalls[0].onValueChange({}, localDate('2000-02-29'));
  assert.equal(env.changes.length, 0);
});

test('iOS native picker stages changes until OK; Batal and modal dismissal preserve previous value', async (t) => {
  const env = await mount(t, 'src/components/BirthDateField.tsx', { os: 'ios' });
  await act(async () => env.dateField().props.onPress());
  const picker = env.tree.root.findByType('DateTimePicker');
  assert.equal(picker.props.mode, 'date');
  await act(async () => picker.props.onValueChange({}, localDate('2000-02-29')));
  assert.equal(env.changes.length, 0);
  await act(async () => env.button('Batal').props.onPress());
  assert.equal(env.changes.length, 0);
  assert.equal(env.tree.root.findAllByType('Modal').length, 0);
  await act(async () => env.dateField().props.onPress());
  assert.equal(dates.serializeCalendarDate(env.tree.root.findByType('DateTimePicker').props.value), '2005-07-17');
  await act(async () => env.tree.root.findByType('Modal').props.onRequestClose());
  assert.equal(env.changes.length, 0);
  await act(async () => env.dateField().props.onPress());
  await act(async () => env.tree.root.findByType('DateTimePicker').props.onValueChange({}, localDate('2000-02-29')));
  await act(async () => env.button('OK').props.onPress());
  assert.deepEqual(env.changes, ['2000-02-29']);
  assert.equal(env.pickerCalls.length, 0);
});

test('Web counterpart retains browser date selection without loading a native picker', async (t) => {
  const env = await mount(t, 'src/components/BirthDateField.web.tsx', { os: 'web' });
  const input = env.tree.root.findByType('input');
  assert.equal(input.props.type, 'date');
  assert.equal(input.props.value, '2005-07-17');
  assert.equal(input.props.max, dates.serializeCalendarDate(new Date()));
  await act(async () => input.props.onChange({ target: { value: '2000-02-29' } }));
  assert.deepEqual(env.changes, ['2000-02-29']);
  await act(async () => input.props.onChange({ target: { value: '9999-01-01' } }));
  assert.equal(env.changes.length, 1);
  assert.equal(env.pickerCalls.length, 0);
});

test('Edit Profile loads existing birth date, saves YYYY-MM-DD, and preserves the edit for save retry', async (t) => {
  const env = await mount(t, 'src/app/edit-profile.tsx', { saveThrows: true });
  assert.match(text(env.tree.root), /17 Juli 2005/);
  assert.equal(env.tree.root.findByType('KeyboardAvoidingView').props.behavior, 'height');
  assert.equal(env.tree.root.findByType('ScrollView').props.keyboardShouldPersistTaps, 'handled');
  await act(async () => env.dateField().props.onPress());
  await act(async () => env.pickerCalls[0].onValueChange({}, localDate('2000-02-29')));
  await act(async () => env.button('Simpan Profil').props.onPress());
  assert.match(env.alerts.at(-1)[0], /Gagal menyimpan/);
  assert.equal(env.saves[0].birth_date, '2000-02-29');
  assert.equal(env.navigations.length, 0);
  assert.equal(env.button('Simpan Profil').props.disabled, false);
  assert.match(text(env.tree.root), /29 Februari 2000/);
  env.saveThrows = false;
  await act(async () => env.button('Simpan Profil').props.onPress());
  assert.equal(env.saves[1].birth_date, '2000-02-29');
  assert.equal(env.saves[1].full_name, 'Demo');
  assert.equal(env.saves[1].gender, 'male');
  assert.equal(env.saves[1].phone, '+62 812345678');
  assert.equal(env.alerts.at(-1)[0], 'Berhasil');
  await act(async () => env.alerts.at(-1)[2][0].onPress());
  assert.deepEqual(env.navigations, ['back']);
});

test('Edit Profile preserves load-error retry and rejects empty/invalid/future birth dates at save', async (t) => {
  const env = await mount(t, 'src/app/edit-profile.tsx', { loadError: new Error('offline') });
  assert.match(text(env.tree.root), /Profil belum dapat dimuat/);
  env.loadError = null;
  env.profile.birth_date = '';
  await act(async () => env.button('Coba Lagi').props.onPress());
  await act(async () => env.button('Simpan Profil').props.onPress());
  assert.equal(env.saves.length, 0);
  assert.equal(env.alerts.at(-1)[0], 'Tanggal lahir tidak valid');
  for (const birthDate of ['2001-02-29', '9999-01-01']) {
    const invalid = await mount(t, 'src/app/edit-profile.tsx', { profile: { ...env.profile, birth_date: birthDate } });
    await act(async () => invalid.button('Simpan Profil').props.onPress());
    assert.equal(invalid.saves.length, 0);
    assert.equal(invalid.alerts.at(-1)[0], 'Tanggal lahir tidak valid');
  }
});

for (const fontScale of [1, 1.5, 2]) {
  for (const [width, height, bottom] of [[360, 800, 24], [320, 480, 48]]) {
    test(`Landing uses a centered flexible group with scroll fallback at ${width}x${height}, fontScale ${fontScale}`, async (t) => {
      const env = await mount(t, 'src/app/index.tsx', {
        dimensions: { width, height, fontScale, scale: 1 }, insets: { top: 24, bottom, left: 0, right: 0 },
      });
      const scroll = env.tree.root.findByType('ScrollView');
      const content = flatten(scroll.props.contentContainerStyle);
      assert.equal(content.flexGrow, 1);
      assert.equal(content.justifyContent, 'center');
      assert.equal(content.height, undefined, 'content is never constrained to a fixed viewport height');
      assert.equal(content.width, '100%');
      assert.ok(content.maxWidth <= 480);
      assert.ok(content.gap >= 12 && content.gap <= 24);
      assert.notEqual(scroll.props.scrollEnabled, false, 'small screens and large fonts can still scroll');
      const logo = env.tree.root.findByType('Image');
      assert.equal(logo.props.resizeMode, 'contain');
      assert.equal(flatten(logo.props.style).aspectRatio, 1);
      assert.equal(flatten(logo.parent.props.style).position, undefined);
      assert.ok(flatten(logo.parent.props.style).aspectRatio > 1, 'frame removes internal white space without resizing the asset');
      assert.equal(scroll.findAllByType('Pressable').length, 2);
      for (const button of scroll.findAllByType('Pressable')) {
        assert.ok(flatten(button.props.style).minHeight >= 48);
        assert.equal(flatten(button.props.style).height, undefined);
      }
      await act(async () => env.button('Sign Up').props.onPress());
      await act(async () => env.button('Log In').props.onPress());
      assert.deepEqual(env.navigations, ['./register', './login']);
    });
  }
}

test('Updated native asset references exist and SDK 57 resolves white splash for Android light and dark', () => {
  const app = readJson('app.json').expo;
  assert.equal(app.icon, './assets/images/icon.png');
  const adaptive = app.android.adaptiveIcon;
  assert.equal(adaptive.foregroundImage, './assets/images/android-icon-foreground.png');
  assert.equal(adaptive.backgroundImage, './assets/images/android-icon-background.png');
  assert.equal(adaptive.monochromeImage, './assets/images/android-icon-monochrome.png');
  const splash = app.plugins.find((plugin) => plugin[0] === 'expo-splash-screen')[1];
  // Use the installed SDK resolver. Do not run prebuild or generate any image.
  const pluginRoot = path.dirname(require.resolve('expo-splash-screen/package.json'));
  const { getAndroidSplashConfig } = require(path.join(pluginRoot, 'plugin/build/getAndroidSplashConfig.js'));
  const resolved = getAndroidSplashConfig(splash);
  assert.equal(resolved.backgroundColor, '#FFFFFF');
  assert.equal(resolved.dark.backgroundColor, '#FFFFFF');
  assert.equal(resolved.image, './assets/images/splash-icon.png');
  assert.equal(resolved.dark.image, './assets/images/splash-icon.png');
  assert.equal(resolved.imageWidth, 76);
  assert.equal(resolved.resizeMode, 'contain');
  for (const asset of [app.icon, ...['foregroundImage', 'backgroundImage', 'monochromeImage'].map((key) => adaptive[key]), resolved.image, './assets/images/Logo.png', './assets/images/panduan-scan.png']) {
    const png = readFileSync(path.join(root, asset));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0);
  }
  const statusBar = app.plugins.find((plugin) => plugin[0] === 'expo-status-bar')[1];
  assert.equal(statusBar.style, 'dark', 'white app screens need dark status icons in system dark mode too');
  assert.equal(statusBar.hidden, false);
  const pkg = readJson('package.json');
  const bundled = readJson('node_modules/expo/bundledNativeModules.json');
  assert.equal(pkg.dependencies['@react-native-community/datetimepicker'], bundled['@react-native-community/datetimepicker']);
  assert.equal(app.android.versionCode, 2);
  assert.equal(app.android.package, 'com.ucupysteam.melanosense');
  assert.equal(app.scheme, 'melanosense');
  assert.equal(app.owner, 'ucupys-team');
  assert.equal(app.extra.eas.projectId, '54881a16-5f3a-4bdb-b182-0a199a16cc30');
  const eas = readJson('eas.json');
  assert.equal(eas.build.base.corepack, false);
  assert.equal(eas.build.base.credentialsSource, 'remote');
  assert.equal(eas.build.preview.environment, 'preview');
  assert.equal(eas.build.preview.android.buildType, 'apk');
});

test('Guide retains latest device image with contain and Pi-triggered scan instructions', async (t) => {
  const env = await mount(t, 'src/app/guide.tsx');
  const image = env.tree.root.findByType('Image');
  assert.equal(image.props.source, path.join(root, 'assets/images/panduan-scan.png'));
  assert.equal(image.props.resizeMode, 'contain');
  assert.equal(flatten(image.props.style).width, '100%');
  assert.ok(flatten(image.props.style).height <= 180);
  for (const phrase of ['Lengkapi profil', 'Raspberry Pi membaca QR', 'layar menunggu hasil', 'tombol fisik', 'Enter', 'Supabase']) {
    assert.ok(text(env.tree.root).includes(phrase));
  }
});
