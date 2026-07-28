export type UserRole = "OPERATOR" | "ENGINEER" | "ADMIN" | "DEV";

export type Machine = {
  id: number;
  machine_code: string;
  machine_name: string;
  serial?: string | null;
  uid?: string | null;
  license_key_raw?: string | null;
  license_activated_at?: string | null;
  line_name?: string | null;
  station_name?: string | null;
  ip_address?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  _count?: {
    scan_records?: number;
  };
  sync_state?: {
    connection_status: string;
    last_seen_at?: string | null;
    last_ip_address?: string | null;
    local_total_record?: number;
    local_ok_record?: number;
    local_ng_record?: number;
    local_pending_sync: number;
    app_version?: string | null;
    local_db_version?: string | null;
  } | null;
};

export type MachineRegistrationRequest = {
  id: number;
  request_id: string;
  requested_machine_code?: string | null;
  serial: string;
  uid: string;
  license_key_raw?: string | null;
  license_file_json?: unknown;
  license_activated_at?: string | null;
  license_activated_by?: number | null;
  ip_address: string;
  hostname?: string | null;
  app_version?: string | null;
  local_db_version?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approved_machine_code?: string | null;
  approved_at?: string | null;
  rejected_reason?: string | null;
  rejected_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type MachineCommand = {
  id: number;
  command_type: "SYNC_PROFILE" | "SYNC_SCAN_DATA" | "RELOAD_CONFIG" | "SHOW_MESSAGE";
  payload_json?: unknown;
  status: "PENDING" | "SENT" | "ACK" | "FAILED" | "CANCELLED";
  created_at: string;
  sent_at?: string | null;
  ack_at?: string | null;
  error_message?: string | null;
};

export type Vendor = {
  id: number;
  vendor_name: string;
  vendor_char: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ChassisCode = {
  id: number;
  code_full: string;
  code_input: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_profile?: Profile | null;
};

export type LedCode = {
  id: number;
  code_full: string;
  code_input: string;
  suffix_check: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: number;
  chassis_code_id?: number;
  factory_code: string;
  full_code_length: number;
  full_vendor_position: number;
  led_scan_length: number;
  led_vendor_position: number;
  version: number;
  is_active: boolean;
  created_at?: string;
  updated_at: string;
  chassis_code?: ChassisCode;
  profile_led_codes?: Array<{
    id: number;
    led_slot: number;
    is_required: boolean;
    led_code?: LedCode;
  }>;
};

export type ScanRecord = {
  id: number;
  local_scan_id: string;
  full_code_raw: string;
  full_chassis_code?: string;
  full_before_vendor?: string;
  full_vendor_char: string;
  full_led_code?: string;
  full_factory_code?: string;
  full_after_factory?: string;
  duplicate_key: string;
  chassis_scan_raw?: string;
  local_status: string;
  server_status: string;
  final_status: string;
  ng_reason?: string | null;
  scan_at: string;
  machine?: Machine;
  profile?: Profile;
  led_items?: Array<{
    id: number;
    led_slot: number;
    led_index: number;
    led_scan_raw: string;
    led_lot_no?: string;
    vendor_char: string;
    led_suffix: string;
    local_status: string;
    ng_reason?: string | null;
  }>;
};

export type DuplicateKey = {
  id: number;
  duplicate_key: string;
  first_scan_at: string;
  expires_at: string;
  profile?: Profile;
  first_machine?: Machine;
  first_scan_record_id: number;
};

export type HistoricalDuplicateResult = {
  id: number;
  duplicate_key: string;
  total_count: number;
  first_scan_at: string;
  latest_scan_at: string;
  scan_record_ids_json?: number[];
  profile?: Profile;
  job?: {
    id: number;
    status: string;
    trigger_type?: string;
    from_date?: string;
    to_date?: string;
    started_at?: string | null;
    finished_at?: string | null;
    created_at?: string;
  };
};

export type HistoricalDuplicateJob = {
  id: number;
  profile_id?: number | null;
  from_date: string;
  to_date: string;
  trigger_type: "MANUAL_RANGE" | "MANUAL_FULL" | "SCHEDULED_FULL";
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  _count?: {
    results: number;
  };
};

export type HistoricalDuplicateSchedule = {
  id?: number | null;
  enabled: boolean;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  run_time: string;
  day_of_week: number;
  day_of_month: number;
  last_run_at?: string | null;
  next_run_at?: string | null;
};

export type HistoricalDuplicateScheduleOverview = {
  schedule: HistoricalDuplicateSchedule;
  latest_job?: HistoricalDuplicateJob | null;
};

export type FullAuditJobProfileCount = {
  profile_id: number;
  profile_label: string;
  total_codes: number;
};

export type FullAuditJobDuplicateProfile = {
  profile_id: number;
  profile_label: string;
  duplicate_group_count: number;
  duplicate_scan_count: number;
  duplicate_keys: string[];
};

export type FullAuditJobDuplicateKey = {
  id: number;
  profile_id: number;
  profile_label: string;
  duplicate_key: string;
  total_count: number;
  first_scan_at: string;
  latest_scan_at: string;
  scan_record_ids_json?: number[];
};

export type FullAuditJobDetail = {
  job: HistoricalDuplicateJob;
  total_scanned_codes: number;
  profile_count: number;
  profile_counts: FullAuditJobProfileCount[];
  duplicate_group_count: number;
  duplicate_scan_count: number;
  duplicate_extra_count: number;
  duplicate_profiles: FullAuditJobDuplicateProfile[];
  duplicate_keys: FullAuditJobDuplicateKey[];
};

export type SyncBatch = {
  id: number;
  batch_code: string;
  trigger_type: string;
  total_received: number;
  total_ok: number;
  total_ng: number;
  status: string;
  created_at: string;
  finished_at?: string | null;
  machine?: Machine;
};

export type SyncRequestLog = {
  id: number;
  local_scan_id?: string | null;
  batch_code?: string | null;
  request_type: string;
  status: string;
  error_message?: string | null;
  created_at: string;
  machine?: Machine;
};

export type MachineRuntimeProduct = {
  id: number;
  session_id: number;
  machine_id: number;
  machine_code: string;
  profile_id?: number | null;
  product_code: string;
  total_count: number;
  ok_count: number;
  ng_count: number;
  last_result?: string | null;
  last_code?: string | null;
  last_local_scan_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile | null;
};

export type MachineRuntimeEvent = {
  id: number;
  session_id?: number | null;
  product_id?: number | null;
  machine_id: number;
  machine_code: string;
  profile_id?: number | null;
  event_type: string;
  product_code?: string | null;
  total_count?: number | null;
  ok_count?: number | null;
  ng_count?: number | null;
  last_result?: string | null;
  last_code?: string | null;
  local_scan_id?: string | null;
  ip_address?: string | null;
  payload_json?: unknown;
  created_at: string;
};

export type MachineRuntimeAdjustmentLog = {
  id: number;
  session_id: number;
  product_id?: number | null;
  adjusted_by?: number | null;
  reason: string;
  old_value_json: unknown;
  new_value_json: unknown;
  created_at: string;
  adjustedBy?: Pick<AppUser, "id" | "username" | "full_name" | "role"> | null;
};

export type MachineRuntimeSession = {
  id: number;
  session_code: string;
  machine_id: number;
  machine_code: string;
  status: "RUNNING" | "PAUSED" | "STOPPED" | "DISCONNECTED" | "ERROR";
  source?: "WEBSOCKET" | "HEARTBEAT";
  current_product_id?: number | null;
  total_count: number;
  ok_count: number;
  ng_count: number;
  last_result?: string | null;
  last_code?: string | null;
  last_local_scan_id?: string | null;
  last_result_at?: string | null;
  reconnect_count: number;
  started_at: string;
  ended_at?: string | null;
  disconnected_at?: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
  machine?: Machine;
  current_product?: MachineRuntimeProduct | null;
  products?: MachineRuntimeProduct[];
  events?: MachineRuntimeEvent[];
  scan_records?: ScanRecord[];
  latest_scan_record?: ScanRecord | null;
  adjustments?: MachineRuntimeAdjustmentLog[];
};

export type NotificationEvent = {
  id: number;
  noti_code: string;
  title: string;
  message: string;
  title_vi?: string | null;
  message_vi?: string | null;
  title_en?: string | null;
  message_en?: string | null;
  payload_json?: unknown;
  severity: string;
  status: string;
  created_at: string;
  machine?: Machine | null;
};

export type NotificationTemplate = {
  id: number;
  noti_code: string;
  title_template: string;
  message_template: string;
  title_template_vi?: string | null;
  message_template_vi?: string | null;
  title_template_en?: string | null;
  message_template_en?: string | null;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  target: "SERVER_UI" | "LOCAL_UI" | "BOTH";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ServerSettings = {
  id: number;
  factory_code_default: string;
  full_code_length_default: number;
  full_vendor_position_default: number;
  led_scan_length_default: number;
  led_vendor_position_default: number;
  duplicate_days: number;
  heartbeat_timeout_seconds: number;
};

export type AppUser = {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: number;
  action: string;
  table_name: string;
  record_id: string;
  created_at: string;
  user?: Pick<AppUser, "id" | "username" | "full_name" | "role"> | null;
};
