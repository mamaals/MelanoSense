// Run: node --test tests/history-reporting.test.cjs
// Native image, print, and mail bridges are mocked; no emails or DB writes.
/* global __dirname */
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function loadSource(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false,
    },
    fileName: filename,
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, console,
    require: (id) => {
      if (id in mocks) return mocks[id];
      if (id.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), id);
        return loadSource(['.ts', '.tsx'].map((ext) => base + ext).find(existsSync), mocks);
      }
      return require(id);
    },
  }, { filename });
  return exports;
}

const formatters = loadSource('src/utils/scanFormatters.ts');
for (const [input, expected] of [
  [0, '0%'], [0.5, '50%'], [0.917, '91.7%'], [1, '100%'],
  ...[null, undefined, NaN, Infinity, -Infinity, -0.1, 1.2].map((value) => [value, 'Data tidak tersedia']),
]) {
  test(`Confidence ${String(input)} -> ${expected}`, () => {
    assert.equal(formatters.formatConfidence(input), expected);
  });
}

for (const [input, expected] of [
  ['non_melanoma', 'Non Melanoma'], ['melanoma', 'Melanoma'],
  ['risk_detected', 'Risiko Terdeteksi'], ['low_risk', 'Risiko Rendah'],
  [null, 'Hasil belum tersedia'], ['unknown', 'Hasil belum tersedia'],
]) {
  test(`Diagnosis ${String(input)} -> ${expected}`, () => {
    assert.equal(formatters.formatDiagnosis(input), expected);
  });
}

test('Status labels and nullable clinical text have safe fallbacks', () => {
  assert.equal(formatters.formatStatus('completed'), 'Selesai');
  assert.equal(formatters.formatStatus('pending'), 'Diproses');
  for (const value of [null, undefined, '', '  ', 'NaN', 'null', 'undefined']) {
    assert.equal(formatters.formatDataValue(value), 'Data tidak tersedia');
  }
  assert.equal(formatters.formatDataValue(' Stage I (experimental estimate) '), 'Stage I (experimental estimate)');
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const row = (id, diagnosis = 'non_melanoma') => ({
  id, diagnosis, status: 'completed', created_at: '2026-09-15T09:30:00Z',
});
const historyResult = (scans, count = scans.length) => ({ scans, count, error: null });
const detailScan = {
  ...row('SCAN_D'), user_id: 'user-a', image_url: 'user-a/scan.jpg',
  confidence: 0.917, asymmetry: 'A data', border: 'B data', color: 'C data',
  diameter: 'D data', stage: 'Stage I (experimental estimate)', recommendation: 'Backend recommendation',
};

function allText(node) {
  return node.findAllByType('Text').map((text) => text.children.filter((child) => typeof child === 'string').join('')).join('\n');
}

async function mount(t, options = {}) {
  const env = {
    focused: true, historyResults: [], historyCalls: [], scan: detailScan,
    imageResult: { imageUrl: 'https://example.test/signed.jpg', error: null },
    printed: [], shared: [], mails: [], alerts: [], ...options,
  };
  function FlatList(props) {
    return React.createElement('FlatList', props,
      props.refreshControl,
      props.data.length ? props.data.map((item) => React.createElement(React.Fragment, { key: item.id }, props.renderItem({ item }))) : props.ListEmptyComponent,
      props.ListFooterComponent);
  }
  const services = {
    getCurrentUserScanHistory: async (params) => {
      env.historyCalls.push(params);
      return env.historyResults.length ? env.historyResults.shift() : historyResult([row('SCAN_C')], 6);
    },
    getScanById: async () => ({ scan: env.scan, error: null }),
    getScanImageUrl: async () => env.imageResult,
  };
  const mocks = {
    'react-native': {
      StyleSheet: { create: (value) => value }, FlatList,
      useWindowDimensions: () => ({ width: options.width ?? 360, fontScale: options.fontScale ?? 1 }),
      Text: 'Text', View: 'View', ActivityIndicator: 'ActivityIndicator',
      ScrollView: 'ScrollView', RefreshControl: 'RefreshControl', Pressable: 'Pressable',
      Alert: { alert: (...args) => env.alerts.push(args) },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) },
    'expo-router': {
      useLocalSearchParams: () => ({ id: env.scan.id }),
      router: { back() {}, push() {} },
      useFocusEffect: (effect) => {
        const focused = env.focused;
        React.useEffect(() => focused ? effect() : undefined, [effect, focused]);
      },
    },
    'expo-image': { Image: 'Image' },
    'lucide-react-native': Object.fromEntries([
      'ArrowLeft', 'ChevronDown', 'ChevronUp', 'CircleAlert', 'CircleCheck', 'CircleHelp', 'Download', 'Mail',
    ].map((name) => [name, name])),
    'expo-print': {
      printToFileAsync: async ({ html }) => { env.printed.push(html); return { uri: 'file:///report.pdf' }; },
    },
    'expo-sharing': {
      isAvailableAsync: async () => true,
      shareAsync: async (...args) => env.shared.push(args),
    },
    'expo-mail-composer': {
      isAvailableAsync: async () => true,
      composeAsync: async (args) => env.mails.push(args),
    },
    '../../lib/supabase': { supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'user-a', email: 'current@example.test' } }, error: null }) },
    } },
    '../services/scanServices': services,
    '../../services/scanServices': services,
  };
  const Component = loadSource(options.history ? 'src/app/history.tsx' : 'src/app/history/[id].tsx', mocks).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Component)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  env.tree = tree;
  env.text = () => allText(tree.root);
  env.press = (label) => act(async () => {
    const button = tree.root.findAllByType('Pressable').find((item) =>
      item.props.accessibilityLabel === label || allText(item) === label);
    assert.ok(button, `Missing button ${label}`);
    await button.props.onPress();
  });
  env.refresh = () => act(async () => tree.root.findByType('RefreshControl').props.onRefresh());
  env.rows = () => tree.root.findByType('FlatList').props.data;
  return env;
}

test('History service keeps authenticated-user filtering and server-side pagination', async () => {
  const calls = [];
  const query = {};
  for (const name of ['select', 'eq', 'order']) {
    query[name] = (...args) => { calls.push([name, ...args]); return query; };
  }
  query.range = async (...args) => {
    calls.push(['range', ...args]); return { data: [row('SCAN_B')], count: 8, error: null };
  };
  const { getCurrentUserScanHistory } = loadSource('src/services/scanServices.ts', {
    '../lib/supabase': { supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }) },
      from: (table) => { assert.equal(table, 'scans'); return query; },
    } },
  });
  const response = await getCurrentUserScanHistory({ page: 2, pageSize: 3 });
  assert.equal(response.count, 8);
  assert.equal(response.scans[0].diagnosis, 'non_melanoma');
  assert.ok(calls.some(([method, columns, options]) => method === 'select' && columns.includes('diagnosis') && options.count === 'exact'));
  assert.ok(calls.some(([method, column, value]) => method === 'eq' && column === 'user_id' && value === 'user-a'));
  assert.ok(calls.some(([method, column, options]) => method === 'order' && column === 'created_at' && options.ascending === false));
  assert.ok(calls.some(([method, from, to]) => method === 'range' && from === 3 && to === 5));
});

test('History shows diagnosis/date/time and refresh replaces page 2 with page 1', async (t) => {
  const env = await mount(t, { history: true });
  assert.ok(env.text().includes('Non Melanoma'));
  assert.ok(!env.text().includes('completed'));
  assert.match(env.rows()[0].date, /\d{2}[.:]\d{2}/);
  await env.press('Halaman berikutnya');
  assert.equal(env.historyCalls.at(-1).page, 2);
  env.historyResults.push(historyResult([row('SCAN_D', 'melanoma'), row('SCAN_C')]));
  await env.refresh();
  assert.equal(env.historyCalls.at(-1).page, 1);
  assert.equal(env.rows().map((item) => item.id).join(','), 'SCAN_D,SCAN_C');
  assert.equal(new Set(env.rows().map((item) => item.id)).size, 2);
  assert.ok(env.text().includes('Melanoma'));
  assert.equal(env.tree.root.findByType('RefreshControl').props.refreshing, false);
});

test('A stale refresh response cannot overwrite newer rows or reset the spinner', async (t) => {
  const env = await mount(t, { history: true });
  const old = deferred(), latest = deferred();
  env.historyResults.push(old.promise, latest.promise);
  await env.refresh();
  await env.refresh();
  await act(async () => old.resolve(historyResult([row('STALE')])));
  assert.equal(env.tree.root.findByType('RefreshControl').props.refreshing, true);
  await act(async () => latest.resolve(historyResult([row('NEW')])));
  assert.equal(env.rows().map((item) => item.id).join(','), 'NEW');
  assert.equal(env.historyCalls.at(-1).page, 1);
});

test('Refresh after an empty history can load newly inserted rows', async (t) => {
  const env = await mount(t, { history: true, historyResults: [historyResult([])] });
  assert.ok(env.text().includes('Belum ada histori pemeriksaan.'));
  await env.refresh();
  assert.equal(env.rows().length, 1);
});

test('Detail, PDF and email attachment share labels, confidence and escaped backend text', async (t) => {
  const env = await mount(t, { scan: { ...detailScan, recommendation: '<script>& "quoted"' } });
  await env.press('Tampilkan Analisis Lengkap');
  assert.ok(env.text().includes('91.7%'));
  assert.ok(!env.text().includes('0.917%'));
  assert.ok(env.text().includes('Non Melanoma'));
  assert.equal(env.tree.root.findByType('CircleCheck').props.color, '#2EAF62');
  await env.press('Unduh Hasil');
  const html = env.printed[0];
  for (const value of ['Non Melanoma', 'Selesai', '91.7%', 'A data', 'B data', 'C data', 'D data', detailScan.stage]) {
    assert.ok(html.includes(value), `Missing PDF value ${value}`);
  }
  assert.ok(html.includes('&lt;script&gt;&amp; &quot;quoted&quot;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('tidak menggantikan'));
  await env.press('Kirim Email');
  assert.equal(env.printed[1], html);
  assert.equal(env.mails[0].recipients.join(','), 'current@example.test');
  assert.equal(env.mails[0].attachments[0], 'file:///report.pdf');
});

for (const [diagnosis, status, icon] of [
  ['melanoma', 'completed', 'CircleAlert'], ['risk_detected', 'completed', 'CircleAlert'],
  ['unknown', 'completed', 'CircleHelp'], ['melanoma', 'pending', 'CircleHelp'],
]) {
  test(`Diagnosis visual ${diagnosis}/${status} uses ${icon}`, async (t) => {
    const env = await mount(t, { scan: { ...detailScan, diagnosis, status } });
    await env.press('Tampilkan Analisis Lengkap');
    assert.equal(env.tree.root.findAllByType(icon).length, 1);
  });
}

test('Null clinical fields and invalid confidence are safe in detail and PDF', async (t) => {
  const env = await mount(t, { scan: {
    ...detailScan, image_url: null, diagnosis: null, status: null,
    asymmetry: null, border: '', color: undefined, diameter: ' ',
    stage: null, recommendation: null, confidence: NaN,
  } });
  await env.press('Tampilkan Analisis Lengkap');
  assert.ok(env.text().includes('Data tidak tersedia'));
  assert.ok(env.text().includes('Hasil belum tersedia'));
  assert.ok(!/NaN|undefined|null/.test(env.text()));
  await env.press('Unduh Hasil');
  assert.ok(env.printed[0].includes('Data tidak tersedia'));
  assert.ok(!/NaN|undefined|null/.test(env.printed[0]));
});

test('Slow signed URL and image download do not block detail, then image errors fall back', async (t) => {
  const pendingImage = deferred();
  const env = await mount(t, { imageResult: pendingImage.promise });
  assert.ok(env.text().includes('Analisis ABCD'));
  assert.ok(env.text().includes('Memuat gambar...'));
  await env.press('Unduh Hasil');
  assert.equal(env.printed.length, 1);
  await act(async () => pendingImage.resolve({ imageUrl: 'https://example.test/photo.jpg', error: null }));
  await act(async () => env.tree.root.findByType('Image').props.onError());
  assert.ok(env.text().includes('Gambar tidak tersedia.'));
  assert.ok(env.text().includes('Analisis ABCD'));
  assert.equal(env.alerts.length, 0);
});

test('Signed URL failure keeps detail and PDF available', async (t) => {
  const env = await mount(t, { imageResult: { imageUrl: null, error: new Error('Storage unavailable') } });
  assert.ok(env.text().includes('Gambar tidak tersedia.'));
  await env.press('Unduh Hasil');
  assert.equal(env.printed.length, 1);
  assert.equal(env.alerts.length, 0);
});

for (const [width, fontScale, stacked] of [[320, 1, true], [360, 1, false], [412, 1.5, true]]) {
  test(`Detail conclusion adapts at ${width}dp/fontScale ${fontScale} and keeps PDF/email in the scroll content`, async (t) => {
    const env = await mount(t, {
      width, fontScale,
      scan: { ...detailScan, recommendation: 'Long recommendation '.repeat(25) },
    });
    await env.press('Tampilkan Analisis Lengkap');
    const scroll = env.tree.root.findByType('ScrollView');
    const icon = env.tree.root.findByType('CircleCheck');
    const row = icon.parent.parent;
    const style = Object.assign({}, ...[row.props.style].flat(Infinity).filter(Boolean));
    assert.equal(style.flexDirection, stacked ? 'column' : 'row');
    assert.ok(allText(scroll).includes('Long recommendation '.repeat(25).trim()));
    assert.ok(allText(scroll).includes('Unduh Hasil'));
    assert.ok(allText(scroll).includes('Kirim Email'));
    assert.equal(scroll.props.contentContainerStyle.paddingBottom, 24, 'navbar has its own layout space');
    await env.press('Kirim Email');
    assert.equal(env.mails.length, 1);
  });
}

test('History pagination stays inside the FlatList scroll footer', async (t) => {
  const env = await mount(t, { history: true });
  const list = env.tree.root.findByType('FlatList');
  assert.ok(list.props.ListFooterComponent);
  assert.equal(list.findAllByType('Pressable').filter((item) => item.props.accessibilityLabel === 'Halaman berikutnya').length, 1);
  await env.press('Halaman berikutnya');
  assert.equal(env.historyCalls.at(-1).page, 2);
  assert.equal(env.historyCalls.at(-1).pageSize, 3);
});
