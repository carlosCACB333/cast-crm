-- CreateTable
CREATE TABLE "organizationRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "label" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "organizationRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizationRole_organizationId_role_key" ON "organizationRole"("organizationId", "role");

-- AddForeignKey
ALTER TABLE "organizationRole" ADD CONSTRAINT "organizationRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the default editable roles for existing organizations so members that
-- already have the "admin" or "member" role keep working.
INSERT INTO "organizationRole" ("id", "organizationId", "role", "label", "description", "permission")
SELECT gen_random_uuid()::text, o."id", 'admin', 'Administrador',
       'Gestiona la organización, sus miembros y sus roles',
       '{"organization":["update"],"member":["create","update","delete"],"invitation":["create","cancel"],"ac":["create","read","update","delete"]}'
FROM "organization" o;

INSERT INTO "organizationRole" ("id", "organizationId", "role", "label", "description", "permission")
SELECT gen_random_uuid()::text, o."id", 'member', 'Miembro',
       'Trabaja con los datos de la organización', '{}'
FROM "organization" o;
