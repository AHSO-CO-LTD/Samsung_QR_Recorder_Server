export type UserRole = "OPERATOR" | "ENGINEER" | "ADMIN" | "DEV";

export type Machine = {
  id: number;
  machine_code: string;
  machine_name: string;
  line_name?: string | null;
  station_name?: string | null;
  ip_address?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sync_state?: {
    connection_status: string;
    last_seen_at?: string | null;
    local_pending_sync: number;
  } | null;
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
  factory_code: string;
  version: number;
  is_active: boolean;
  updated_at: string;
  chassis_code?: ChassisCode;
  vendor?: Vendor;
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
  duplicate_key: string;
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
    led_scan_raw: string;
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
  profile?: Profile;
  job?: {
    id: number;
    status: string;
  };
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

export type NotificationEvent = {
  id: number;
  noti_code: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  created_at: string;
  machine?: Machine | null;
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
