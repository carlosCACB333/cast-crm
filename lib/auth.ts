import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins/organization";

import { DEFAULT_CUSTOMER_STATUSES } from "@/config/customers";
import { DEFAULT_PRODUCT_CATEGORIES } from "@/config/products";
import { DEFAULT_SERVICE_CATEGORIES } from "@/config/services";
import { DEFAULT_PIPELINE } from "@/config/leads";
import { DEFAULT_PAYMENT_METHODS } from "@/config/payment-methods";
import { DEFAULT_CASH_REGISTER_NAME } from "@/config/pos";
import { actionEmail, sendEmail } from "@/lib/email";
import { canCreateOrganization } from "@/lib/organization";
import { DEFAULT_ROLES, ac, roles } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validations/auth";

export const auth = betterAuth({
  appName: "Cast CRM",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Restablece tu contraseña de Cast CRM",
        ...actionEmail({
          name: user.name,
          intro:
            "Recibimos una solicitud para restablecer tu contraseña. El enlace caduca en 1 hora.",
          actionLabel: "Restablecer contraseña",
          url,
        }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verifica tu correo en Cast CRM",
        ...actionEmail({
          name: user.name,
          intro: "Confirma esta dirección de correo para usarla en tu cuenta.",
          actionLabel: "Verificar correo",
          url,
        }),
      });
    },
  },
  user: {
    // Verified users confirm the change from a link sent to the new address.
    changeEmail: { enabled: true },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  rateLimit: {
    enabled: true,
    storage: "memory",
  },
  databaseHooks: {
    session: {
      create: {
        // Start every session in the user's oldest organization so that
        // organization-scoped reads work right after signing in.
        before: async (session) => {
          const membership = await prisma.member.findFirst({
            where: { userId: session.userId },
            orderBy: { createdAt: "asc" },
            select: { organizationId: true },
          });

          return {
            data: {
              ...session,
              activeOrganizationId: membership?.organizationId ?? null,
            },
          };
        },
      },
    },
  },
  plugins: [
    organization({
      ac,
      roles,
      // Roles other than the owner are defined per organization and stored in
      // the `organizationRole` table.
      dynamicAccessControl: { enabled: true, maximumRolesPerOrganization: 50 },
      schema: {
        organizationRole: {
          additionalFields: {
            label: { type: "string", required: true },
            description: { type: "string", required: false },
          },
        },
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          await prisma.organizationRole.createMany({
            data: DEFAULT_ROLES.map(
              ({ role, label, description, permission }) => ({
                id: crypto.randomUUID(),
                organizationId: organization.id,
                role,
                label,
                description,
                permission: JSON.stringify(permission),
              }),
            ),
          });
          await prisma.customerStatus.createMany({
            data: DEFAULT_CUSTOMER_STATUSES.map(
              ({ label, color }, position) => ({
                organizationId: organization.id,
                label,
                color,
                position,
              }),
            ),
          });
          await prisma.productCategory.createMany({
            data: DEFAULT_PRODUCT_CATEGORIES.map(
              ({ name, color }, position) => ({
                organizationId: organization.id,
                name,
                color,
                position,
              }),
            ),
          });
          await prisma.serviceCategory.createMany({
            data: DEFAULT_SERVICE_CATEGORIES.map(
              ({ name, color }, position) => ({
                organizationId: organization.id,
                name,
                color,
                position,
              }),
            ),
          });
          await prisma.pipeline.create({
            data: {
              organizationId: organization.id,
              name: DEFAULT_PIPELINE.name,
              position: 0,
              stages: {
                create: DEFAULT_PIPELINE.stages.map((stage, position) => ({
                  ...stage,
                  organizationId: organization.id,
                  position,
                })),
              },
            },
          });
          await prisma.paymentMethod.createMany({
            data: DEFAULT_PAYMENT_METHODS.map(({ name, kind }, position) => ({
              organizationId: organization.id,
              name,
              kind,
              position,
            })),
          });
          await prisma.cashRegister.create({
            data: {
              organizationId: organization.id,
              name: DEFAULT_CASH_REGISTER_NAME,
            },
          });
        },
      },
      // Deleted only through the `deleteOrganization` Server Action, which
      // checks the typed name and also removes the organization's images.
      disableOrganizationDeletion: true,
      // Depends on DEPLOYMENT_MODE; enforced here so it also covers direct
      // calls to the Better Auth endpoint.
      allowUserToCreateOrganization: (user) => canCreateOrganization(user.id),
      organizationLimit: 10,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      cancelPendingInvitationsOnReInvite: true,
      requireEmailVerificationOnInvitation: true,
      sendInvitationEmail: async ({
        email,
        organization,
        inviter,
        invitation,
      }) => {
        const url = `${process.env.BETTER_AUTH_URL}/accept-invitation/${invitation.id}`;

        await sendEmail({
          to: email,
          subject: `Te invitaron a ${organization.name} en Cast CRM`,
          ...actionEmail({
            name: email,
            intro: `${inviter.user.name} te invitó a unirte a ${organization.name}. La invitación caduca en 7 días.`,
            actionLabel: "Ver invitación",
            url,
          }),
        });
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
