import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'splitify_token';
const USER_KEY = 'splitify_user';

export const storage = {
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  removeToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  setUser: (user: object) => SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  getUser: async () => {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  removeUser: () => SecureStore.deleteItemAsync(USER_KEY),
  clear: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },
};
