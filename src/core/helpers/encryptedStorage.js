/*
  TEOS-256 (contract D2, process comment 3.4): the auth slice is persisted only
  encrypted.

  - A redux-persist storage engine (async getItem / setItem / removeItem), not a
    transform: redux-persist transforms are synchronous, WebCrypto is not.
  - AES-GCM 256 with a NON-extractable key kept in IndexedDB: the page can use the
    key, but its bytes never leave the browser, so a copied localStorage cannot be
    decrypted on another machine. It does not stop code running in the page (XSS).
  - Each write gets a fresh random 12-byte IV, stored with the ciphertext.
  - No IndexedDB or no crypto.subtle (old browser, some private modes, jsdom):
    nothing is persisted (signed in for this tab only). Never a plain-text fallback.
  - A value that cannot be decrypted (key deleted, data changed) is dropped: the
    admin signs in again.
*/

const DB_NAME = "admin-secure-store";
const DB_STORE = "keys";
const KEY_ID = "auth-storage-key";
const PAYLOAD_VERSION = 1;
const KEY_TIMEOUT_MS = 3000;

const getSubtle = () => globalThis.crypto?.subtle;

const hasIndexedDb = () => {
  try {
    return (
      typeof globalThis.indexedDB !== "undefined" &&
      globalThis.indexedDB !== null
    );
  } catch {
    return false;
  }
};

const getLocalStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Key store timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const requestToPromise = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const openDb = () =>
  new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) {
        request.result.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Key store blocked"));
  });

// The CryptoKey object itself is stored (structured clone): its bytes stay hidden.
export const indexedDbKeyStore = {
  async get() {
    const db = await openDb();
    try {
      const tx = db.transaction(DB_STORE, "readonly");
      return (
        (await requestToPromise(tx.objectStore(DB_STORE).get(KEY_ID))) ?? null
      );
    } finally {
      db.close();
    }
  },
  async set(key) {
    const db = await openDb();
    try {
      const tx = db.transaction(DB_STORE, "readwrite");
      await requestToPromise(tx.objectStore(DB_STORE).put(key, KEY_ID));
    } finally {
      db.close();
    }
  },
};

export const isEncryptedStorageSupported = () =>
  Boolean(getSubtle()?.encrypt && getSubtle()?.generateKey) &&
  hasIndexedDb() &&
  Boolean(getLocalStorage());

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const fromBase64 = (text) => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

// What redux-persist uses when encryption is not possible: nothing is kept.
export const memoryOnlyStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

/*
  options (tests): keyStore { get(): Promise<CryptoKey|null>, set(key) },
  subtle (crypto.subtle), backing (where the ciphertext goes, default localStorage).
*/
export const createEncryptedStorage = ({
  keyStore = indexedDbKeyStore,
  subtle = getSubtle(),
  backing = getLocalStorage(),
} = {}) => {
  let keyPromise = null;

  const getKey = () => {
    if (!keyPromise) {
      keyPromise = withTimeout(
        (async () => {
          const stored = await keyStore.get();
          if (stored) return stored;
          const key = await subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            false, // non-extractable
            ["encrypt", "decrypt"],
          );
          await keyStore.set(key);
          return key;
        })(),
        KEY_TIMEOUT_MS,
      ).catch((error) => {
        keyPromise = null; // try again on the next write
        throw error;
      });
    }
    return keyPromise;
  };

  const encrypt = async (plainText) => {
    const key = await getKey();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const cipher = await subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plainText),
    );
    return JSON.stringify({
      v: PAYLOAD_VERSION,
      iv: toBase64(iv),
      data: toBase64(cipher),
    });
  };

  const decrypt = async (stored) => {
    const payload = JSON.parse(stored);
    if (payload?.v !== PAYLOAD_VERSION || !payload.iv || !payload.data) {
      throw new Error("Unknown payload");
    }
    const key = await getKey();
    const plain = await subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.data),
    );
    return new TextDecoder().decode(plain);
  };

  const safeRemove = (name) => {
    try {
      backing?.removeItem(name);
    } catch {
      // storage blocked: nothing to remove
    }
  };

  // Writes are async: run them one after the other so an older state never
  // lands after a newer one.
  let queue = Promise.resolve();
  const enqueue = (task) => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  return {
    getItem: (name) =>
      enqueue(async () => {
        let stored = null;
        try {
          stored = backing?.getItem(name) ?? null;
        } catch {
          return null;
        }
        if (stored === null) return null;
        try {
          return await decrypt(stored);
        } catch {
          safeRemove(name); // unreadable here (other key, changed data, plain old value)
          return null;
        }
      }),
    setItem: (name, value) =>
      enqueue(async () => {
        try {
          backing?.setItem(name, await encrypt(value));
        } catch {
          // no key or no storage: never fall back to plain text
          safeRemove(name);
        }
      }),
    removeItem: (name) =>
      enqueue(async () => {
        safeRemove(name);
      }),
  };
};

// The engine of the auth slice's persist config.
export const getAuthStorage = () =>
  isEncryptedStorageSupported() ? createEncryptedStorage() : memoryOnlyStorage;
