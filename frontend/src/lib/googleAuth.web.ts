export const GoogleSignin = {
  hasPlayServices: async (_options?: any) => true,
  configure: (_options?: any) => {},
  signIn: async () => {
    throw new Error("Native Google Sign-In is not supported on web.");
  },
  signOut: async () => {},
};
