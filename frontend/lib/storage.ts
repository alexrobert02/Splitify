import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'splitify_token';
const USER_KEY = 'splitify_user';

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

  removeToken: () =>
    isWeb ? web.remove(TOKEN_KEY) : SecureStore.deleteItemAsync(TOKEN_KEY),

  setUser: (user: object) =>
    isWeb ? web.set(USER_KEY, JSON.stringify(user)) : SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),

  getUser: async () => {
    const raw = isWeb ? await web.get(USER_KEY) : await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  removeUser: () =>
    isWeb ? web.remove(USER_KEY) : SecureStore.deleteItemAsync(USER_KEY),

  clear: async () => {
    if (isWeb) {
      await web.remove(TOKEN_KEY);
      await web.remove(USER_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  },
};
