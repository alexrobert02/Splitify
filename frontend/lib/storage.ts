import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'splitify_token';

const web = {
  get: (key: string) => Promise.resolve(localStorage.getItem(key)),
  set: (key: string, value: string) => { localStorage.setItem(key, value); return Promise.resolve(); },
  remove: (key: string) => { localStorage.removeItem(key); return Promise.resolve(); },
};

const isWeb = Platform.OS === 'web';

export const storage = {
  setToken: (token: string) =>
    isWeb ? web.set(TOKEN_KEY, token) : SecureStore.setItemAsync(TOKEN_KEY, token),

  getToken: (): Promise<string | null> =>
    isWeb ? web.get(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY),

  clear: () =>
    isWeb ? web.remove(TOKEN_KEY) : SecureStore.deleteItemAsync(TOKEN_KEY),
};
