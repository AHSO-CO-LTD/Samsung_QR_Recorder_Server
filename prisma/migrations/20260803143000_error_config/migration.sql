-- Error groups are optional because error codes are searched and identified directly by code.
ALTER TABLE "error_codes" ALTER COLUMN "group_name" DROP NOT NULL;

-- Preserve customized role matrices while granting the new screen to roles
-- that already have an explicit permission configuration.
INSERT INTO "role_permissions" ("role", "permission_key", "created_at", "updated_at")
SELECT DISTINCT "role", 'error-config', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "role_permissions"
WHERE "role" IN ('engineer'::"UserRole", 'admin'::"UserRole")
ON CONFLICT ("role", "permission_key") DO NOTHING;
