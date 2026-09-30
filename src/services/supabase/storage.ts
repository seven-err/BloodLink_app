import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import aesjs from 'aes-js';

const ENCRYPTION_KEY_SUFFIX = '-encryption-key';

type StorageBackend = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// Expo SecureStore values are limited to ~2048 bytes; Supabase sessions are larger.
class LargeSecureStore implements StorageBackend {
  private keyCache = new Map<string, Uint8Array>();

  private async getEncryptionKey(storeKey: string): Promise<Uint8Array> {
    if (this.keyCache.has(storeKey)) {
      return this.keyCache.get(storeKey)!;
    }

    const secureKey = `${storeKey}${ENCRYPTION_KEY_SUFFIX}`;
    let encryptionKeyHex = await SecureStore.getItemAsync(secureKey);
    
    if (!encryptionKeyHex) {
      const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
      encryptionKeyHex = aesjs.utils.hex.fromBytes(encryptionKey);
      await SecureStore.setItemAsync(secureKey, encryptionKeyHex);
    }

    const keyBytes = aesjs.utils.hex.toBytes(encryptionKeyHex);
    this.keyCache.set(storeKey, keyBytes);
    return keyBytes;
  }

  private async encrypt(key: string, value: string) {
    const encryptionKey = await this.getEncryptionKey(key);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(iv));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    
    const combinedBytes = new Uint8Array(iv.length + encryptedBytes.length);
    combinedBytes.set(iv);
    combinedBytes.set(encryptedBytes, iv.length);
    
    return 'v2-' + aesjs.utils.hex.fromBytes(combinedBytes);
  }

  private async decrypt(key: string, value: string) {
    if (value.startsWith('v2-')) {
      const encryptionKey = await this.getEncryptionKey(key);
      const combinedBytes = aesjs.utils.hex.toBytes(value.slice(3));
      
      if (combinedBytes.length < 16) {
        return null;
      }
      
      const iv = combinedBytes.slice(0, 16);
      const encryptedBytes = combinedBytes.slice(16);
      
      const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(iv));
      const decryptedBytes = cipher.decrypt(encryptedBytes);
      
      return aesjs.utils.utf8.fromBytes(decryptedBytes);
    }

    // Legacy V1 decryption
    const encryptionKeyHex = await SecureStore.getItemAsync(`${key}${ENCRYPTION_KEY_SUFFIX}`);

    if (!encryptionKeyHex) {
      return null;
    }

    const encryptionKeyBytes = aesjs.utils.hex.toBytes(encryptionKeyHex);
    // Cache the key for future encrypts (migrating seamlessly to v2)
    this.keyCache.set(key, encryptionKeyBytes);

    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKeyBytes,
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);

    if (!encrypted) {
      return encrypted;
    }

    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(`${key}${ENCRYPTION_KEY_SUFFIX}`);
    this.keyCache.delete(key);
  }
}

let nativeBackend: StorageBackend | null = null;

const getNativeBackend = () => {
  if (!nativeBackend) {
    // Do not silently fall back to memory: that would make a valid login vanish
    // whenever the app process restarts. AsyncStorage is an installed native
    // dependency and should surface a configuration error if it is unavailable.
    nativeBackend = new LargeSecureStore();
  }

  return nativeBackend;
};

export const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      return Promise.resolve(globalThis.localStorage?.getItem(key) ?? null);
    }

    return getNativeBackend().getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return Promise.resolve();
    }

    return getNativeBackend().setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return Promise.resolve();
    }

    return getNativeBackend().removeItem(key);
  },
};
