-- CreateEnum
CREATE TYPE "StageKind" AS ENUM ('OPEN', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR';

-- CreateTable
CREATE TABLE "pipeline" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" "StatusColor" NOT NULL DEFAULT 'DEFAULT',
    "kind" "StageKind" NOT NULL DEFAULT 'OPEN',
    "probability" INTEGER,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "value" DECIMAL(14,2),
    "expectedCloseDate" DATE,
    "contactName" TEXT,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "lostReason" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customerId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_note" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipeline_organizationId_position_idx" ON "pipeline"("organizationId", "position");

-- CreateIndex
CREATE INDEX "pipeline_stage_pipelineId_position_idx" ON "pipeline_stage"("pipelineId", "position");

-- CreateIndex
CREATE INDEX "lead_organizationId_pipelineId_stageId_position_idx" ON "lead"("organizationId", "pipelineId", "stageId", "position");

-- CreateIndex
CREATE INDEX "lead_organizationId_ownerId_idx" ON "lead"("organizationId", "ownerId");

-- CreateIndex
CREATE INDEX "lead_customerId_idx" ON "lead"("customerId");

-- CreateIndex
CREATE INDEX "lead_note_leadId_createdAt_idx" ON "lead_note"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_note_organizationId_idx" ON "lead_note"("organizationId");

-- AddForeignKey
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "pipeline_stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default sales pipeline for existing organizations (new ones get it on creation).
WITH new_pipelines AS (
    INSERT INTO "pipeline" ("id", "organizationId", "name", "position", "updatedAt")
    SELECT gen_random_uuid()::text, o."id", 'Ventas', 0, CURRENT_TIMESTAMP
    FROM "organization" o
    RETURNING "id", "organizationId"
)
INSERT INTO "pipeline_stage" ("id", "organizationId", "pipelineId", "name", "color", "kind", "probability", "position", "updatedAt")
SELECT gen_random_uuid()::text, p."organizationId", p."id", s."name", s."color"::"StatusColor", s."kind"::"StageKind", s."probability", s."position", CURRENT_TIMESTAMP
FROM new_pipelines p
CROSS JOIN (VALUES
    ('Nuevo', 'DEFAULT', 'OPEN', 10, 0),
    ('Contactado', 'ACCENT', 'OPEN', 25, 1),
    ('Propuesta', 'WARNING', 'OPEN', 50, 2),
    ('Negociación', 'WARNING', 'OPEN', 75, 3),
    ('Ganado', 'SUCCESS', 'WON', 100, 4),
    ('Perdido', 'DANGER', 'LOST', 0, 5)
) AS s("name", "color", "kind", "probability", "position");

-- Grant the new `lead` and `pipeline` resources to the default roles.
UPDATE "organizationRole"
SET "permission" = ("permission"::jsonb || '{"lead":["read","create","update","delete"],"pipeline":["manage"]}'::jsonb)::text
WHERE "role" = 'admin' AND NOT ("permission"::jsonb ? 'lead');

UPDATE "organizationRole"
SET "permission" = ("permission"::jsonb || '{"lead":["read","create","update"]}'::jsonb)::text
WHERE "role" = 'member' AND NOT ("permission"::jsonb ? 'lead');
