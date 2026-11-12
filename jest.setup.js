// The native MMKV module does not exist under Jest. A small in-memory stand-in
// lets any test import code that touches storage; tests that need their own
// behaviour still override it with jest.mock().
jest.mock('react-native-mmkv-storage', () => {
  class MMKVLoader {
    withInstanceID() {
      return this;
    }
    initialize() {
      const map = new Map();
      const api = {
        getString: k => (map.has(k) ? map.get(k) : null),
        setString: (k, v) => void map.set(k, v),
        getBool: k => (map.has(k) ? map.get(k) : null),
        setBool: (k, v) => void map.set(k, v),
        getInt: k => (map.has(k) ? map.get(k) : null),
        setInt: (k, v) => void map.set(k, v),
        getMap: k => (map.has(k) ? map.get(k) : null),
        setMap: (k, v) => void map.set(k, v),
        getArray: k => (map.has(k) ? map.get(k) : null),
        setArray: (k, v) => void map.set(k, v),
        removeItem: k => void map.delete(k),
        clearStore: () => void map.clear(),
        getAllKeys: () => [...map.keys()],
        indexer: {getKeys: async () => [...map.keys()]},
      };
      return api;
    }
  }
  return {MMKVLoader, IOSAccessibleStates: {}, ProcessingModes: {}};
});

// expo-modules-core expects these globals from the native runtime.
globalThis.expo = {
  EventEmitter: class {
    addListener() {
      return {remove() {}};
    }
    removeAllListeners() {}
    emit() {}
  },
  NativeModule: class {},
  SharedObject: class {},
  SharedRef: class {},
  modules: {},
};

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

// Native file-system module: every call is a harmless async no-op.
jest.mock('@dr.pogodin/react-native-fs', () => {
  const fn = () => jest.fn(async () => undefined);
  return new Proxy(
    {__esModule: true},
    {get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[A-Z_]+$/.test(k) ? '/tmp' : fn())},
  );
});
