// Run: node --test tests/scan-observer.test.cjs
// Uses installed TypeScript + React renderer; no network or real database writes.
/* global __dirname */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function loadSource(file, mocks, globals = {}) {
  const filename = path.join(__dirname, '..', file);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: false,
    },
    fileName: filename,
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, AbortController, console,
    require: (id) => id in mocks ? mocks[id] : require(id),
    ...globals,
  }, { filename });
  return exports;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const scan = (id, seconds = 1, extra = {}) => ({
  id, user_id: 'user-a', status: 'completed',
  created_at: `2026-09-15T00:00:0${seconds}.000Z`, ...extra,
});
const baseline = scan('SCAN_C');
const nextScan = scan('SCAN_D', 2);
const result = (value) => ({ scan: value, error: null });

async function mount(t, options = {}) {
  const env = {
    focused: true, navigations: [], calls: [], removed: [], alerts: [], disconnectCalls: 0, qrRenders: 0,
    results: [...(options.results ?? [])], timers: new Map(),
    auth: { data: { user: { id: 'user-a' } }, error: null },
    latest: baseline, ...options,
  };
  const appState = {
    currentState: 'active',
    addEventListener: (_event, callback) => {
      env.resume = callback;
      return { remove: () => { env.resume = undefined; } };
    },
  };
  const channel = {
    on: (type, filter, callback) => {
      env.filter = filter;
      env.insert = callback;
      return channel;
    },
    subscribe: (callback) => { env.status = callback; return channel; },
  };
  const supabase = {
    auth: { getUser: async () => env.auth },
    channel: () => {
      if (env.subscriptionThrows) throw new Error('Transport unavailable');
      return channel;
    },
    removeChannel: async (value) => { env.removed.push(value); },
  };
  const mocks = {
    'react-native': {
      AppState: appState, StyleSheet: { create: (value) => value },
      Text: 'Text', View: 'View', ActivityIndicator: 'ActivityIndicator',
      ScrollView: 'ScrollView', RefreshControl: 'RefreshControl', Alert: { alert: (...args) => env.alerts.push(args) },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': {
      router: {
        replace: (target) => env.navigations.push(target),
        push: (target) => env.navigations.push(target),
        back: () => { env.focused = false; }, canGoBack: () => true,
      },
      useFocusEffect: (effect) => {
        const focused = env.focused;
        React.useEffect(() => focused ? effect() : undefined, [effect, focused]);
      },
    },
    '../components/Button': { default: 'Button' },
    '../components/ProcessLoader': { default: 'ProcessLoader' },
    '../components/header': { default: 'Header' },
    'react-native-qrcode-svg': { default: (props) => {
      env.qrRenders += 1;
      return React.createElement('QRCode', props);
    } },
    '../lib/supabase': { supabase },
    '../services/scanServices': {
      getLatestScanForUser: async (userId, signal) => {
        env.calls.push({ userId, signal });
        return env.results.length ? env.results.shift() : result(env.latest);
      },
    },
    '../services/profileServices': {
      getCurrentUserProfile: async () => ({ profile: env.profile, error: null }),
    },
    '../services/deviceServices': { disconnectCurrentDevice: async () => {
      env.disconnectCalls += 1;
      return env.disconnectResult ?? { error: null };
    } },
  };
  const Component = loadSource(options.home ? 'src/app/home.tsx' : 'src/app/process.tsx', mocks, {
    setInterval: (callback, interval) => {
      const timer = Symbol('interval');
      env.timers.set(timer, { callback, interval });
      return timer;
    },
    clearInterval: (timer) => env.timers.delete(timer),
  }).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Component)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  env.tree = tree;
  env.tick = () => act(async () => {
    for (const { callback } of env.timers.values()) callback();
  });
  env.emit = (value) => act(async () => env.insert({ new: value }));
  env.blur = () => act(async () => {
    env.focused = false;
    tree.update(React.createElement(Component));
  });
  env.appState = appState;
  return env;
}

test('Existing history and elapsed polling intervals never finish a scan', async (t) => {
  const env = await mount(t);
  for (let index = 0; index < 10; index++) await env.tick();
  await env.emit(baseline);
  env.latest = scan('SCAN_B', 0);
  await env.tick();
  assert.equal(env.navigations.length, 0);
  assert.equal(env.tree.root.findByType('ProcessLoader').props.message, 'Menunggu hasil pemeriksaan...');
  assert.equal([...env.timers.values()][0].interval, 2500);
});

test('Realtime filters the user and opens the completed new scan immediately', async (t) => {
  const env = await mount(t);
  assert.equal(env.filter.event, 'INSERT');
  assert.equal(env.filter.table, 'scans');
  assert.equal(env.filter.filter, 'user_id=eq.user-a');
  await env.emit(scan('OTHER', 2, { user_id: 'user-b' }));
  await env.emit(scan('PENDING', 2, { status: 'pending' }));
  assert.equal(env.navigations.length, 0);
  await env.emit(nextScan);
  assert.equal(env.navigations.length, 1);
  assert.equal(env.navigations[0].pathname, '/history/[id]');
  assert.equal(env.navigations[0].params.id, 'SCAN_D');
  assert.equal(env.timers.size, 0);
  assert.equal(env.removed.length, 1);
});

for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'NEVER_SUBSCRIBED', 'THROWS']) {
  test(`Polling works when Realtime ${status}`, async (t) => {
    const env = await mount(t, { subscriptionThrows: status === 'THROWS' });
    if (env.status) await act(async () => env.status(status));
    env.results.push({ scan: null, error: new Error('Temporary network failure') });
    await env.tick();
    assert.equal(env.navigations.length, 0);
    env.latest = nextScan;
    await env.tick();
    assert.equal(env.navigations[0].params.id, 'SCAN_D');
  });
}

test('SUBSCRIBED catch-up finds an INSERT missed after baseline', async (t) => {
  const env = await mount(t);
  env.latest = nextScan;
  await act(async () => env.status('SUBSCRIBED'));
  assert.equal(env.navigations[0].params.id, 'SCAN_D');
});

test('Initial catch-up finds a scan inserted before Realtime is ready', async (t) => {
  const env = await mount(t, { results: [result(baseline), result(nextScan)] });
  assert.equal(env.navigations.length, 1);
  assert.equal(env.navigations[0].params.id, 'SCAN_D');
});

for (const first of ['realtime', 'polling']) {
  test(`Realtime/polling race navigates once when ${first} wins`, async (t) => {
    const env = await mount(t);
    const inFlight = deferred();
    env.results.push(inFlight.promise);
    await env.tick();
    if (first === 'realtime') await env.emit(nextScan);
    await act(async () => inFlight.resolve(result(nextScan)));
    await env.emit(nextScan);
    assert.equal(env.navigations.length, 1);
    assert.equal(env.removed.length, 1);
  });
}

test('Blur cancels polling/channel and ignores in-flight requests and late INSERTs', async (t) => {
  const env = await mount(t);
  const inFlight = deferred();
  env.results.push(inFlight.promise);
  await env.tick();
  await env.blur();
  await act(async () => inFlight.resolve(result(nextScan)));
  await env.emit(nextScan);
  assert.equal(env.navigations.length, 0);
  assert.equal(env.timers.size, 0);
  assert.equal(env.removed.length, 1);
  assert.equal(env.calls.at(-1).signal.aborted, true);
});

test('Leaving during baseline cannot start an observer later', async (t) => {
  const pending = deferred();
  const env = await mount(t, { results: [pending.promise] });
  await env.blur();
  await act(async () => pending.resolve(result(baseline)));
  assert.equal(env.insert, undefined);
  assert.equal(env.timers.size, 0);
  assert.equal(env.navigations.length, 0);
});

test('Unmount ignores a late INSERT and removes the active observer', async (t) => {
  const env = await mount(t);
  await act(async () => env.tree.unmount());
  await env.emit(nextScan);
  assert.equal(env.navigations.length, 0);
  assert.equal(env.timers.size, 0);
  assert.equal(env.removed.length, 1);
});

test('Baseline error shows Retry and recovers without treating history as new', async (t) => {
  const env = await mount(t, { results: [{ scan: null, error: new Error('Offline') }] });
  assert.equal(env.timers.size, 0);
  const retry = env.tree.root.findAllByType('Button').find((button) => button.props.title === 'Coba Lagi');
  assert.ok(retry);
  await act(async () => retry.props.onPress());
  assert.equal(env.navigations.length, 0);
  await env.emit(nextScan);
  assert.equal(env.navigations.length, 1);
});

test('Missing auth user shows an error without querying scans', async (t) => {
  const env = await mount(t, { auth: { data: { user: null }, error: null } });
  assert.equal(env.calls.length, 0);
  assert.equal(env.timers.size, 0);
  assert.ok(JSON.stringify(env.tree.toJSON()).includes('Sesi login tidak tersedia'));
});

test('Auth lookup failure offers Retry without subscribing', async (t) => {
  const env = await mount(t, {
    auth: { data: { user: null }, error: new Error('Auth unavailable') },
  });
  assert.equal(env.calls.length, 0);
  assert.equal(env.insert, undefined);
  assert.ok(env.tree.root.findAllByType('Button').some((button) => button.props.title === 'Coba Lagi'));
});

test('Empty history can observe the first scan', async (t) => {
  const env = await mount(t, { latest: null });
  assert.equal(env.navigations.length, 0);
  env.latest = nextScan;
  await env.tick();
  assert.equal(env.navigations[0].params.id, 'SCAN_D');
});

test('Background pauses queries/navigation; foreground catches up with the same baseline', async (t) => {
  const env = await mount(t);
  env.appState.currentState = 'background';
  const queries = env.calls.length;
  env.latest = nextScan;
  await env.tick();
  await env.emit(nextScan);
  assert.equal(env.calls.length, queries);
  assert.equal(env.navigations.length, 0);
  env.appState.currentState = 'active';
  await act(async () => env.resume('active'));
  assert.equal(env.navigations[0].params.id, 'SCAN_D');
});

for (const connected of [false, true]) {
  test(`Complete Home profile offers raw QR + same Process route when connected=${connected}`, async (t) => {
    const env = await mount(t, {
      home: true,
      profile: {
        id: 'user-a', full_name: 'User', phone: '123', birth_date: '2000-01-01',
        gender: 'male', device_token: 'raw-pairing-token', is_currently_connected: connected,
      },
    });
    assert.equal(env.tree.root.findByType('QRCode').props.value, 'raw-pairing-token');
    const start = env.tree.root.findAllByType('Button').filter((button) => button.props.title === 'Mulai Pemeriksaan');
    assert.equal(start.length, 1);
    await act(async () => start[0].props.onPress());
    assert.equal(env.navigations[0], '/process');
  });
}

test('Incomplete Home profile cannot start an examination', async (t) => {
  const env = await mount(t, { home: true, profile: { id: 'user-a', full_name: 'User' } });
  const titles = env.tree.root.findAllByType('Button').map((button) => button.props.title);
  assert.ok(titles.includes('Lengkapi Profil'));
  assert.ok(!titles.includes('Mulai Pemeriksaan'));
});

test('Pairing QR fits its measured container with a quiet zone and skips unchanged-token polling renders', async (t) => {
  const env = await mount(t, {
    home: true,
    profile: {
      id: 'user-a', full_name: 'Long profile name', phone: '123', birth_date: '2000-01-01',
      gender: 'male', device_token: 'raw-pairing-token', is_currently_connected: false,
    },
  });
  const container = env.tree.root.findAllByType('View').find((item) => item.props.onLayout);
  for (const width of [244, 224, 272]) {
    await act(async () => container.props.onLayout({ nativeEvent: { layout: { width } } }));
    const qr = env.tree.root.findByType('QRCode');
    assert.equal(qr.props.value, 'raw-pairing-token');
    assert.equal(qr.props.quietZone, 12);
    assert.ok(qr.props.size + 2 * qr.props.quietZone <= width);
  }
  const renders = env.qrRenders;
  env.profile = { ...env.profile, full_name: 'Updated profile name' };
  await env.tick();
  assert.equal(env.qrRenders, renders);
  env.profile = { ...env.profile, device_token: 'rotated-raw-token' };
  await env.tick();
  assert.equal(env.tree.root.findByType('QRCode').props.value, 'rotated-raw-token');
  assert.equal(env.qrRenders, renders + 1);
});

test('Home disconnect confirmation stays guarded and refreshes the rotated pairing token', async (t) => {
  const pending = deferred();
  const env = await mount(t, {
    home: true, disconnectResult: pending.promise,
    profile: {
      id: 'user-a', full_name: 'User', phone: '123', birth_date: '2000-01-01',
      gender: 'male', device_token: 'old-token', is_currently_connected: true,
    },
  });
  const button = env.tree.root.findAllByType('Button').find((item) => item.props.title === 'Putuskan Sambungan');
  await act(async () => { button.props.onPress(); button.props.onPress(); });
  assert.equal(env.alerts.length, 1);
  const confirm = env.alerts[0][2].find((item) => item.text === 'Putuskan');
  await act(async () => { confirm.onPress(); confirm.onPress(); });
  assert.equal(env.disconnectCalls, 1);
  assert.equal(env.tree.root.findAllByType('Button').find((item) => item.props.title === 'Memutuskan...').props.disabled, true);
  env.profile = { ...env.profile, device_token: 'new-token', is_currently_connected: false };
  await act(async () => { pending.resolve({ error: null }); });
  assert.equal(env.tree.root.findByType('QRCode').props.value, 'new-token');
  assert.ok(env.tree.root.findAllByType('Button').some((item) => item.props.title === 'Mulai Pemeriksaan'));
  assert.equal(env.tree.root.findAllByType('Button').some((item) => item.props.title === 'Putuskan Sambungan'), false);
});

test('Process waiting instructions and back action share a scrollable safe-area viewport', async (t) => {
  const env = await mount(t);
  const scroll = env.tree.root.findByType('ScrollView');
  assert.equal(env.tree.root.findByType('SafeAreaView').props.edges.join(','), 'top,left,right');
  assert.equal(scroll.props.contentContainerStyle.flexGrow, 1);
  assert.ok(scroll.findAllByType('ProcessLoader').length === 1);
  const back = scroll.findAllByType('Button').find((item) => item.props.title === 'Kembali');
  assert.ok(back);
  await act(async () => back.props.onPress());
  assert.equal(env.focused, false);
  await env.blur();
  await env.emit(nextScan);
  assert.equal(env.navigations.length, 0);
});

test('Latest scan service reads only one ordered row for the authenticated user', async () => {
  const calls = [];
  const query = {};
  for (const name of ['select', 'eq', 'order', 'limit', 'abortSignal']) {
    query[name] = (...args) => { calls.push([name, ...args]); return query; };
  }
  query.maybeSingle = async () => ({ data: baseline, error: null });
  const { getLatestScanForUser } = loadSource('src/services/scanServices.ts', {
    '../lib/supabase': { supabase: { from: (table) => { assert.equal(table, 'scans'); return query; } } },
  });
  const { scan: value } = await getLatestScanForUser('user-a', new AbortController().signal);
  assert.equal(value.id, 'SCAN_C');
  assert.ok(calls.some(([method, column, user]) => method === 'eq' && column === 'user_id' && user === 'user-a'));
  assert.ok(calls.some(([method, column, order]) => method === 'order' && column === 'created_at' && order.ascending === false));
  assert.ok(calls.some(([method, limit]) => method === 'limit' && limit === 1));
  assert.ok(calls.some(([method]) => method === 'abortSignal'));
});
