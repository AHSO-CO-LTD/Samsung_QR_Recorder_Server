-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('operator', 'engineer', 'admin', 'dev');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('active', 'pending', 'disabled');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MachineConnectionEventType" AS ENUM ('CONNECTED', 'DISCONNECTED', 'HEARTBEAT', 'SYNC_STARTED', 'SYNC_DONE', 'SYNC_FAILED');

-- CreateEnum
CREATE TYPE "MachineRuntimeStatus" AS ENUM ('RUNNING', 'STOPPED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "MachineRuntimeEventType" AS ENUM ('SOCKET_CONNECTED', 'SOCKET_DISCONNECTED', 'STARTED', 'PRODUCT_CHANGED', 'UPDATED', 'SNAPSHOT', 'STOPPED', 'ERROR', 'SCAN_LINKED');

-- CreateEnum
CREATE TYPE "MachineCommandType" AS ENUM ('SYNC_PROFILE', 'SYNC_SCAN_DATA', 'RELOAD_CONFIG', 'SHOW_MESSAGE');

-- CreateEnum
CREATE TYPE "MachineCommandStatus" AS ENUM ('PENDING', 'SENT', 'ACK', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MachineRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LocalScanStatus" AS ENUM ('OK', 'NG');

-- CreateEnum
CREATE TYPE "ServerScanStatus" AS ENUM ('OK', 'NG', 'SKIPPED', 'PENDING');

-- CreateEnum
CREATE TYPE "FinalScanStatus" AS ENUM ('OK', 'NG', 'PENDING');

-- CreateEnum
CREATE TYPE "NgStage" AS ENUM ('LOCAL', 'SERVER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SyncBatchTriggerType" AS ENUM ('STARTUP', 'SHUTDOWN', 'NETWORK_RESTORED', 'MANUAL');

-- CreateEnum
CREATE TYPE "SyncBatchStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "HistoricalJobStatus" AS ENUM ('pending', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationTarget" AS ENUM ('SERVER_UI', 'LOCAL_UI', 'BOTH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('NEW', 'SENT', 'READ', 'DISMISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" SERIAL NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "vendor_char" TEXT NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_settings" (
    "id" SERIAL NOT NULL,
    "factory_code_default" TEXT NOT NULL,
    "full_code_length_default" INTEGER NOT NULL DEFAULT 35,
    "full_vendor_position_default" INTEGER NOT NULL DEFAULT 18,
    "led_scan_length_default" INTEGER NOT NULL DEFAULT 22,
    "led_vendor_position_default" INTEGER NOT NULL DEFAULT 16,
    "duplicate_days" INTEGER NOT NULL DEFAULT 30,
    "heartbeat_timeout_seconds" INTEGER NOT NULL DEFAULT 60,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" SERIAL NOT NULL,
    "machine_code" TEXT NOT NULL,
    "machine_name" TEXT NOT NULL,
    "serial" TEXT,
    "uid" TEXT,
    "license_key_raw" TEXT,
    "license_activated_at" TIMESTAMP(3),
    "line_name" TEXT,
    "station_name" TEXT,
    "ip_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_registration_requests" (
    "id" SERIAL NOT NULL,
    "request_id" TEXT NOT NULL,
    "requested_machine_code" TEXT,
    "serial" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "license_key_raw" TEXT,
    "ip_address" TEXT NOT NULL,
    "hostname" TEXT,
    "app_version" TEXT,
    "local_db_version" TEXT,
    "status" "MachineRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "duplicate_fields_json" JSONB,
    "license_file_json" JSONB,
    "license_activated_at" TIMESTAMP(3),
    "license_activated_by" INTEGER,
    "approved_machine_id" INTEGER,
    "approved_machine_code" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "rejected_at" TIMESTAMP(3),
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_sync_states" (
    "id" SERIAL NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "machine_code" TEXT NOT NULL,
    "connection_status" "ConnectionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "last_seen_at" TIMESTAMP(3),
    "last_ip_address" TEXT,
    "local_total_record" INTEGER NOT NULL DEFAULT 0,
    "local_ok_record" INTEGER NOT NULL DEFAULT 0,
    "local_ng_record" INTEGER NOT NULL DEFAULT 0,
    "local_pending_sync" INTEGER NOT NULL DEFAULT 0,
    "local_checksum" TEXT,
    "server_total_record" INTEGER NOT NULL DEFAULT 0,
    "server_ok_record" INTEGER NOT NULL DEFAULT 0,
    "server_ng_record" INTEGER NOT NULL DEFAULT 0,
    "server_checksum" TEXT,
    "need_sync" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),
    "last_batch_code" TEXT,
    "app_version" TEXT,
    "local_db_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_connection_logs" (
    "id" SERIAL NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "machine_code" TEXT NOT NULL,
    "event_type" "MachineConnectionEventType" NOT NULL,
    "ip_address" TEXT,
    "message" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_connection_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_runtime_sessions" (
    "id" SERIAL NOT NULL,
    "session_code" TEXT NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "machine_code" TEXT NOT NULL,
    "status" "MachineRuntimeStatus" NOT NULL DEFAULT 'RUNNING',
    "current_product_id" INTEGER,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "ok_count" INTEGER NOT NULL DEFAULT 0,
    "ng_count" INTEGER NOT NULL DEFAULT 0,
    "last_result" TEXT,
    "last_code" TEXT,
    "last_local_scan_id" TEXT,
    "reconnect_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_runtime_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_runtime_products" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "machine_code" TEXT NOT NULL,
    "profile_id" INTEGER,
    "product_code" TEXT NOT NULL,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "ok_count" INTEGER NOT NULL DEFAULT 0,
    "ng_count" INTEGER NOT NULL DEFAULT 0,
    "last_result" TEXT,
    "last_code" TEXT,
    "last_local_scan_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_runtime_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_runtime_events" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER,
    "product_id" INTEGER,
    "machine_id" INTEGER NOT NULL,
    "machine_code" TEXT NOT NULL,
    "profile_id" INTEGER,
    "event_type" "MachineRuntimeEventType" NOT NULL,
    "product_code" TEXT,
    "total_count" INTEGER,
    "ok_count" INTEGER,
    "ng_count" INTEGER,
    "last_result" TEXT,
    "last_code" TEXT,
    "local_scan_id" TEXT,
    "ip_address" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_runtime_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_runtime_adjustment_logs" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "adjusted_by" INTEGER,
    "reason" TEXT NOT NULL,
    "old_value_json" JSONB NOT NULL,
    "new_value_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_runtime_adjustment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_commands" (
    "id" SERIAL NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "command_type" "MachineCommandType" NOT NULL,
    "payload_json" JSONB,
    "status" "MachineCommandStatus" NOT NULL DEFAULT 'PENDING',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "ack_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "machine_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chassis_codes" (
    "id" SERIAL NOT NULL,
    "code_full" TEXT NOT NULL,
    "code_input" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chassis_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "led_codes" (
    "id" SERIAL NOT NULL,
    "code_full" TEXT NOT NULL,
    "code_input" TEXT NOT NULL,
    "suffix_check" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "led_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_profiles" (
    "id" SERIAL NOT NULL,
    "chassis_code_id" INTEGER NOT NULL,
    "factory_code" TEXT NOT NULL,
    "full_code_length" INTEGER NOT NULL DEFAULT 35,
    "full_vendor_position" INTEGER NOT NULL DEFAULT 18,
    "led_scan_length" INTEGER NOT NULL DEFAULT 22,
    "led_vendor_position" INTEGER NOT NULL DEFAULT 16,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_led_codes" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "led_code_id" INTEGER NOT NULL,
    "led_slot" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_led_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_snapshots" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_records" (
    "id" SERIAL NOT NULL,
    "local_scan_id" TEXT NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "profile_snapshot_id" INTEGER,
    "full_code_raw" TEXT NOT NULL,
    "full_prefix" TEXT NOT NULL,
    "full_chassis_segment" TEXT NOT NULL,
    "full_chassis_code" TEXT NOT NULL,
    "full_before_vendor" TEXT NOT NULL,
    "full_vendor_char" TEXT NOT NULL,
    "full_led_code" TEXT NOT NULL,
    "full_factory_code" TEXT NOT NULL,
    "full_after_factory" TEXT NOT NULL,
    "duplicate_key" TEXT NOT NULL,
    "chassis_scan_raw" TEXT NOT NULL,
    "local_status" "LocalScanStatus" NOT NULL,
    "server_status" "ServerScanStatus" NOT NULL,
    "final_status" "FinalScanStatus" NOT NULL,
    "ng_stage" "NgStage",
    "ng_reason" TEXT,
    "sync_batch_id" INTEGER,
    "runtime_session_id" INTEGER,
    "runtime_product_id" INTEGER,
    "scan_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_led_items" (
    "id" SERIAL NOT NULL,
    "scan_record_id" INTEGER NOT NULL,
    "led_slot" INTEGER NOT NULL,
    "led_index" INTEGER NOT NULL,
    "led_scan_raw" TEXT NOT NULL,
    "led_lot_no" TEXT NOT NULL,
    "vendor_char" TEXT NOT NULL,
    "led_suffix" TEXT NOT NULL,
    "local_status" "LocalScanStatus" NOT NULL,
    "ng_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_led_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recent_duplicate_keys" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "duplicate_key" TEXT NOT NULL,
    "first_scan_record_id" INTEGER NOT NULL,
    "first_machine_id" INTEGER NOT NULL,
    "first_scan_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recent_duplicate_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_sync_batches" (
    "id" SERIAL NOT NULL,
    "batch_code" TEXT NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "trigger_type" "SyncBatchTriggerType" NOT NULL,
    "total_received" INTEGER NOT NULL DEFAULT 0,
    "total_ok" INTEGER NOT NULL DEFAULT 0,
    "total_ng" INTEGER NOT NULL DEFAULT 0,
    "status" "SyncBatchStatus" NOT NULL DEFAULT 'pending',
    "summary_json" JSONB,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_sync_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_duplicate_jobs" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER,
    "from_date" TIMESTAMP(3) NOT NULL,
    "to_date" TIMESTAMP(3) NOT NULL,
    "status" "HistoricalJobStatus" NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historical_duplicate_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_duplicate_results" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "duplicate_key" TEXT NOT NULL,
    "total_count" INTEGER NOT NULL,
    "first_scan_at" TIMESTAMP(3) NOT NULL,
    "latest_scan_at" TIMESTAMP(3) NOT NULL,
    "scan_record_ids_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historical_duplicate_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_request_logs" (
    "id" SERIAL NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "local_scan_id" TEXT,
    "batch_code" TEXT,
    "request_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "response_json" JSONB,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_codes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "default_message" TEXT NOT NULL,
    "local_action" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "error_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" SERIAL NOT NULL,
    "noti_code" TEXT NOT NULL,
    "title_template" TEXT NOT NULL,
    "message_template" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "target" "NotificationTarget" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" SERIAL NOT NULL,
    "noti_code" TEXT NOT NULL,
    "machine_id" INTEGER,
    "scan_record_id" INTEGER,
    "batch_id" INTEGER,
    "error_code" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "old_value_json" JSONB,
    "new_value_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_vendor_char_key" ON "vendors"("vendor_char");

-- CreateIndex
CREATE UNIQUE INDEX "machines_machine_code_key" ON "machines"("machine_code");

-- CreateIndex
CREATE UNIQUE INDEX "machines_serial_key" ON "machines"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "machines_uid_key" ON "machines"("uid");

-- CreateIndex
CREATE INDEX "machines_serial_idx" ON "machines"("serial");

-- CreateIndex
CREATE INDEX "machines_uid_idx" ON "machines"("uid");

-- CreateIndex
CREATE INDEX "machines_ip_address_idx" ON "machines"("ip_address");

-- CreateIndex
CREATE UNIQUE INDEX "machine_registration_requests_request_id_key" ON "machine_registration_requests"("request_id");

-- CreateIndex
CREATE INDEX "machine_registration_requests_status_created_at_idx" ON "machine_registration_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "machine_registration_requests_serial_idx" ON "machine_registration_requests"("serial");

-- CreateIndex
CREATE INDEX "machine_registration_requests_uid_idx" ON "machine_registration_requests"("uid");

-- CreateIndex
CREATE INDEX "machine_registration_requests_ip_address_idx" ON "machine_registration_requests"("ip_address");

-- CreateIndex
CREATE UNIQUE INDEX "machine_sync_states_machine_id_key" ON "machine_sync_states"("machine_id");

-- CreateIndex
CREATE INDEX "machine_sync_states_machine_code_idx" ON "machine_sync_states"("machine_code");

-- CreateIndex
CREATE INDEX "machine_sync_states_connection_status_idx" ON "machine_sync_states"("connection_status");

-- CreateIndex
CREATE INDEX "machine_connection_logs_machine_id_created_at_idx" ON "machine_connection_logs"("machine_id", "created_at");

-- CreateIndex
CREATE INDEX "machine_connection_logs_machine_code_created_at_idx" ON "machine_connection_logs"("machine_code", "created_at");

-- CreateIndex
CREATE INDEX "machine_connection_logs_event_type_created_at_idx" ON "machine_connection_logs"("event_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "machine_runtime_sessions_session_code_key" ON "machine_runtime_sessions"("session_code");

-- CreateIndex
CREATE INDEX "machine_runtime_sessions_machine_id_status_idx" ON "machine_runtime_sessions"("machine_id", "status");

-- CreateIndex
CREATE INDEX "machine_runtime_sessions_machine_code_last_seen_at_idx" ON "machine_runtime_sessions"("machine_code", "last_seen_at");

-- CreateIndex
CREATE INDEX "machine_runtime_sessions_status_last_seen_at_idx" ON "machine_runtime_sessions"("status", "last_seen_at");

-- CreateIndex
CREATE INDEX "machine_runtime_products_session_id_started_at_idx" ON "machine_runtime_products"("session_id", "started_at");

-- CreateIndex
CREATE INDEX "machine_runtime_products_machine_id_started_at_idx" ON "machine_runtime_products"("machine_id", "started_at");

-- CreateIndex
CREATE INDEX "machine_runtime_products_profile_id_idx" ON "machine_runtime_products"("profile_id");

-- CreateIndex
CREATE INDEX "machine_runtime_products_product_code_idx" ON "machine_runtime_products"("product_code");

-- CreateIndex
CREATE INDEX "machine_runtime_events_session_id_created_at_idx" ON "machine_runtime_events"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "machine_runtime_events_product_id_created_at_idx" ON "machine_runtime_events"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "machine_runtime_events_machine_id_created_at_idx" ON "machine_runtime_events"("machine_id", "created_at");

-- CreateIndex
CREATE INDEX "machine_runtime_events_event_type_created_at_idx" ON "machine_runtime_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "machine_runtime_adjustment_logs_session_id_created_at_idx" ON "machine_runtime_adjustment_logs"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "machine_runtime_adjustment_logs_product_id_created_at_idx" ON "machine_runtime_adjustment_logs"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "machine_runtime_adjustment_logs_adjusted_by_created_at_idx" ON "machine_runtime_adjustment_logs"("adjusted_by", "created_at");

-- CreateIndex
CREATE INDEX "machine_commands_machine_id_status_idx" ON "machine_commands"("machine_id", "status");

-- CreateIndex
CREATE INDEX "machine_commands_command_type_status_idx" ON "machine_commands"("command_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "chassis_codes_code_full_key" ON "chassis_codes"("code_full");

-- CreateIndex
CREATE UNIQUE INDEX "led_codes_code_full_key" ON "led_codes"("code_full");

-- CreateIndex
CREATE UNIQUE INDEX "product_profiles_chassis_code_id_key" ON "product_profiles"("chassis_code_id");

-- CreateIndex
CREATE INDEX "product_profiles_is_active_idx" ON "product_profiles"("is_active");

-- CreateIndex
CREATE INDEX "profile_led_codes_led_code_id_idx" ON "profile_led_codes"("led_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_led_codes_profile_id_led_code_id_key" ON "profile_led_codes"("profile_id", "led_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_led_codes_profile_id_led_slot_key" ON "profile_led_codes"("profile_id", "led_slot");

-- CreateIndex
CREATE INDEX "profile_snapshots_profile_id_version_idx" ON "profile_snapshots"("profile_id", "version");

-- CreateIndex
CREATE INDEX "scan_records_profile_id_duplicate_key_scan_at_idx" ON "scan_records"("profile_id", "duplicate_key", "scan_at");

-- CreateIndex
CREATE INDEX "scan_records_machine_id_scan_at_idx" ON "scan_records"("machine_id", "scan_at");

-- CreateIndex
CREATE INDEX "scan_records_scan_at_idx" ON "scan_records"("scan_at");

-- CreateIndex
CREATE INDEX "scan_records_sync_batch_id_idx" ON "scan_records"("sync_batch_id");

-- CreateIndex
CREATE INDEX "scan_records_runtime_session_id_idx" ON "scan_records"("runtime_session_id");

-- CreateIndex
CREATE INDEX "scan_records_runtime_product_id_idx" ON "scan_records"("runtime_product_id");

-- CreateIndex
CREATE INDEX "scan_records_ng_reason_idx" ON "scan_records"("ng_reason");

-- CreateIndex
CREATE UNIQUE INDEX "scan_records_machine_id_local_scan_id_key" ON "scan_records"("machine_id", "local_scan_id");

-- CreateIndex
CREATE INDEX "scan_led_items_scan_record_id_idx" ON "scan_led_items"("scan_record_id");

-- CreateIndex
CREATE INDEX "scan_led_items_ng_reason_idx" ON "scan_led_items"("ng_reason");

-- CreateIndex
CREATE INDEX "recent_duplicate_keys_expires_at_idx" ON "recent_duplicate_keys"("expires_at");

-- CreateIndex
CREATE INDEX "recent_duplicate_keys_first_scan_record_id_idx" ON "recent_duplicate_keys"("first_scan_record_id");

-- CreateIndex
CREATE INDEX "recent_duplicate_keys_first_machine_id_idx" ON "recent_duplicate_keys"("first_machine_id");

-- CreateIndex
CREATE UNIQUE INDEX "recent_duplicate_keys_profile_id_duplicate_key_key" ON "recent_duplicate_keys"("profile_id", "duplicate_key");

-- CreateIndex
CREATE UNIQUE INDEX "scan_sync_batches_batch_code_key" ON "scan_sync_batches"("batch_code");

-- CreateIndex
CREATE INDEX "scan_sync_batches_machine_id_created_at_idx" ON "scan_sync_batches"("machine_id", "created_at");

-- CreateIndex
CREATE INDEX "scan_sync_batches_status_created_at_idx" ON "scan_sync_batches"("status", "created_at");

-- CreateIndex
CREATE INDEX "historical_duplicate_jobs_profile_id_status_idx" ON "historical_duplicate_jobs"("profile_id", "status");

-- CreateIndex
CREATE INDEX "historical_duplicate_jobs_status_created_at_idx" ON "historical_duplicate_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "historical_duplicate_results_job_id_idx" ON "historical_duplicate_results"("job_id");

-- CreateIndex
CREATE INDEX "historical_duplicate_results_profile_id_duplicate_key_idx" ON "historical_duplicate_results"("profile_id", "duplicate_key");

-- CreateIndex
CREATE INDEX "sync_request_logs_machine_id_local_scan_id_idx" ON "sync_request_logs"("machine_id", "local_scan_id");

-- CreateIndex
CREATE INDEX "sync_request_logs_batch_code_idx" ON "sync_request_logs"("batch_code");

-- CreateIndex
CREATE INDEX "sync_request_logs_request_type_created_at_idx" ON "sync_request_logs"("request_type", "created_at");

-- CreateIndex
CREATE INDEX "sync_request_logs_status_created_at_idx" ON "sync_request_logs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "error_codes_code_key" ON "error_codes"("code");

-- CreateIndex
CREATE INDEX "error_codes_group_name_idx" ON "error_codes"("group_name");

-- CreateIndex
CREATE INDEX "error_codes_severity_idx" ON "error_codes"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_noti_code_key" ON "notification_templates"("noti_code");

-- CreateIndex
CREATE INDEX "notification_templates_target_idx" ON "notification_templates"("target");

-- CreateIndex
CREATE INDEX "notification_templates_severity_idx" ON "notification_templates"("severity");

-- CreateIndex
CREATE INDEX "notification_events_noti_code_idx" ON "notification_events"("noti_code");

-- CreateIndex
CREATE INDEX "notification_events_error_code_idx" ON "notification_events"("error_code");

-- CreateIndex
CREATE INDEX "notification_events_machine_id_created_at_idx" ON "notification_events"("machine_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_events_scan_record_id_idx" ON "notification_events"("scan_record_id");

-- CreateIndex
CREATE INDEX "notification_events_batch_id_idx" ON "notification_events"("batch_id");

-- CreateIndex
CREATE INDEX "notification_events_status_created_at_idx" ON "notification_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "server_settings" ADD CONSTRAINT "server_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_registration_requests" ADD CONSTRAINT "machine_registration_requests_approved_machine_id_fkey" FOREIGN KEY ("approved_machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_sync_states" ADD CONSTRAINT "machine_sync_states_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_connection_logs" ADD CONSTRAINT "machine_connection_logs_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_sessions" ADD CONSTRAINT "machine_runtime_sessions_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_sessions" ADD CONSTRAINT "machine_runtime_sessions_current_product_id_fkey" FOREIGN KEY ("current_product_id") REFERENCES "machine_runtime_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_products" ADD CONSTRAINT "machine_runtime_products_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "machine_runtime_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_products" ADD CONSTRAINT "machine_runtime_products_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_products" ADD CONSTRAINT "machine_runtime_products_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "product_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_events" ADD CONSTRAINT "machine_runtime_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "machine_runtime_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_events" ADD CONSTRAINT "machine_runtime_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "machine_runtime_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_events" ADD CONSTRAINT "machine_runtime_events_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_events" ADD CONSTRAINT "machine_runtime_events_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "product_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_adjustment_logs" ADD CONSTRAINT "machine_runtime_adjustment_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "machine_runtime_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_adjustment_logs" ADD CONSTRAINT "machine_runtime_adjustment_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "machine_runtime_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_runtime_adjustment_logs" ADD CONSTRAINT "machine_runtime_adjustment_logs_adjusted_by_fkey" FOREIGN KEY ("adjusted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_commands" ADD CONSTRAINT "machine_commands_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_commands" ADD CONSTRAINT "machine_commands_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_profiles" ADD CONSTRAINT "product_profiles_chassis_code_id_fkey" FOREIGN KEY ("chassis_code_id") REFERENCES "chassis_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_profiles" ADD CONSTRAINT "product_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_led_codes" ADD CONSTRAINT "profile_led_codes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "product_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_led_codes" ADD CONSTRAINT "profile_led_codes_led_code_id_fkey" FOREIGN KEY ("led_code_id") REFERENCES "led_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "product_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_records" ADD CONSTRAINT "scan_records_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_records" ADD CONSTRAINT "scan_records_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "product_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_records" ADD CONSTRAINT "scan_records_profile_snapshot_id_fkey" FOREIGN KEY ("profile_snapshot_id") REFERENCES "profile_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_records" ADD CONSTRAINT "scan_records_sync_batch_id_fkey" FOREIGN KEY ("sync_batch_id") REFERENCES "scan_sync_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_records" ADD CONSTRAINT "scan_records_runtime_session_id_fkey" FOREIGN KEY ("runtime_session_id") REFERENCES "machine_runtime_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_records" ADD CONSTRAINT "scan_records_runtime_product_id_fkey" FOREIGN KEY ("runtime_product_id") REFERENCES "machine_runtime_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_led_items" ADD CONSTRAINT "scan_led_items_scan_record_id_fkey" FOREIGN KEY ("scan_record_id") REFERENCES "scan_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_duplicate_keys" ADD CONSTRAINT "recent_duplicate_keys_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "product_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_duplicate_keys" ADD CONSTRAINT "recent_duplicate_keys_first_scan_record_id_fkey" FOREIGN KEY ("first_scan_record_id") REFERENCES "scan_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_duplicate_keys" ADD CONSTRAINT "recent_duplicate_keys_first_machine_id_fkey" FOREIGN KEY ("first_machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_sync_batches" ADD CONSTRAINT "scan_sync_batches_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_duplicate_jobs" ADD CONSTRAINT "historical_duplicate_jobs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "product_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_duplicate_jobs" ADD CONSTRAINT "historical_duplicate_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_duplicate_results" ADD CONSTRAINT "historical_duplicate_results_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "historical_duplicate_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_duplicate_results" ADD CONSTRAINT "historical_duplicate_results_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "product_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_request_logs" ADD CONSTRAINT "sync_request_logs_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_scan_record_id_fkey" FOREIGN KEY ("scan_record_id") REFERENCES "scan_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "scan_sync_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
