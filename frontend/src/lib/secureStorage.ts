import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Session storage for the Supabase client.
 *
 * Native: encrypted in the OS keystore. iOS rejects large keychain values
 * (historically above ~2048 bytes), and a Supabase session can exceed that, so
 * values over CHUNK_SIZE are split across numbered keys behind a manifest.
 * Web: SecureStore does not exist there, so AsyncStorage is the only option.
 */
const CHUNK_SIZE = 2000;
const isNative = Platform.OS !== 'web';

async function readNative(key: string): Promise<string | null> {
  const manifest = await SecureStore.getItemAsync(`${key}.chunks`);
  if (manifest === null) return SecureStore.getItemAsync(key);

  const count = Number.parseInt(manifest, 10);
  if (!Number.isFinite(count) || count <= 0) return null;

  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const part = await SecureStore.getItemAsync(`${key}.${index}`);
    // A partial write means the session is unusable; report it as absent.
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function deleteNative(key: string): Promise<void> {
  const manifest = await SecureStore.getItemAsync(`${key}.chunks`);
  if (manifest !== null) {
    const count = Number.parseInt(manifest, 10);
    for (let index = 0; index < count; index += 1) {
      await SecureStore.deleteItemAsync(`${key}.${index}`);
    }
    await SecureStore.deleteItemAsync(`${key}.chunks`);
  }
  await SecureStore.deleteItemAsync(key);
}

async function writeNative(key: string, value: string): Promise<void> {
  await deleteNative(key);

  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const count = Math.ceil(value.length / CHUNK_SIZE);
  for (let index = 0; index < count; index += 1) {
    await SecureStore.setItemAsync(
      `${key}.${index}`,
      value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
    );
  }
  await SecureStore.setItemAsync(`${key}.chunks`, String(count));
}

export const sessionStorage = {
  getItem: (key: string) => (isNative ? readNative(key) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) =>
    isNative ? writeNative(key, value) : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    isNative ? deleteNative(key) : AsyncStorage.removeItem(key),
};
