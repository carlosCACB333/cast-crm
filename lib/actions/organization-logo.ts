"use server";

import { APIError } from "better-auth/api";
import { z } from "zod";

import { requirePermission } from "@/lib/actions/context";
import { type ActionResult, runAction } from "@/lib/actions/result";
import {
  ORGANIZATION_LOGO_FORMATS,
  ORGANIZATION_LOGO_LIMITS,
} from "@/config/organization";
import {
  assetFolder,
  deleteImage,
  getImage,
  publicIdInFolder,
  signImageUpload,
  transformedUrl,
} from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { organizationLogoSchema } from "@/lib/validations/organization";

// The avatar is uploaded by the browser straight to Cloudinary with a
// signature made here, then saved with `setOrganizationLogo`, which reads the
// upload from Cloudinary instead of trusting what the browser reports.

const logoFolder = (organizationId: string) =>
  assetFolder(organizationId, "organization", "logo");

/** Deletes the current avatar from Cloudinary when it was uploaded here. */
async function deleteCurrentLogo(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logo: true },
  });
  const publicId = organization?.logo
    ? publicIdInFolder(organization.logo, logoFolder(organizationId))
    : null;

  if (publicId) await deleteImage(publicId);
}

/** Signed fields to upload the organization's avatar to Cloudinary. */
export async function prepareOrganizationLogoUpload(): Promise<
  ActionResult<{ url: string; fields: Record<string, string> }>
> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });

    return signImageUpload(
      logoFolder(organizationId),
      ORGANIZATION_LOGO_FORMATS,
    );
  });
}

/** Saves an avatar uploaded with `prepareOrganizationLogoUpload`. */
export async function setOrganizationLogo(
  input: unknown,
): Promise<ActionResult> {
  return runAction(organizationLogoSchema, input, async ({ publicId }) => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });

    // Only uploads into this organization's folder can become its avatar.
    if (!publicId.startsWith(`${logoFolder(organizationId)}/`)) {
      throw new APIError("BAD_REQUEST", { code: "INVALID_IMAGE" });
    }

    const image = await getImage(publicId);

    if (!image) throw new APIError("BAD_REQUEST", { code: "INVALID_IMAGE" });
    if (image.bytes > ORGANIZATION_LOGO_LIMITS.maxBytes) {
      await deleteImage(publicId);
      throw new APIError("BAD_REQUEST", { code: "IMAGE_TOO_LARGE" });
    }

    const { size } = ORGANIZATION_LOGO_LIMITS;

    await deleteCurrentLogo(organizationId);
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        logo: transformedUrl(
          image.secure_url,
          `c_fill,g_auto,w_${size},h_${size}/f_auto,q_auto`,
        ),
      },
    });

    return undefined;
  });
}

export async function removeOrganizationLogo(): Promise<ActionResult> {
  return runAction(z.undefined(), undefined, async () => {
    const { organizationId } = await requirePermission({
      organization: ["update"],
    });

    await deleteCurrentLogo(organizationId);
    await prisma.organization.update({
      where: { id: organizationId },
      data: { logo: null },
    });

    return undefined;
  });
}
