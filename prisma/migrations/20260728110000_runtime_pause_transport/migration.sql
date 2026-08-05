ALTER TYPE "MachineRuntimeStatus" ADD VALUE IF NOT EXISTS 'PAUSED' AFTER 'RUNNING';

CREATE TYPE "MachineRuntimeSource" AS ENUM ('WEBSOCKET', 'HEARTBEAT');

ALTER TYPE "MachineRuntimeEventType" ADD VALUE IF NOT EXISTS 'PAUSED' AFTER 'SNAPSHOT';
ALTER TYPE "MachineRuntimeEventType" ADD VALUE IF NOT EXISTS 'RESUMED' AFTER 'PAUSED';

ALTER TABLE "machine_runtime_sessions"
ADD COLUMN "source" "MachineRuntimeSource" NOT NULL DEFAULT 'WEBSOCKET',
ADD COLUMN "last_result_at" TIMESTAMP(3);

UPDATE "machine_runtime_sessions" AS session
SET "source" = 'HEARTBEAT'
WHERE EXISTS (
  SELECT 1
  FROM "machine_runtime_events" AS event
  WHERE event."session_id" = session."id"
    AND event."event_type" = 'STARTED'
    AND event."payload_json"->>'source' = 'HEARTBEAT'
);

UPDATE "machine_runtime_sessions" AS session
SET "last_result_at" = activity."last_result_at"
FROM (
  SELECT source."session_id", MAX(source."activity_at") AS "last_result_at"
  FROM (
    SELECT scan."runtime_session_id" AS "session_id", scan."created_at" AS "activity_at"
    FROM "scan_records" AS scan
    WHERE scan."runtime_session_id" IS NOT NULL

    UNION ALL

    SELECT event."session_id", event."created_at"
    FROM "machine_runtime_events" AS event
    WHERE event."session_id" IS NOT NULL
      AND (
        event."last_result" IS NOT NULL
        OR event."local_scan_id" IS NOT NULL
      )
  ) AS source
  GROUP BY source."session_id"
) AS activity
WHERE activity."session_id" = session."id";
