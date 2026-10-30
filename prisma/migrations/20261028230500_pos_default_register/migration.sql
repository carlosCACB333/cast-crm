-- Every existing organization starts with one register, like new ones do.
INSERT INTO "cash_register" ("id", "organizationId", "name", "updatedAt")
SELECT md5(o."id" || 'register'), o."id", 'Caja principal', CURRENT_TIMESTAMP
FROM "organization" o
WHERE NOT EXISTS (SELECT 1 FROM "cash_register" r WHERE r."organizationId" = o."id");
