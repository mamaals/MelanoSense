// Structural and interaction tests; native keyboard/layout and device performance need device QA.
/* global __dirname */
const assert = require('node:assert/strict');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '..');
const flatten = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const text = (node) => node.findAllByType('Text').map((item) => item.children.filter((child) => typeof child === 'string').join('')).join('\n');

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function createLoader(mocks) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename);
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false },
      fileName: filename,
    }).outputText;
    const exports = {};
    cache.set(filename, exports);
    vm.runInNewContext(source, {
      exports, console,
      require: (id) => {
        if (id in mocks) return mocks[id];
        if (id.startsWith('.') || id.startsWith('@/')) {
          const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(filename), id);
          if (/\.(png|ttf)$/.test(base)) return base;
          const target = ['.ts', '.tsx'].map((ext) => base + ext).find(existsSync);
          assert.ok(target, `Unresolved local import ${id} in ${filename}`);
          return load(target);
        }
        return require(id);
      },
    }, { filename });
    return exports;
  }
  return load;
}

async function mount(t, file, options = {}) {
  const env = {
    pathname: '/home', fontsLoaded: true, authCalls: [], oauthCalls: [], navigations: [], alerts: [],
    session: { user: { id: 'user-a' } }, requests: [], stack: ['/home'], navMethods: [], insets: { top: 24, bottom: 24, left: 0, right: 0 },
    ...options,
  };
  const auth = {
    AuthProvider: ({ children }) => children,
    useAuth: () => ({
      session: env.session, authStatus: env.session ? 'AUTHENTICATED' : 'UNAUTHENTICATED',
      initializing: false,
      signInWithPassword: (...args) => { env.authCalls.push(args); return env.requests.shift().promise; },
      signUpWithPassword: (args) => { env.authCalls.push(args); return env.requests.shift().promise; },
      signInWithOAuth: async (provider) => { env.oauthCalls.push(provider); },
    }),
  };
  const Stack = (props) => React.createElement('Stack', props, props.children);
  Stack.Screen = 'Screen';
  Stack.Protected = ({ guard, children }) => guard ? children : null;
  const mocks = {
    'react-native': {
      ...Object.fromEntries(['Text', 'View', 'ScrollView', 'KeyboardAvoidingView', 'Pressable', 'TextInput', 'Image', 'TouchableOpacity', 'ActivityIndicator'].map((name) => [name, name])),
      StyleSheet: { create: (styles) => styles }, Platform: { OS: env.os ?? 'android' }, Alert: { alert: (...args) => env.alerts.push(args) },
      useWindowDimensions: () => ({ width: 360, height: 800, fontScale: 1, scale: 1 }),
    },
    'react-native-safe-area-context': {
      SafeAreaView: 'SafeAreaView', SafeAreaProvider: 'SafeAreaProvider', useSafeAreaInsets: () => env.insets,
    },
    'expo-router': {
      Stack, usePathname: () => env.pathname,
      router: {
        replace: (route) => { env.navigations.push(route); env.pathname = route; },
        dismissTo: (route) => {
          env.navMethods.push('dismissTo');
          env.navigations.push(route);
          const index = env.stack.lastIndexOf(route);
          env.stack = index >= 0 ? env.stack.slice(0, index + 1) : [...env.stack.slice(0, -1), route];
          env.pathname = route;
        },
      },
    },
    'expo-font': { useFonts: (fonts) => { env.fonts = fonts; return [env.fontsLoaded, null]; } },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'lucide-react-native': Object.fromEntries(['ScanLine', 'CircleUserRound', 'BookOpen', 'History'].map((name) => [name, name])),
    '@/contexts/AuthContext': auth,
    ...(options.socialAuthEnabled === undefined ? {} : {
      '@/constants/auth': { SHOW_SOCIAL_AUTH: options.socialAuthEnabled },
    }),
  };
  const Component = createLoader(mocks)(file).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Component)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  env.tree = tree;
  env.rerender = () => act(async () => tree.update(React.createElement(Component)));
  env.button = (label) => tree.root.findAllByType('Pressable').find((item) => text(item) === label);
  return env;
}

for (const screen of ['login', 'register']) {
  test(`${screen} keeps email auth usable inside keyboard-aware scrolling with social controls absent`, async (t) => {
    const failure = deferred(), success = deferred();
    const env = await mount(t, `src/app/${screen}.tsx`, { session: null, requests: [failure, success] });
    const scroll = env.tree.root.findByType('ScrollView');
    assert.equal(env.tree.root.findByType('KeyboardAvoidingView').props.behavior, 'height');
    assert.equal(env.tree.root.findByType('KeyboardAvoidingView').props.keyboardVerticalOffset, 24);
    assert.equal(scroll.props.keyboardShouldPersistTaps, 'handled');
    assert.equal(flatten(scroll.props.contentContainerStyle).flexGrow, 1);
    assert.equal(flatten(scroll.props.contentContainerStyle).flex, undefined);
    const inputs = scroll.findAllByType('TextInput');
    assert.equal(inputs.length, screen === 'login' ? 2 : 3);
    const title = screen === 'login' ? 'Sign In' : 'Sign Up';
    assert.ok(scroll.findAllByType('Pressable').includes(env.button(title)));
    assert.equal(scroll.findAllByType('Pressable').length, 2, 'only email submit and the other email-auth route remain');
    assert.doesNotMatch(text(env.tree.root), /Google|Apple|Atau (masuk|daftar)/i);
    await act(async () => env.button(title).props.onPress());
    assert.match(text(env.tree.root), /Masukkan alamat email yang valid/);
    assert.equal(env.authCalls.length, 0);

    await act(async () => {
      inputs[0].props.onChangeText(' USER@Example.test ');
      for (const input of inputs.slice(1)) input.props.onChangeText('secret123');
    });
    assert.equal(inputs[1].props.secureTextEntry, true);
    await act(async () => scroll.findAllByType('TouchableOpacity')[0].props.onPress());
    assert.equal(inputs[1].props.secureTextEntry, false);
    let pending;
    await act(async () => { pending = env.button(title).props.onPress(); });
    assert.ok(env.button('Memproses...'), 'email submit indicates the pending request');
    assert.equal(env.button('Memproses...').props.disabled, true);
    assert.doesNotMatch(text(env.tree.root), /Google|Apple/);
    await act(async () => { failure.reject(new Error('Network request failed')); await pending; });
    assert.equal(env.button(title).props.disabled, false);
    assert.ok(text(env.tree.root).includes(screen === 'login' ? 'Login gagal' : 'Registrasi gagal'));
    assert.equal(env.navigations.length, 0);
    await act(async () => { pending = env.button(title).props.onPress(); });
    await act(async () => { success.resolve({ needsEmailConfirmation: false }); await pending; });
    assert.equal(env.navigations.at(-1), '/home');
    const call = env.authCalls.at(-1);
    assert.equal(screen === 'login' ? call[0] : call.email, 'user@example.test');
    assert.equal(screen === 'login' ? call[1] : call.password, 'secret123');
    assert.doesNotMatch(text(env.tree.root), /Google|Apple/);
    assert.equal(env.oauthCalls.length, 0, 'email auth never invokes a disabled provider');
  });

  test(`${screen} retains OAuth handlers for a future explicitly enabled provider configuration`, async (t) => {
    const env = await mount(t, `src/app/${screen}.tsx`, { session: null, socialAuthEnabled: true });
    await act(async () => env.button('Sign In dengan Google').props.onPress());
    await act(async () => env.button('Sign In dengan Apple').props.onPress());
    assert.equal(env.oauthCalls.join(','), 'google,apple');
    assert.equal(env.navigations.join(','), '/home,/home');
  });
}

test('Email registration validates passwords and requires confirmation before navigating home', async (t) => {
  const request = deferred();
  const env = await mount(t, 'src/app/register.tsx', { session: null, requests: [request] });
  const inputs = env.tree.root.findAllByType('TextInput');
  await act(async () => {
    inputs[0].props.onChangeText(' USER@Example.test ');
    inputs[1].props.onChangeText('short');
    inputs[2].props.onChangeText('different');
  });
  await act(async () => env.button('Sign Up').props.onPress());
  assert.match(text(env.tree.root), /Password minimal 6 karakter/);
  assert.equal(env.authCalls.length, 0);
  await act(async () => inputs[1].props.onChangeText('secret123'));
  await act(async () => env.button('Sign Up').props.onPress());
  assert.match(text(env.tree.root), /Konfirmasi password tidak sama/);
  assert.equal(env.authCalls.length, 0);
  await act(async () => inputs[2].props.onChangeText('secret123'));
  let pending;
  await act(async () => { pending = env.button('Sign Up').props.onPress(); });
  await act(async () => { request.resolve({ needsEmailConfirmation: true }); await pending; });
  assert.equal(env.authCalls.length, 1);
  assert.equal(env.authCalls[0].email, 'user@example.test');
  assert.equal(env.authCalls[0].password, 'secret123');
  assert.equal(env.navigations.length, 0, 'unconfirmed signup never enters protected home');
  assert.equal(env.alerts.length, 1);
  assert.match(env.alerts[0][1], /Periksa email untuk mengonfirmasi akun/);
  assert.equal(env.button('Sign Up').props.disabled, false);
  assert.doesNotMatch(text(env.tree.root), /Google|Apple/);
  await act(async () => env.alerts[0][2][0].onPress());
  assert.equal(env.navigations.join(','), '/login');
});

test('FormScreen keeps iOS keyboard padding and excludes only navbar-owned bottom inset for editing', async (t) => {
  const env = await mount(t, 'src/components/FormScreen.tsx', { os: 'ios' });
  assert.equal(env.tree.root.findByType('KeyboardAvoidingView').props.behavior, 'padding');
  assert.ok(env.tree.root.findByType('SafeAreaView').props.edges.includes('bottom'));
  const mocks = {
    'react-native': { KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', Platform: { OS: 'android' }, StyleSheet: { create: (styles) => styles } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24 }) },
  };
  const FormScreen = createLoader(mocks)('src/components/FormScreen.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(FormScreen, { includeBottomInset: false })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(tree.root.findByType('SafeAreaView').props.edges.join(','), 'top,left,right');
});

test('Navbar is in flow, owns bottom safe area, and dismisses to existing routes without pushing duplicates', async (t) => {
  const env = await mount(t, 'src/app/_layout.tsx');
  const stack = env.tree.root.findByType('Stack');
  const navigator = stack.parent.parent;
  const navbar = env.tree.root.findAllByType('SafeAreaView').find((item) => item.props.edges?.includes('bottom'));
  assert.ok(navbar.parent.parent === navigator.parent, 'navbar and navigator share the root flex layout');
  assert.equal(flatten(navigator.props.style).flex, 1);
  assert.notEqual(flatten(navbar.props.style).position, 'absolute');
  assert.equal(navbar.props.edges.join(','), 'bottom,left,right');
  const tabs = () => navbar.findAllByType('Pressable');
  assert.equal(tabs().length, 4);
  await act(async () => tabs()[0].props.onPress());
  assert.equal(env.navigations.length, 0, 'active Scan route is a no-op');
  for (const index of [1, 3, 0]) {
    await act(async () => tabs()[index].props.onPress());
    await env.rerender();
    await act(async () => tabs()[index].props.onPress());
  }
  assert.equal(env.navigations.join(','), '/profile,/history,/home');
  assert.equal(env.navMethods.join(','), 'dismissTo,dismissTo,dismissTo');
  assert.equal(env.stack.length, 1);
  env.stack = ['/history', '/history/SCAN_A'];
  env.pathname = '/history/SCAN_A';
  await env.rerender();
  await act(async () => tabs()[3].props.onPress());
  await env.rerender();
  assert.equal(env.stack.join(','), '/history', 'returning from detail reuses the existing History entry');
  assert.equal(env.tree.root.findAllByType('Screen').some((item) => item.props.name === 'explore'), false);
  env.session = null;
  env.pathname = '/login';
  await env.rerender();
  assert.equal(env.tree.root.findAllByType('Pressable').length, 0, 'auth routes do not expose the navbar');
});

test('Startup shows progress before six used fonts are ready and then opens the app', async (t) => {
  const env = await mount(t, 'src/app/_layout.tsx', { fontsLoaded: false });
  assert.match(text(env.tree.root), /Menyiapkan aplikasi/);
  assert.equal(env.tree.root.findAllByType('ActivityIndicator').length, 1);
  assert.equal(env.tree.root.findAllByType('Stack').length, 0);
  assert.equal(Object.keys(env.fonts).length, 6);
  assert.equal(flatten(env.tree.root.findByType('Text').props.style).fontFamily, undefined);
  env.fontsLoaded = true;
  await env.rerender();
  assert.equal(env.tree.root.findAllByType('Stack').length, 1);
});

test('Landing, guide and shared buttons remain scrollable or grow with their text', async (t) => {
  const landing = await mount(t, 'src/app/index.tsx', { session: null });
  const logo = landing.tree.root.findByType('Image');
  assert.equal(flatten(logo.props.style).width, '100%');
  assert.equal(flatten(logo.props.style).aspectRatio, 1);
  assert.equal(landing.tree.root.findByType('ScrollView').findAllByType('Pressable').length, 2);
  for (const button of landing.tree.root.findAllByType('Pressable')) {
    assert.equal(flatten(button.props.style).height, undefined);
    assert.ok(flatten(button.props.style).minHeight >= 48);
    assert.equal(flatten(button.findByType('Text').props.style).textAlign, 'center');
  }
  const guide = await mount(t, 'src/app/guide.tsx');
  const guideText = text(guide.tree.root.findByType('ScrollView'));
  for (const phrase of ['Raspberry Pi membaca QR', 'tombol fisik', 'Enter', 'menunggu hasil pemeriksaan baru']) {
    assert.ok(guideText.includes(phrase));
  }
  assert.doesNotMatch(guideText, /QR dari alat|masukkan kode alat|kamera mobile/);
});

test('No starter route or dangling local source/asset imports remain', () => {
  assert.equal(existsSync(path.join(root, 'src/app/explore.tsx')), false);
  function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(file) : [file];
    });
  }
  for (const file of walk(path.join(root, 'src')).filter((file) => /\.tsx?$/.test(file))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      const id = ts.isImportDeclaration(node) ? node.moduleSpecifier.text
        : ts.isCallExpression(node) && node.expression.getText(source) === 'require' && ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text : null;
      if (id && (id.startsWith('.') || id.startsWith('@/'))) {
        const base = id.startsWith('@/') ? path.join(root, id.startsWith('@/assets/') ? '' : 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
        assert.ok([base, base + '.ts', base + '.tsx', base + '.web.ts', base + '.web.tsx'].some(existsSync), `${file}: missing ${id}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const png = readFileSync(path.join(root, 'assets/images/Logo.png'));
  assert.equal(png.readUInt32BE(16), 825);
  assert.equal(png.readUInt32BE(20), 825);
  assert.ok(png.length < 140595);
});
