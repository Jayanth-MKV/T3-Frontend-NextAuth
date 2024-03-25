import { PrismaAdapter } from "@auth/prisma-adapter";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import { type Adapter } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";

import { env } from "~/env";
import { db } from "~/server/db";
import { api } from "~/trpc/server";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  callbacks: {
    session: ({ session, token, user }) => {
      console.log(session);
      console.log(user);
      console.log(token);

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
        },
      };
    },
    // jwt: async ({ token, user }) => {
    //   console.log("jU: ", user);
    //   console.log("jT: ", token);
    //   if (user) {
    //     token.id = user.id;
    //     token.email = user.email;
    //   }

    //   return token;
    // },
  },
  adapter: PrismaAdapter(db) as Adapter,
  session: {
    maxAge: 60*60,
    updateAge: 10,
  },
  // jwt: {
  //   maxAge: 60, // 1 day
  // },
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_ID,
      clientSecret: env.GOOGLE_SECRET,
      authorization: {
        params: {
          // prompt: "consent",
          // access_type: "offline",
          // response_type: "code",
        },
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "example@gmail.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Add logic to verify credentials here
        if (!credentials) return null;
        const { email, password } = credentials;
        // Fetch user and password hash from your database
        const user = await db.user.findUnique({
          where: {
            email,
            password,
          },
        });
        // Example: const user = await getUserByEmail(email)
        if (user && bcrypt.compareSync(password, user.password || "")) {
          return { id: user.id, name: user.name, email: user.email };
        } else {
          throw new Error("Invalid credentials");
        }
      },
    }),

    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions);
