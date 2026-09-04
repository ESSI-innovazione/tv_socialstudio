import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { ALLOWED_EMAIL_DOMAIN, authConfigured, env } from "@/lib/env";
import { getProfileByEmail } from "@/lib/db";
import type { Role } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    user: { role: Role } & DefaultSession["user"];
  }
}

/**
 * Google OAuth ristretto al dominio @timevision.it. Chiunque altro viene
 * respinto nella callback, prima che esista una sessione.
 *
 * Senza credenziali Google configurate l'app resta usabile in sviluppo:
 * `devSession()` fornisce un editor fittizio. In produzione, con le chiavi
 * presenti, quel percorso non viene mai raggiunto.
 */
const { handlers, auth: nextAuth, signIn, signOut } = NextAuth({
  providers: authConfigured
    ? [
        Google({
          clientId: env.googleClientId!,
          clientSecret: env.googleClientSecret!,
          authorization: {
            params: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
          },
        }),
      ]
    : [],
  trustHost: true,
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      // Il claim `hd` di Google e' un suggerimento: l'indirizzo e' la verita'.
      if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return false;
      return true;
    },
    async jwt({ token, profile }) {
      const email = (profile?.email ?? token.email)?.toLowerCase();
      if (email) {
        token.email = email;
        const stored = await getProfileByEmail(email);
        token.role = stored?.role ?? "editor";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.role = (token.role as Role) ?? "editor";
      }
      return session;
    },
  },
});

export { handlers, signIn, signOut };

export interface StudioUser {
  email: string;
  name: string;
  role: Role;
  /** Iniziali per l'avatar in barra. */
  initials: string;
}

function initialsOf(name: string, email: string): string {
  const source = name.trim() || email.split("@")[0].replace(/[._-]+/g, " ");
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Utente corrente per la console. Quando l'autenticazione non e' ancora
 * configurata restituisce un editor di sviluppo, cosi' la console gira
 * end-to-end prima che esista una credenziale.
 */
export async function currentUser(): Promise<StudioUser | null> {
  if (!authConfigured) {
    return {
      email: `demo@${ALLOWED_EMAIL_DOMAIN}`,
      name: "Giulia Rossi",
      role: "approver",
      initials: "GR",
    };
  }

  const session = await nextAuth();
  const email = session?.user?.email?.toLowerCase();
  if (!email || !email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return null;

  const name = session?.user?.name ?? email.split("@")[0];
  return {
    email,
    name,
    role: session?.user?.role ?? "editor",
    initials: initialsOf(name, email),
  };
}

export { nextAuth as auth };
