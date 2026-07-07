import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
// import TelegramProvider from "next-auth/providers/telegra";

export const authOptions = {
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: {
    maxAge: 1 * 60 * 60,
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async session(response: any) {
      const { session, token, user, ...rest } = response;
      const tempSession: any = session;
      tempSession["token"] = token;

      return tempSession;
    },
    async jwt(response: any) {
      const { token, user, account, profile, isNewUser, ...rest } = response;
      if (account?.provider) {
        token["provider"] = account?.provider;
      }
      return token;
    },
  },
};

export default NextAuth(authOptions);
