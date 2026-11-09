const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const typescript = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function loadSource(file, mocks, globals = {}) {
  const filename = path.join(__dirname, '..', file);
  const source = typescript.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      jsx: typescript.JsxEmit.ReactJSX,
      esModuleInterop: false,
    },
    fileName: filename,
  }).outputText;
  const exports = {};

  vm.runInNewContext(source, {
    exports,
    URLSearchParams,
    require: (id) => id in mocks ? mocks[id] : require(id),
    ...globals,
  }, { filename });

  return exports;
}

function read(file) {
  return readFileSync(path.join(__dirname, '..', file), 'utf8');
}

const validation = loadSource('src/utils/profileValidation.ts', {});

test('Birth date validation accepts real dates and rejects normalized invalid dates', () => {
  assert.equal(validation.isValidBirthDate('2024-02-29'), true);
  assert.equal(validation.isValidBirthDate('2026-02-28'), true);
  assert.equal(validation.isValidBirthDate('2026-02-29'), false);
  assert.equal(validation.isValidBirthDate('2026-02-31'), false);
  assert.equal(validation.isValidBirthDate('2026-13-01'), false);
  assert.equal(validation.isValidBirthDate('2026-00-10'), false);
  assert.equal(validation.isValidBirthDate('2026-2-01'), false);
});

test('Profile completeness uses the same four required fields', () => {
  const complete = {
    full_name: 'User',
    phone: '+62 812 345',
    birth_date: '2000-02-29',
    gender: 'male',
  };

  assert.equal(validation.isProfileComplete(complete), true);
  assert.equal(validation.isProfileComplete({ ...complete, phone: '' }), false);
  assert.equal(validation.isProfileComplete({ ...complete, birth_date: '2001-02-29' }), false);
  assert.equal(validation.isProfileComplete({ ...complete, gender: ' ' }), false);
  assert.equal(validation.isValidPhone('---'), false);
  assert.equal(validation.isValidPhone('  +62 812 345  '), true);
  assert.equal(validation.normalizePhone('  +62   812 345  '), '+62 812 345');
});

test('OAuth callback processing is idempotent for duplicate delivery', async () => {
  let exchanges = 0;
  const supabase = {
    auth: {
      exchangeCodeForSession: async () => {
        exchanges += 1;
        await new Promise((resolve) => setTimeout(resolve, 1));
        return { error: null };
      },
      getSession: async () => ({ data: { session: null }, error: null }),
      setSession: async () => ({ error: null }),
    },
  };
  const auth = loadSource('src/contexts/AuthContext.tsx', {
    '@/lib/supabase': { isSupabaseConfigured: true, supabase },
    '@/utils/userFacingErrors': { getSafeErrorMessage: (_error, fallback) => fallback },
    'expo-linking': { createURL: (value) => `melanosense://${value}` },
    'expo-web-browser': { maybeCompleteAuthSession() {} },
  });
  const callback = 'melanosense://auth/callback?code=one-time-code';

  await Promise.all([
    auth.completeOAuthCallback(callback),
    auth.completeOAuthCallback(callback),
  ]);
  await auth.completeOAuthCallback(callback);

  assert.equal(exchanges, 1);
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function mountAuthProvider(t, sessionResponse, strictMode) {
  const initialization = deferred();
  const signOutRequests = [];
  const listeners = new Set();
  let getSessionCalls = 0;
  let value;
  const supabase = {
    auth: {
      getSession: () => {
        getSessionCalls += 1;
        return initialization.promise;
      },
      onAuthStateChange: (listener) => {
        listeners.add(listener);
        return {
          data: {
            subscription: {
              unsubscribe: () => listeners.delete(listener),
            },
          },
        };
      },
      signOut: () => {
        const request = deferred();
        signOutRequests.push(request);
        return request.promise;
      },
      exchangeCodeForSession: async () => ({ error: null }),
      setSession: async () => ({ error: null }),
    },
  };
  const auth = loadSource('src/contexts/AuthContext.tsx', {
    '@/lib/supabase': { isSupabaseConfigured: true, supabase },
    '@/utils/userFacingErrors': { getSafeErrorMessage: (_error, fallback) => fallback },
    'expo-linking': { createURL: (value) => `melanosense://${value}` },
    'expo-web-browser': { maybeCompleteAuthSession() {} },
  });
  function Consumer() {
    value = auth.useAuth();
    return null;
  }
  let tree;
  await act(async () => {
    const provider = React.createElement(auth.AuthProvider, null, React.createElement(Consumer));
    tree = create(strictMode ? React.createElement(React.StrictMode, null, provider) : provider);
  });
  t.after(async () => { await act(async () => tree.unmount()); });

  assert.equal(value.authStatus, 'INITIALIZING');
  assert.equal(value.initializing, true);
  assert.equal(getSessionCalls, 1, 'rerenders and StrictMode effect replay share the pending initialization');
  assert.equal(listeners.size, 1, 'only the mounted auth subscription remains active');
  await act(async () => { initialization.resolve(sessionResponse); });
  assert.equal(value.initializing, false);

  return {
    get value() { return value; },
    signOutRequests,
    emit: (event, session) => act(async () => {
      for (const listener of listeners) listener(event, session);
    }),
    unmount: async () => {
      await act(async () => tree.unmount());
      assert.equal(listeners.size, 0, 'unmount unsubscribes the auth listener');
    },
  };
}

test('AuthProvider resolves authenticated, unauthenticated, error, and logout states', async (t) => {
  for (const strictMode of [false, true]) {
    const session = { user: { id: 'user-a' } };
    const authenticated = await mountAuthProvider(t, {
      data: { session }, error: null,
    }, strictMode);
    assert.equal(authenticated.value.authStatus, 'AUTHENTICATED');
    assert.equal(authenticated.value.session, session);
    assert.equal(authenticated.value.user, session.user);
    assert.equal(authenticated.value.initializationError, null);

    // Only overlapping calls share a request; neither caller has completed yet.
    await act(async () => {
      const first = authenticated.value.signOut();
      const duplicate = authenticated.value.signOut();
      assert.equal(authenticated.signOutRequests.length, 1);
      assert.equal(authenticated.value.authStatus, 'AUTHENTICATED');
      authenticated.signOutRequests[0].resolve({ error: null });
      await Promise.all([first, duplicate]);
    });
    assert.equal(authenticated.value.authStatus, 'UNAUTHENTICATED');
    assert.equal(authenticated.value.session, null);
    assert.equal(authenticated.value.user, null);

    // A later login/logout must work after the in-flight guard has cleared.
    await authenticated.emit('SIGNED_IN', session);
    assert.equal(authenticated.value.authStatus, 'AUTHENTICATED');
    await act(async () => {
      const next = authenticated.value.signOut();
      assert.equal(authenticated.signOutRequests.length, 2);
      authenticated.signOutRequests[1].resolve({ error: null });
      await next;
    });
    assert.equal(authenticated.value.authStatus, 'UNAUTHENTICATED');
    await authenticated.unmount();

    const unauthenticated = await mountAuthProvider(t, {
      data: { session: null }, error: null,
    }, strictMode);
    assert.equal(unauthenticated.value.authStatus, 'UNAUTHENTICATED');
    assert.equal(unauthenticated.value.session, null);
    assert.equal(unauthenticated.value.initializationError, null);
    await unauthenticated.unmount();

    const failed = await mountAuthProvider(t, {
      data: { session: null }, error: new Error('temporary storage failure'),
    }, strictMode);
    assert.equal(failed.value.authStatus, 'ERROR');
    assert.equal(failed.value.initializationError.message, 'Sesi belum dapat dipulihkan. Silakan coba lagi.');
    await failed.unmount();
  }
});

test('Auth/profile source keeps lifecycle safeguards and removes inert auth controls', () => {
  const auth = read('src/contexts/AuthContext.tsx');
  const callback = read('src/app/auth/callback.tsx');
  const home = read('src/app/home.tsx');
  const login = read('src/app/login.tsx');
  const register = read('src/app/register.tsx');

  // Validate the options actually passed by the Supabase client module.
  const storage = { getItem() {}, setItem() {}, removeItem() {} };
  const lock = () => {};
  const client = { auth: {} };
  let clientOptions;
  const loaded = loadSource('src/lib/supabase.ts', {
    'react-native-url-polyfill/auto': {},
    '@react-native-async-storage/async-storage': { default: storage },
    '@supabase/supabase-js': {
      processLock: lock,
      createClient: (_url, _key, options) => {
        clientOptions = options;
        return client;
      },
    },
    'react-native': { Platform: { OS: 'android' }, AppState: { addEventListener() {} } },
  }, { process: { env: {} } });
  assert.equal(loaded.supabase, client);
  assert.equal(clientOptions.auth.persistSession, true);
  assert.equal(clientOptions.auth.autoRefreshToken, true);
  assert.equal(clientOptions.auth.storage, storage);
  assert.equal(clientOptions.auth.detectSessionInUrl, false);
  assert.equal(clientOptions.auth.lock, lock);
  assert.match(auth, /authStatus/);
  assert.match(auth, /setAuthStatus\('ERROR'\)/);
  assert.match(auth, /signOutInFlightRef/);
  assert.match(callback, /handledRef/);
  assert.match(callback, /cancelled/);
  assert.doesNotMatch(callback, /setTimeout/);
  assert.match(home, /profileInFlightRef/);
  assert.match(home, /profileRequestRef/);
  assert.doesNotMatch(login, /Ingat Saya|Lupa Password/);
  assert.doesNotMatch(register, /Ingat Saya|Lupa Password/);
});
