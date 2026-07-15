CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role" "UserRole" NOT NULL,
    "permission_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_permissions_role_permission_key_key" ON "role_permissions"("role", "permission_key");
CREATE INDEX "role_permissions_role_idx" ON "role_permissions"("role");

INSERT INTO "role_permissions" ("role", "permission_key")
VALUES
    ('operator', 'dashboard'),
    ('operator', 'machines'),
    ('operator', 'runtime'),
    ('operator', 'scans'),
    ('operator', 'reports'),
    ('operator', 'notifications'),
    ('operator', 'settings'),
    ('engineer', 'dashboard'),
    ('engineer', 'machines'),
    ('engineer', 'runtime'),
    ('engineer', 'scans'),
    ('engineer', 'reports'),
    ('engineer', 'master-data'),
    ('engineer', 'sync'),
    ('engineer', 'duplicate-audit'),
    ('engineer', 'duplicates'),
    ('engineer', 'audit-logs'),
    ('engineer', 'notifications'),
    ('engineer', 'settings'),
    ('engineer', 'api-docs'),
    ('admin', 'dashboard'),
    ('admin', 'machines'),
    ('admin', 'runtime'),
    ('admin', 'scans'),
    ('admin', 'reports'),
    ('admin', 'master-data'),
    ('admin', 'sync'),
    ('admin', 'duplicate-audit'),
    ('admin', 'duplicates'),
    ('admin', 'users'),
    ('admin', 'audit-logs'),
    ('admin', 'notifications'),
    ('admin', 'settings'),
    ('admin', 'api-docs')
ON CONFLICT ("role", "permission_key") DO NOTHING;
