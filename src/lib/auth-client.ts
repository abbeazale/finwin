import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [
    passkeyClient(),
    twoFactorClient({
      twoFactorPage: "/two-factor",
    }),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
