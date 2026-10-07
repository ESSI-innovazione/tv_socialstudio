import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { ALLOWED_EMAIL_DOMAIN, authConfigured, env } from "@/lib/env";
import { getProfileByEmail, touchProfileSeen } from "@/lib/db";
import type { Role } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    user: { role: Role; isAdmin: boolean } & DefaultSession["user"];
  }
}

/** Quanto spesso, al massimo, si scrive l'ultimo accesso di una persona. */
const SEEN_EVERY_MS = 60 * 60_000;

/** Vero se l'indirizzo e' fra quelli nominati admin dall'ambiente. */
function bootstrapAdmin(email: string): boolean {
  return env.adminEmails.includes(email.toLowerCase());
}

/**
 * Google OAuth ristretto al dominio @timevision.it. Chiunque altro viene
 * respinto nella callback, prima che esista una sessione; chi ha un profilo
 * disattivato viene rimandato alla porta con un messaggio chiaro.
 *
 * Senza credenziali Google configurate l'app resta usabile in sviluppo:
 * `currentUser()` fornisce la persona di sviluppo. In produzione, con le
 * chiavi presenti, quel percorso non viene mai raggiunto.
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
      // Un accesso tolto si rispetta anche se Google lo farebbe entrare.
      const stored = await getProfileByEmail(email);
      if (stored && stored.active === false) return "/?error=Disattivato";
      return true;
    },
    async jwt({ token, profile }) {
      const email = (profile?.email ?? token.email)?.toLowerCase();
      if (email) {
        token.email = email;
        const stored = await getProfileByEmail(email);
        token.role = stored?.role ?? "editor";
        token.isAdmin = Boolean(stored?.is_admin) || bootstrapAdmin(email);

        // L'ultimo accesso si scrive al piu' una volta l'ora: il token
        // ricorda quando l'ha fatto, cosi' non si tocca il database a ogni
        // richiesta.
        const seenAt = typeof token.seenAt === "number" ? token.seenAt : 0;
        if (stored && Date.now() - seenAt > SEEN_EVERY_MS) {
          await touchProfileSeen(stored.id);
          token.seenAt = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.role = (token.role as Role) ?? "editor";
        session.user.isAdmin = Boolean(token.isAdmin);
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
  /** Gestisce il team. Separato dal ruolo: vedi lib/permissions.ts. */
  isAdmin: boolean;
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
 * configurata restituisce la persona di sviluppo, con il ruolo che ha nel
 * profilo seminato: cosi' anche la pagina del team si prova end-to-end.
 */
export async function currentUser(): Promise<StudioUser | null> {
  if (!authConfigured) {
    const email = `demo@${ALLOWED_EMAIL_DOMAIN}`;
    const stored = await getProfileByEmail(email);
    const name = stored?.name ?? "Federica Rossi";
    return {
      email,
      name,
      role: stored?.role ?? "approver",
      isAdmin: stored ? stored.is_admin || bootstrapAdmin(email) : true,
      initials: initialsOf(name, email),
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
    isAdmin: session?.user?.isAdmin ?? bootstrapAdmin(email),
    initials: initialsOf(name, email),
  };
}

export { nextAuth as auth };
