import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { SeoFieldsInput } from "@/lib/seo";

// Only posts for now; courses and categories join the enum in later phases.
export type SeoEntityType = "POST";

// Pass a transaction client to take part in the caller's transaction.
type Client = Prisma.TransactionClient | typeof db;

export type SeoValues = {
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  socialImageId: number | null;
};

export async function getSeo(entityType: SeoEntityType, entityId: number, client: Client = db): Promise<SeoValues | null> {
  const row = await client.seoData.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
    select: { title: true, metaDescription: true, canonicalUrl: true, noindex: true, socialImageId: true },
  });
  return row;
}

// Empty fields are stored as null; an all-empty form removes the row.
export async function upsertSeo(
  entityType: SeoEntityType,
  entityId: number,
  input: SeoFieldsInput,
  client: Client = db,
) {
  const data: SeoValues = {
    title: input.seoTitle || null,
    metaDescription: input.metaDescription || null,
    canonicalUrl: input.canonicalUrl || null,
    noindex: input.noindex,
    socialImageId: input.socialImageId,
  };
  const empty = !data.title && !data.metaDescription && !data.canonicalUrl && !data.noindex && !data.socialImageId;
  if (empty) {
    await deleteSeo(entityType, entityId, client);
    return null;
  }
  return client.seoData.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, ...data },
    update: data,
  });
}

// SeoData has no foreign key: call this when the entity is deleted.
export async function deleteSeo(entityType: SeoEntityType, entityId: number, client: Client = db) {
  await client.seoData.deleteMany({ where: { entityType, entityId } });
}
