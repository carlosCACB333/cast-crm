"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";

import { type ActionResult, runAction } from "@/lib/actions/result";
import { auth } from "@/lib/auth";
import { idSchema } from "@/lib/validations/organization";
import {
  changeEmailSchema,
  changePasswordSchema,
  setPasswordSchema,
  updateProfileSchema,
} from "@/lib/validations/profile";

// Every action works on the signed-in user taken from the session cookie; the
// client never sends a user id. Session tokens never leave the server.

const CREDENTIAL_PROVIDER = "credential";

async function requireUserSession() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) throw new APIError("UNAUTHORIZED");

  return { headers: requestHeaders, session };
}

export interface MyProfile {
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  hasPassword: boolean;
  /** Social providers linked to the account, e.g. "google". */
  providers: string[];
}

export async function getMyProfile(): Promise<ActionResult<MyProfile>> {
  return runAction(z.undefined(), undefined, async () => {
    const { headers: requestHeaders, session } = await requireUserSession();
    const accounts = await auth.api.listUserAccounts({
      headers: requestHeaders,
    });
    const { user } = session;

    return {
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
      createdAt: new Date(user.createdAt).toISOString(),
      hasPassword: accounts.some(
        (account) => account.providerId === CREDENTIAL_PROVIDER,
      ),
      providers: accounts
        .map((account) => account.providerId)
        .filter((providerId) => providerId !== CREDENTIAL_PROVIDER),
    };
  });
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  return runAction(updateProfileSchema, input, async ({ name }) => {
    const { headers: requestHeaders } = await requireUserSession();

    await auth.api.updateUser({ headers: requestHeaders, body: { name } });

    return undefined;
  });
}

/** Sends a confirmation link to the new address; the email changes once it is opened. */
export async function changeEmail(input: unknown): Promise<ActionResult> {
  return runAction(changeEmailSchema, input, async ({ email }) => {
    const { headers: requestHeaders, session } = await requireUserSession();

    if (email.toLowerCase() === session.user.email.toLowerCase()) {
      throw new APIError("BAD_REQUEST", { code: "EMAIL_IS_THE_SAME" });
    }
    await auth.api.changeEmail({
      headers: requestHeaders,
      body: { newEmail: email, callbackURL: "/profile" },
    });

    return undefined;
  });
}

/** Changes the password and signs out every other device. */
export async function changePassword(input: unknown): Promise<ActionResult> {
  return runAction(
    changePasswordSchema,
    input,
    async ({ currentPassword, password }) => {
      const { headers: requestHeaders } = await requireUserSession();

      await auth.api.changePassword({
        headers: requestHeaders,
        body: {
          currentPassword,
          newPassword: password,
          revokeOtherSessions: true,
        },
      });

      return undefined;
    },
  );
}

export async function setPassword(input: unknown): Promise<ActionResult> {
  return runAction(setPasswordSchema, input, async ({ password }) => {
    const { headers: requestHeaders } = await requireUserSession();

    await auth.api.setPassword({
      headers: requestHeaders,
      body: { newPassword: password },
    });

    return undefined;
  });
}

export interface MySession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
}

export async function listMySessions(): Promise<ActionResult<MySession[]>> {
  return runAction(z.undefined(), undefined, async () => {
    const { headers: requestHeaders, session } = await requireUserSession();
    const sessions = await auth.api.listSessions({ headers: requestHeaders });

    return sessions
      .map((item) => ({
        id: item.id,
        userAgent: item.userAgent ?? null,
        ipAddress: item.ipAddress ?? null,
        createdAt: new Date(item.createdAt).toISOString(),
        updatedAt: new Date(item.updatedAt).toISOString(),
        isCurrent: item.id === session.session.id,
      }))
      .sort(
        (a, b) =>
          Number(b.isCurrent) - Number(a.isCurrent) ||
          b.updatedAt.localeCompare(a.updatedAt),
      );
  });
}

/** Revokes one of the caller's own sessions, looked up by id on the server. */
export async function revokeSession(sessionId: unknown): Promise<ActionResult> {
  return runAction(idSchema, sessionId, async (id) => {
    const { headers: requestHeaders } = await requireUserSession();
    const sessions = await auth.api.listSessions({ headers: requestHeaders });
    const target = sessions.find((item) => item.id === id);

    if (!target) throw new APIError("NOT_FOUND", { code: "SESSION_NOT_FOUND" });

    await auth.api.revokeSession({
      headers: requestHeaders,
      body: { token: target.token },
    });

    return undefined;
  });
}

export async function revokeOtherSessions(): Promise<ActionResult> {
  return runAction(z.undefined(), undefined, async () => {
    const { headers: requestHeaders } = await requireUserSession();

    await auth.api.revokeOtherSessions({ headers: requestHeaders });

    return undefined;
  });
}
