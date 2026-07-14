import fs from "node:fs";

const sqlDocPath = "document/11-sql-khoi-tao-db-may-local-python-postgres.md";
const apiDocPath = "document/10-huong-dan-api-may-local-python.md";
const generatedAt = "2026-07-13";

const source = fs.readFileSync(sqlDocPath, "utf8");
const match = source.match(/```sql\nBEGIN;([\s\S]*?)COMMIT;\n```/);

if (!match) {
  throw new Error(`Cannot find main SQL block in ${sqlDocPath}`);
}

const sql = `BEGIN;${match[1]}COMMIT;`;

const tablePurposes = {
  schema_migrations: "Ghi nhận version migration đã áp dụng cho database local để biết máy đang ở schema nào.",
  id_counters: "Cấp sequence theo ngày cho local_scan_id và batch_code, dùng an toàn trong transaction khi app có nhiều luồng.",
  local_app_settings: "Bảng cấu hình trung tâm của app local. Chỉ một dòng id = 1, lưu server, định danh máy, trạng thái runtime và các mốc sync.",
  server_settings_cache: "Cache server settings tải từ API config: rule độ dài code, vị trí vendor, duplicate window và heartbeat timeout.",
  machine_cache: "Cache thông tin chính máy local sau khi server định danh: mã máy, serial, uid, line, station, IP và active state.",
  vendor_cache: "Cache danh sách vendor active từ server. Vendor không còn nằm cố định trong profile; local lấy vendor từ ký tự thứ 18 của full code rồi tra bảng này.",
  profile_cache: "Cache profile active từ server để local parse full code, kiểm factory, chassis, LED và chọn mã hàng chạy.",
  profile_led_code_cache: "Cache tối đa 2 LED code/slot thuộc từng profile để local kiểm LED scan theo slot và suffix.",
  local_scan_records: "Bảng scan chính của máy local. Mỗi lượt scan phải lưu tại đây trước khi gọi server để retry giữ nguyên local_scan_id.",
  local_scan_led_items: "Chi tiết từng LED item trong một scan local, dùng truy vết lỗi LED và tạo manifest khi reconcile.",
  local_duplicate_keys: "Duplicate cục bộ của máy local theo profile và scope, chỉ dùng cảnh báo local, không thay duplicate nhiều ngày của server.",
  sync_batches: "Header batch sync khi local gửi các scan pending/offline lên server.",
  sync_batch_items: "Kết quả từng scan nằm trong batch sync để biết record nào OK, NG, fail hoặc cần retry.",
  command_inbox: "Inbox command server gửi qua polling. Local lưu command, xử lý rồi ack/fail lại server.",
  local_notifications: "Thông báo nội bộ cho UI Python local, khác với notification_events của server UI.",
  api_request_logs: "Log request/response khi local gọi API server, phục vụ debug máy local đã gửi gì và server trả gì.",
  app_event_logs: "Log sự kiện runtime nội bộ của app local như boot, parse lỗi, DB lỗi, reconnect hoặc worker crash."
};

const groups = [
  ["Nền tảng vận hành local", ["schema_migrations", "id_counters", "local_app_settings"]],
  ["Cache dữ liệu từ server", ["server_settings_cache", "machine_cache", "vendor_cache", "profile_cache", "profile_led_code_cache"]],
  ["Scan, LED và duplicate local", ["local_scan_records", "local_scan_led_items", "local_duplicate_keys"]],
  ["Sync offline và reconcile", ["sync_batches", "sync_batch_items"]],
  ["Command, thông báo và log", ["command_inbox", "local_notifications", "api_request_logs", "app_event_logs"]]
];

const enumDescriptions = {
  local_scan_status: "Kết quả kiểm tra ở phía local trước khi gửi server.",
  server_scan_status: "Kết quả server trả cho một scan.",
  final_scan_status: "Kết luận cuối cùng local hiển thị cho người vận hành.",
  local_sync_status: "Trạng thái đồng bộ của scan local với server.",
  duplicate_local_scope: "Phạm vi duplicate cục bộ trên máy local.",
  sync_batch_trigger_type: "Lý do tạo batch sync.",
  sync_batch_status: "Trạng thái gửi batch sync.",
  machine_command_type: "Loại command server yêu cầu local thực thi.",
  command_local_status: "Trạng thái xử lý command trong app local.",
  command_ack_status: "Kết quả ack command gửi về server.",
  local_notification_severity: "Mức độ thông báo local.",
  local_notification_status: "Trạng thái đọc/ẩn của thông báo local.",
  local_notification_source: "Nguồn phát sinh thông báo local.",
  api_request_method: "HTTP method của request local gọi lên server.",
  app_event_level: "Mức log nội bộ app local."
};

const viewDescriptions = {
  v_pending_sync_scans: "Danh sách scan còn cần đồng bộ hoặc retry lên server.",
  v_active_profiles: "Profile active kèm LED slots để local chọn mã hàng và validate scan.",
  v_today_scan_summary: "Tổng hợp OK/NG/pending trong ngày của máy local.",
  v_latest_notifications: "Danh sách thông báo local mới nhất để UI hiển thị.",
  v_local_runtime_status: "Trạng thái tổng hợp hiện tại của app/máy local."
};

const exactDescriptions = {
  version: "Version/schema/migration hoặc version profile tùy bảng.",
  name: "Tên mô tả ngắn của bản ghi.",
  applied_at: "Thời điểm migration được ghi nhận đã áp dụng.",
  counter_name: "Tên bộ đếm, ví dụ local_scan_sequence hoặc batch_sequence.",
  counter_date: "Ngày áp dụng bộ đếm. Sequence thường reset theo ngày.",
  current_value: "Giá trị sequence hiện tại.",
  server_host: "IP hoặc hostname của máy server mà local gọi API.",
  api_port: "Port API server, mặc định 3979.",
  machine_code: "Mã máy local chính thức sau khi server định danh.",
  machine_serial: "Serial phần cứng ổn định của máy local, thường lấy từ mainboard.",
  machine_uid: "UID ổn định của app/máy local, dùng cùng serial để định danh.",
  machine_license_key: "Raw license local muốn lưu để đối chiếu; flow hiện tại có thể là serial + uid.",
  registration_request_id: "Request ID server trả khi local gửi register-request.",
  registration_status: "Trạng thái định danh local: NOT_REQUESTED, PENDING, APPROVED, REJECTED hoặc DUPLICATE.",
  license_activated_at: "Thời điểm server đã import/kích hoạt license cho request này, nếu có.",
  active_profile_id: "Profile đang được chọn để chạy trên local.",
  app_version: "Version app Python local đang chạy.",
  local_db_version: "Version schema/data local DB hiện tại.",
  duplicate_scope: "Scope duplicate cục bộ mà local đang dùng.",
  server_online: "Kết quả kiểm tra kết nối server gần nhất.",
  local_runtime_status: "Trạng thái tổng hợp cho UI local: BOOTING, READY, SCANNING, SYNCING, BLOCKED...",
  local_status_message: "Thông điệp ngắn giải thích trạng thái hiện tại cho người vận hành.",
  local_status_updated_at: "Thời điểm cập nhật trạng thái UI local gần nhất.",
  last_health_at: "Lần cuối local kiểm tra health/kết nối server thành công.",
  last_config_sync_at: "Lần cuối local tải cấu hình/profile từ server.",
  last_heartbeat_at: "Lần cuối local gửi heartbeat thành công.",
  last_server_error_code: "Mã lỗi server gần nhất local nhận được.",
  last_server_error_message: "Thông điệp lỗi server gần nhất local nhận được.",
  factory_code_default: "Factory code mặc định dùng khi validate full code.",
  full_code_length_default: "Độ dài full code mặc định.",
  full_vendor_position_default: "Vị trí ký tự vendor trong full code mặc định.",
  led_scan_length_default: "Độ dài LED scan mặc định.",
  led_vendor_position_default: "Vị trí ký tự vendor trong LED scan mặc định.",
  duplicate_days: "Số ngày server dùng để kiểm duplicate; local lưu để hiển thị/đồng bộ rule.",
  heartbeat_timeout_seconds: "Ngưỡng timeout heartbeat server cấu hình.",
  server_machine_id: "ID máy trên database server, nếu API trả về.",
  machine_name: "Tên máy local hiển thị trên server/UI.",
  serial: "Serial đã được server duyệt cho máy này.",
  uid: "UID đã được server duyệt cho máy này.",
  line_name: "Tên line sản xuất của máy.",
  station_name: "Tên station/trạm của máy.",
  ip_address: "IP cấu hình hoặc IP đã biết của máy local.",
  chassis_code_id: "ID chassis code trên server, nếu có.",
  chassis_code_full: "Mã chassis đầy đủ dùng để validate full/chassis scan.",
  chassis_code_input: "Mã chassis dạng input/ngắn nếu server có.",
  vendor_id: "ID vendor trên server, nếu có.",
  vendor_name: "Tên vendor hiển thị.",
  vendor_char: "Ký tự vendor hợp lệ trong full code và LED scan.",
  factory_code: "Factory code hợp lệ của profile.",
  full_code_length: "Độ dài full code áp dụng cho profile này.",
  full_vendor_position: "Vị trí vendor trong full code áp dụng cho profile này.",
  led_scan_length: "Độ dài LED scan áp dụng cho profile này.",
  led_vendor_position: "Vị trí vendor trong LED scan áp dụng cho profile này.",
  led_slot: "Số slot LED trong profile, bắt đầu từ 1.",
  led_code_id: "ID LED code trên server, nếu có.",
  code_full: "Mã đầy đủ của chassis/LED code.",
  code_input: "Mã dạng input/ngắn nếu có.",
  suffix_check: "Suffix local phải kiểm trong LED scan.",
  local_scan_id: "ID scan duy nhất do local tạo. Retry phải dùng lại đúng ID này.",
  profile_version: "Version profile local dùng khi scan.",
  duplicate_key: "Khóa duplicate local/server dùng để so trùng, tạo từ before_vendor + vendor_char + after_factory.",
  full_code_raw: "Full code thô nhận từ scanner/camera/OCR.",
  full_prefix: "Đoạn prefix parse được từ full code.",
  full_chassis_segment: "Đoạn chassis segment parse được từ full code.",
  full_chassis_code: "Mã chassis parse được từ full code.",
  full_before_vendor: "Đoạn ký tự trước vendor trong full code.",
  full_vendor_char: "Ký tự vendor parse được từ full code.",
  full_led_code: "Đoạn LED code parse được từ full code.",
  full_factory_code: "Factory code parse được từ full code.",
  full_after_factory: "Đoạn ký tự sau factory code trong full code.",
  chassis_scan_raw: "Chuỗi chassis scan thô nếu local có scan riêng.",
  full_code_json: "JSON cấu trúc full_code sẽ gửi server.",
  led_scans_json: "JSON danh sách led_scans sẽ gửi server.",
  local_status: "Kết quả local tự validate trước khi gọi server: OK hoặc NG.",
  local_ng_reason: "Lý do local NG như LED_SUFFIX_NOT_MATCH, LOCAL_DUPLICATE...",
  server_code: "Mã code server trả, ví dụ SERVER_OK hoặc SERVER_DUPLICATE.",
  server_message: "Message server trả cho scan/batch.",
  server_scan_id: "ID scan record trên server nếu server đã lưu.",
  server_first_scan_id: "ID scan đầu tiên server trả khi phát hiện duplicate.",
  server_status: "Trạng thái server trả: PENDING, OK, NG, SKIPPED hoặc UNKNOWN.",
  final_status: "Kết luận cuối cùng local hiển thị: OK, NG, PENDING hoặc PENDING_SERVER.",
  final_ng_reason: "Lý do NG cuối cùng sau khi gộp local/server result.",
  sync_status: "Trạng thái sync của record này.",
  sync_attempt_count: "Số lần local đã thử gửi/sync record này.",
  last_sync_at: "Lần cuối record được gửi server thành công hoặc có response.",
  next_retry_at: "Thời điểm local nên retry nếu lỗi tạm thời.",
  last_error_code: "Mã lỗi cuối cùng khi gửi/sync record.",
  last_error_message: "Message lỗi cuối cùng khi gửi/sync record.",
  scan_at: "Thời điểm scan gốc trên máy local.",
  scan_id: "FK tới local_scan_records.id.",
  led_index: "Thứ tự LED item trong slot nếu có nhiều item.",
  led_scan_raw: "Chuỗi LED scan thô.",
  led_lot_no: "Lot number parse được từ LED scan.",
  led_suffix: "Suffix parse được để so với suffix_check.",
  scope_key: "Khóa scope local, ví dụ ngày hoặc máy-ngày tùy duplicate_scope.",
  first_local_scan_id: "Scan local đầu tiên tạo ra duplicate key này.",
  first_scan_at: "Thời điểm scan đầu tiên trong scope local.",
  trigger_type: "Lý do tạo batch: STARTUP, SHUTDOWN, NETWORK_RESTORED hoặc MANUAL.",
  total_sent: "Số scan local gửi trong batch.",
  total_ok: "Số scan trong batch được server chốt OK.",
  total_ng: "Số scan trong batch được chốt NG.",
  total_failed: "Số scan gửi lỗi hoặc không được xử lý.",
  server_batch_id: "ID batch trên server nếu API trả về.",
  summary_json: "Tổng hợp batch gửi server hoặc kết quả xử lý.",
  started_at: "Thời điểm bắt đầu xử lý/gửi.",
  finished_at: "Thời điểm hoàn tất xử lý/gửi.",
  batch_id: "FK tới sync_batches.id.",
  result_success: "Record này có sync thành công trong batch hay không.",
  result_code: "Code server hoặc local cho record trong batch.",
  result_message: "Message server hoặc local cho record trong batch.",
  server_command_id: "ID command trên server.",
  command_type: "Loại command cần xử lý.",
  server_status: "Status command/scan theo server nếu API trả về.",
  received_at: "Thời điểm local nhận command.",
  ack_sent_at: "Thời điểm local gửi ACK/FAILED về server.",
  ack_status: "ACK hoặc FAILED gửi về server.",
  noti_code: "Mã loại thông báo local.",
  severity: "Mức độ INFO, WARNING, ERROR hoặc CRITICAL.",
  title: "Tiêu đề ngắn hiển thị trên UI local.",
  message: "Nội dung chi tiết hiển thị trên UI local.",
  source: "Nguồn thông báo: LOCAL, SERVER_COMMAND hoặc SERVER_RESPONSE.",
  related_local_scan_id: "Scan local liên quan nếu có.",
  related_batch_code: "Batch sync liên quan nếu có.",
  related_server_command_id: "Command server liên quan nếu có.",
  read_at: "Thời điểm người dùng đọc thông báo.",
  dismissed_at: "Thời điểm người dùng ẩn thông báo.",
  request_type: "Tên nghiệp vụ request, ví dụ SUBMIT_SCAN, HEARTBEAT, RECONCILE_CHECK.",
  method: "HTTP method request.",
  url: "URL server mà local gọi.",
  command_inbox_id: "Command inbox liên quan nếu request là ACK command.",
  response_status_code: "HTTP status code server trả.",
  result_code: "Code nghiệp vụ server trả.",
  success: "Request có được coi là thành công hay không.",
  duration_ms: "Thời gian request tính bằng millisecond.",
  level: "Mức log nội bộ.",
  event_code: "Mã sự kiện nội bộ."
};

const tableFieldDescriptions = {
  "command_inbox.local_status": "Trạng thái local xử lý command: PENDING, RUNNING, ACKED, FAILED hoặc SKIPPED.",
  "local_scan_records.local_status": "Kết quả local tự validate trước khi gọi server: OK hoặc NG.",
  "local_scan_led_items.local_status": "Kết quả validate riêng cho LED item này: OK hoặc NG.",
  "local_notifications.message": "Nội dung chi tiết của thông báo hiển thị trên UI local.",
  "app_event_logs.message": "Nội dung log nội bộ của app local."
};

const commonDescriptions = {
  id: "Khóa chính nội bộ của bảng.",
  raw_json: "JSON gốc nhận từ server/API để đối chiếu khi cần debug.",
  payload_json: "Payload JSON liên quan tới event, command hoặc thông báo.",
  request_json: "Payload request đã gửi.",
  response_json: "Response JSON đã nhận.",
  error_message: "Thông điệp lỗi nếu thao tác thất bại.",
  status: "Trạng thái hiện tại của bản ghi.",
  is_active: "Bản ghi còn active và được local sử dụng hay không.",
  is_required: "Bản ghi/slot này có bắt buộc hay không.",
  created_at: "Thời điểm tạo bản ghi.",
  updated_at: "Thời điểm cập nhật bản ghi gần nhất.",
  synced_at: "Thời điểm dữ liệu được sync/cache từ server.",
  profile_id: "ID profile liên quan."
};

const tableUsageHints = {
  schema_migrations: "kiểm soát version schema local khi cài mới hoặc nâng cấp DB.",
  id_counters: "cấp số tuần tự an toàn cho local_scan_id, batch_code hoặc các mã local khác.",
  local_app_settings: "lưu cấu hình vận hành và trạng thái định danh của đúng máy local này.",
  server_settings_cache: "giữ bản cache cấu hình server để local vẫn validate được khi mất mạng.",
  machine_cache: "giữ thông tin máy đã được server duyệt để local không phụ thuộc vào machine_code khi khởi động.",
  vendor_cache: "giữ danh sách vendor active để local tra cứu ký tự vendor parse từ full code.",
  profile_cache: "giữ danh sách mã hàng/profile mà máy local được phép chọn và chạy.",
  profile_led_code_cache: "giữ cấu hình LED theo từng profile để local validate từng LED scan.",
  local_scan_records: "lưu bản ghi scan chính trước khi gọi server, hỗ trợ retry, duplicate và truy vết.",
  local_scan_led_items: "lưu chi tiết từng LED scan thuộc một lượt scan chính.",
  local_duplicate_keys: "chặn trùng cục bộ nhanh trước khi gửi dữ liệu lên server.",
  sync_batches: "gom các scan cần đồng bộ offline thành từng batch có thể retry.",
  sync_batch_items: "ghi kết quả sync của từng scan trong một batch.",
  command_inbox: "lưu lệnh server gửi xuống để local xử lý và ACK lại.",
  local_notifications: "lưu thông báo nội bộ để app Python local hiển thị và truy vết.",
  api_request_logs: "ghi log mọi request local gọi lên server để debug kết nối/API.",
  app_event_logs: "ghi log sự kiện nội bộ của app local để điều tra lỗi vận hành."
};

const tableActionHints = {
  schema_migrations: "Migration tool ghi sau khi chạy script; app đọc khi nâng cấp để biết version nào đã áp dụng.",
  id_counters: "App đọc và update trong transaction khi cần sinh mã mới; không sửa tay trong lúc máy đang chạy.",
  local_app_settings: "App đọc khi startup, cập nhật sau register/config/heartbeat và dùng để hiển thị trạng thái local.",
  server_settings_cache: "App upsert sau khi gọi API lấy config; màn hình vận hành và validator đọc cache này.",
  machine_cache: "App upsert khi server trả thông tin máy; startup/config/status đọc lại theo serial + uid.",
  vendor_cache: "App upsert từ data.vendors của API config; validator đọc theo vendor_char khi parse full code.",
  profile_cache: "App upsert sau config sync; màn chọn mã hàng và logic validate scan đọc bảng này.",
  profile_led_code_cache: "App upsert cùng profile; validator đọc theo profile_id và led_slot khi kiểm tra LED.",
  local_scan_records: "App insert ngay khi có scan, sau đó update theo kết quả local/server/reconcile.",
  local_scan_led_items: "App insert theo từng LED item sau khi parse; update khi validate lại hoặc sync lại.",
  local_duplicate_keys: "App tra cứu trước khi nhận scan mới và insert khi scan được chấp nhận trong scope duplicate.",
  sync_batches: "App tạo khi sync offline/manual/startup; update tổng kết sau khi server phản hồi.",
  sync_batch_items: "App tạo theo từng record trong batch; update result sau khi xử lý từng scan.",
  command_inbox: "App lưu command khi poll được, update trạng thái xử lý rồi gửi ACK/FAILED lên server.",
  local_notifications: "App insert khi có cảnh báo/lỗi/sự kiện; UI đọc và update read_at/dismissed_at.",
  api_request_logs: "HTTP client ghi sau mỗi lần gọi server; dùng để xem lại request/response và thời gian phản hồi.",
  app_event_logs: "App ghi append-only khi có lỗi hoặc mốc vận hành quan trọng; dùng cho debug nội bộ."
};

const fieldReasonOverrides = {
  "local_scan_records.local_scan_id": "Cần một ID nghiệp vụ ổn định do local tạo để retry nhiều lần vẫn là cùng một lượt scan.",
  "local_scan_led_items.local_scan_id": "Cần giữ ID scan nghiệp vụ của bản ghi cha để gửi payload và debug theo đúng lượt scan.",
  "sync_batch_items.local_scan_id": "Cần biết item trong batch đang đồng bộ cho scan nào để update đúng record sau response server.",
  "api_request_logs.local_scan_id": "Cần liên kết log request với lượt scan cụ thể để debug lỗi submit/retry.",
  "local_duplicate_keys.duplicate_key": "Cần khóa duplicate đã chuẩn hóa để tra cứu nhanh thay vì so toàn bộ chuỗi scan thô.",
  "local_app_settings.machine_serial": "Cần serial phần cứng ổn định để máy local tự nhận diện với server ngay từ lúc chưa có machine_code.",
  "local_app_settings.machine_uid": "Cần UID ổn định của app/máy để kết hợp với serial thành danh tính local.",
  "local_app_settings.machine_license_key": "Cần lưu raw license hiện tại để sau này thay bằng công thức mã hóa mà không đổi schema.",
  "machine_cache.serial": "Cần lưu serial server đã duyệt để đối chiếu với serial thật của máy khi startup.",
  "machine_cache.uid": "Cần lưu UID server đã duyệt để tránh máy khác dùng nhầm cache định danh."
};

const fieldUsageOverrides = {
  "local_scan_records.local_scan_id": "Sinh một lần trước khi lưu scan; mọi lần submit, sync offline và reconcile phải dùng lại đúng giá trị này.",
  "local_scan_led_items.local_scan_id": "Ghi cùng lúc tạo LED item; dùng khi build led_scans_json hoặc lọc toàn bộ LED của một scan.",
  "sync_batch_items.local_scan_id": "Ghi khi tạo batch item; dùng để cập nhật sync_status/final_status cho scan sau khi batch kết thúc.",
  "api_request_logs.local_scan_id": "Ghi khi request liên quan tới scan; để trống nếu request là health/config/heartbeat.",
  "local_duplicate_keys.duplicate_key": "Tạo từ rule duplicate hiện hành; lookup trước khi accept scan và insert sau khi scan hợp lệ.",
  "local_app_settings.machine_serial": "Lấy từ mainboard/hardware khi app khởi động; gửi trong register, get config, sync và websocket.",
  "local_app_settings.machine_uid": "Sinh/lấy từ định danh app local; gửi kèm serial trong các API định danh máy.",
  "local_app_settings.machine_license_key": "Hiện lưu raw key; sau này thay logic decode/verify nhưng app vẫn đọc/ghi cùng field.",
  "machine_cache.serial": "Upsert từ response server; khi startup so với serial phần cứng để phát hiện sai máy.",
  "machine_cache.uid": "Upsert từ response server; dùng cùng serial để lấy config và xác nhận đúng máy."
};

function humanizeField(field) {
  return field.replace(/_/g, " ");
}

function describeFieldReason(tableName, column, description) {
  const key = `${tableName}.${column.name}`;
  if (fieldReasonOverrides[key]) return fieldReasonOverrides[key];
  if (column.name === "id") return "Cần khóa chính nội bộ để app local tham chiếu, update và liên kết dữ liệu trong DB local.";
  if (column.name === "created_at") return "Cần mốc tạo để truy vết bản ghi được sinh ra khi nào và sắp xếp lịch sử.";
  if (column.name === "updated_at") return "Cần mốc cập nhật để biết bản ghi đã thay đổi lần cuối khi nào.";
  if (column.name === "synced_at") return "Cần mốc sync để biết dữ liệu cache này lấy từ server ở thời điểm nào.";
  if (column.name === "raw_json") return "Cần giữ payload gốc để đối chiếu khi mapping field bị sai hoặc server đổi format.";
  if (column.name === "payload_json") return "Cần giữ payload chi tiết của sự kiện/lệnh/thông báo mà các cột riêng không thể chứa hết.";
  if (column.name === "request_json") return "Cần lưu request đã gửi để tái hiện lỗi API và kiểm tra local đã gửi dữ liệu gì.";
  if (column.name === "response_json") return "Cần lưu response gốc để debug kết quả server trả về.";
  if (column.name === "error_message") return "Cần lưu lỗi dạng người đọc hiểu được để operator/dev biết nguyên nhân thất bại.";
  if (column.name === "status") return "Cần trạng thái tổng quát để lọc bản ghi active/inactive hoặc đang xử lý.";
  if (column.name === "is_active") return "Cần cờ bật/tắt để giữ lịch sử nhưng không cho app sử dụng bản ghi đã ngừng hiệu lực.";
  if (column.name === "is_required") return "Cần biết slot/code nào bắt buộc để validate thiếu dữ liệu đúng cách.";
  if (column.name === "profile_id") return "Cần liên kết dữ liệu với profile/mã hàng đang chạy để validate và thống kê chính xác.";
  if (column.name.endsWith("_at")) return `Cần mốc thời gian cho ${humanizeField(column.name)} để truy vết, sắp xếp hoặc tính retry/timeout.`;
  if (column.name.endsWith("_json")) return `Cần lưu JSON cho ${humanizeField(column.name)} vì dữ liệu có cấu trúc nhiều lớp hoặc cần debug nguyên bản.`;
  if (column.name.endsWith("_id")) return `Cần ID tham chiếu ${humanizeField(column.name)} để nối dữ liệu giữa các bảng hoặc với server.`;
  if (column.name.endsWith("_code")) return `Cần mã nghiệp vụ ${humanizeField(column.name)} để đối chiếu với rule/server và hiển thị cho người vận hành.`;
  if (column.name.endsWith("_status")) return `Cần trạng thái ${humanizeField(column.name)} để app biết bước xử lý hiện tại và quyết định retry/hiển thị.`;
  if (column.name.endsWith("_message")) return `Cần thông điệp ${humanizeField(column.name)} để giải thích kết quả cho UI hoặc log.`;
  if (column.name.endsWith("_reason")) return `Cần lý do ${humanizeField(column.name)} để biết vì sao một bản ghi bị NG, fail hoặc bị bỏ qua.`;
  if (column.name.startsWith("total_")) return `Cần số tổng ${humanizeField(column.name)} để tổng kết batch/phiên và đối chiếu số lượng.`;
  if (column.name.startsWith("last_")) return `Cần giá trị gần nhất của ${humanizeField(column.name)} để hiển thị trạng thái hiện tại và debug lỗi mới nhất.`;
  return `Cần lưu ${humanizeField(column.name)} vì ${description} Field này hỗ trợ ${tableUsageHints[tableName] ?? "nghiệp vụ local tương ứng"}.`;
}

function describeFieldUsage(tableName, column) {
  const key = `${tableName}.${column.name}`;
  if (fieldUsageOverrides[key]) return fieldUsageOverrides[key];
  const baseAction = tableActionHints[tableName] ?? "App local ghi/đọc field này trong flow nghiệp vụ tương ứng.";
  const requiredText = column.required ? "Bắt buộc có khi tạo bản ghi." : "Có thể để trống khi dữ liệu chưa có hoặc không áp dụng.";
  const defaultText = column.defaultValue ? `Nếu không truyền, PostgreSQL dùng default \`${column.defaultValue}\`.` : "Không có default nên app phải tự set khi nghiệp vụ cần.";
  if (column.name === "id") return `${baseAction} DB tự cấp/giữ khóa này; app dùng để join/update nội bộ, không dùng thay cho ID nghiệp vụ gửi server.`;
  if (column.name === "created_at" || column.name === "updated_at" || column.name === "synced_at") return `${baseAction} ${defaultText} UI/log dùng để sắp xếp và kiểm tra độ mới dữ liệu.`;
  if (column.name.endsWith("_json")) return `${baseAction} Ghi JSON đầy đủ khi có request/response/payload; đọc lại khi cần retry, debug hoặc dựng lại payload.`;
  if (column.name.endsWith("_status") || column.name === "status") return `${baseAction} Update mỗi khi trạng thái thay đổi; UI và worker lọc theo field này để xử lý tiếp.`;
  if (column.name.endsWith("_at")) return `${baseAction} Ghi đúng thời điểm sự kiện xảy ra; dùng để sort, retry, timeout hoặc báo cáo.`;
  if (column.name.startsWith("total_")) return `${baseAction} Cập nhật sau khi xử lý xong nhóm dữ liệu; dùng cho dashboard/tổng kết.`;
  if (column.name.startsWith("last_")) return `${baseAction} Ghi đè bằng giá trị mới nhất; dùng để hiển thị tình trạng hiện tại.`;
  if (column.name.endsWith("_reason")) return `${baseAction} Ghi khi có NG/FAILED/SKIPPED; UI/log đọc để giải thích nguyên nhân.`;
  return `${baseAction} ${requiredText} ${defaultText}`;
}

function buildFieldGuide(tableName, column) {
  const description = describeField(tableName, column.name);
  return {
    description,
    reason: describeFieldReason(tableName, column, description),
    usage: describeFieldUsage(tableName, column)
  };
}

function normalizeSql(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function splitTopLevel(body) {
  const result = [];
  let current = "";
  let depth = 0;
  let quote = null;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    const next = body[index + 1];
    if (quote) {
      current += char;
      if (char === quote) {
        if (next === quote) {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parseColumn(part) {
  const normalized = normalizeSql(part);
  const tokens = normalized.split(/\s+/);
  const name = tokens.shift().replace(/^"|"$/g, "");
  const typeParts = [];
  const stopWords = new Set(["PRIMARY", "NOT", "NULL", "DEFAULT", "CHECK", "REFERENCES", "UNIQUE", "CONSTRAINT"]);
  while (tokens.length > 0 && !stopWords.has(tokens[0].toUpperCase())) {
    typeParts.push(tokens.shift());
  }
  const rest = tokens.join(" ");
  const defaultMatch = rest.match(/\bDEFAULT\b\s+(.+?)(?=\s+(?:CHECK|REFERENCES|CONSTRAINT|NOT\s+NULL|PRIMARY\s+KEY|UNIQUE)\b|$)/i);
  const referencesMatch = rest.match(/\bREFERENCES\s+([^\s]+(?:\([^)]*\))?)/i);
  const rules = [];
  if (/PRIMARY\s+KEY/i.test(rest)) rules.push("PK");
  if (/NOT\s+NULL/i.test(rest)) rules.push("NOT NULL");
  if (/\bUNIQUE\b/i.test(rest)) rules.push("UNIQUE");
  if (referencesMatch) rules.push(`FK -> ${referencesMatch[1]}`);
  if (/\bCHECK\s*\(/i.test(rest)) rules.push("CHECK");
  if (defaultMatch) rules.push(`DEFAULT ${defaultMatch[1]}`);
  return {
    name,
    type: typeParts.join(" ") || "-",
    required: /PRIMARY\s+KEY|NOT\s+NULL/i.test(rest),
    defaultValue: defaultMatch ? defaultMatch[1] : "",
    rules
  };
}

function describeField(tableName, field) {
  const tableFieldKey = `${tableName}.${field}`;
  if (tableFieldDescriptions[tableFieldKey]) return tableFieldDescriptions[tableFieldKey];
  if (exactDescriptions[field]) return exactDescriptions[field];
  if (commonDescriptions[field]) return commonDescriptions[field];
  if (field.endsWith("_at")) return "Mốc thời gian liên quan tới nghiệp vụ của field này.";
  if (field.endsWith("_json")) return "Dữ liệu JSON phụ trợ để lưu cấu trúc đầy đủ hoặc debug.";
  if (field.endsWith("_id")) return "ID tham chiếu tới bản ghi liên quan.";
  if (field.endsWith("_code")) return "Mã nghiệp vụ liên quan.";
  if (field.endsWith("_status")) return "Trạng thái nghiệp vụ của bản ghi.";
  if (field.endsWith("_reason")) return "Lý do nghiệp vụ liên quan tới trạng thái NG, fail hoặc bị bỏ qua.";
  if (field.startsWith("total_")) return "Số lượng tổng hợp theo nghiệp vụ tương ứng.";
  if (field.startsWith("last_")) return "Giá trị hoặc thời điểm gần nhất liên quan tới nghiệp vụ này.";
  return `Cột ${field} lưu giá trị ${humanizeField(field)} trong nghiệp vụ local của bảng ${tableName}.`;
}

const tables = [];
for (const matchItem of sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/g)) {
  const tableName = matchItem[1];
  const parts = splitTopLevel(matchItem[2]);
  const columns = [];
  const constraints = [];
  for (const part of parts) {
    const first = part.trim().split(/\s+/)[0]?.replace(/"/g, "");
    if (!first) continue;
    if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE)$/i.test(first)) {
      constraints.push(normalizeSql(part));
    } else {
      columns.push(parseColumn(part));
    }
  }
  tables.push({
    name: tableName,
    purpose: tablePurposes[tableName] ?? "",
    columns,
    constraints,
    indexes: []
  });
}

for (const matchItem of sql.matchAll(/CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)\s+ON\s+(\w+)[\s\S]*?;/g)) {
  const table = tables.find((item) => item.name === matchItem[3]);
  if (table) table.indexes.push(normalizeSql(matchItem[0].replace(/;$/, "")));
}

const enums = [];
for (const matchItem of sql.matchAll(/CREATE TYPE local_qr\.(\w+) AS ENUM\s*\(([\s\S]*?)\);/g)) {
  const values = Array.from(matchItem[2].matchAll(/'([^']+)'/g)).map((item) => item[1]);
  enums.push({
    name: matchItem[1],
    values,
    description: enumDescriptions[matchItem[1]] ?? ""
  });
}

const views = Array.from(sql.matchAll(/CREATE OR REPLACE VIEW\s+(\w+)\s+AS[\s\S]*?;/g)).map((item) => item[1]);
const totalFields = tables.reduce((sum, table) => sum + table.columns.length, 0);
const tableByName = new Map(tables.map((table) => [table.name, table]));

function mdTable(rows, headers) {
  const mdCell = (cell) => String(cell).replace(/\|/g, " / ").replace(/\n/g, "<br>");
  return [
    `| ${headers.map(mdCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(mdCell).join(" | ")} |`)
  ].join("\n");
}

function buildFieldDocumentationSection() {
  let section = "";
  section += "## 4.1. Giải thích toàn bộ bảng và field local\n\n";
  section += "Mục này giải thích riêng database của máy local Python. Tất cả bảng và field bên dưới được lấy trực tiếp từ block SQL ở mục 4, vì vậy đội local chỉ cần đọc phần này để hiểu field nào tồn tại, vì sao cần field đó và app nên dùng field đó ở bước nào.\n\n";
  section += `Tổng quan field hiện tại: ${tables.length} bảng, ${totalFields} field, ${enums.length} enum và ${views.length} view.\n\n`;
  section += mdTable(
    groups.flatMap(([groupName, tableNames]) =>
      tableNames.map((tableName) => {
        const table = tableByName.get(tableName);
        return [groupName, `\`${tableName}\``, table?.columns.length ?? 0, tablePurposes[tableName] ?? ""];
      })
    ),
    ["Nhóm", "Bảng", "Số field", "Vai trò"]
  );
  section += "\n\n";

  for (const [groupName, tableNames] of groups) {
    section += `### ${groupName}\n\n`;
    for (const tableName of tableNames) {
      const table = tableByName.get(tableName);
      if (!table) continue;
      section += `#### \`${table.name}\`\n\n`;
      section += `${table.purpose}\n\n`;
      if (table.constraints.length > 0 || table.indexes.length > 0) {
        section += "**Ràng buộc/chỉ mục chính:**\n\n";
        for (const item of table.constraints) section += `- \`${item}\`\n`;
        for (const item of table.indexes) section += `- \`${item}\`\n`;
        section += "\n";
      }
      section += mdTable(
        table.columns.map((column) => {
          const guide = buildFieldGuide(table.name, column);
          return [
            `\`${column.name}\``,
            `\`${column.type}\``,
            column.required ? "Có" : "Không",
            column.defaultValue ? `\`${column.defaultValue}\`` : "-",
            column.rules.length > 0 ? column.rules.map((rule) => `\`${rule}\``).join("<br>") : "-",
            guide.description,
            guide.reason,
            guide.usage
          ];
        }),
        ["Field", "Kiểu", "Bắt buộc", "Default", "Ràng buộc", "Ý nghĩa", "Vì sao có", "Cách dùng trong app local"]
      );
      section += "\n\n";
    }
  }

  return section.trimEnd();
}

function updateSqlDocumentFieldGuide(section) {
  const startMarker = "<!-- LOCAL_DB_FIELD_GUIDE_START -->";
  const endMarker = "<!-- LOCAL_DB_FIELD_GUIDE_END -->";
  const markedSection = `${startMarker}\n${section}\n${endMarker}`;
  let nextSource = source;
  const markerPattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);

  if (markerPattern.test(nextSource)) {
    nextSource = nextSource.replace(markerPattern, markedSection);
  } else {
    const insertBefore = "\n## 5. Query kiểm tra sau khi chạy";
    if (!nextSource.includes(insertBefore)) {
      throw new Error(`Cannot find insert point in ${sqlDocPath}`);
    }
    nextSource = nextSource.replace(insertBefore, `\n${markedSection}\n${insertBefore}`);
  }

  fs.writeFileSync(sqlDocPath, nextSource, "utf8");
}

let markdown = "";
markdown += "# DB Design Local - Samsung QR Recorder\n\n";
markdown += `Ngày tạo: ${generatedAt}\n\n`;
markdown += `Tài liệu này là bản thiết kế database dành riêng cho máy local Python dùng PostgreSQL. Nội dung được tách từ thiết kế tổng thể \`db-design.pdf\` và đối chiếu với SQL khởi tạo local tại \`${sqlDocPath}\`.\n\n`;
markdown += "## 1. Phạm vi local only\n\n";
markdown += "- Database name khuyến nghị: `samsung_qr_local`.\n";
markdown += "- Schema khuyến nghị: `local_qr`.\n";
markdown += "- Engine: PostgreSQL 13 trở lên.\n";
markdown += "- DB local chỉ lưu cấu hình, cache profile, scan local, sync offline, command, notification và log của chính máy local.\n";
markdown += "- DB local không lưu user server, audit server, runtime session server, notification server UI hoặc master data chính thức.\n\n";
markdown += `Tổng quan hiện tại: ${tables.length} bảng, ${totalFields} field, ${enums.length} enum và ${views.length} view.\n\n`;

markdown += "## 2. Nhóm bảng\n\n";
markdown += mdTable(groups.flatMap(([groupName, tableNames]) => tableNames.map((table) => [groupName, `\`${table}\``, tablePurposes[table] ?? ""])), ["Nhóm", "Bảng", "Vai trò"]);
markdown += "\n\n";

markdown += "## 3. Enum local\n\n";
markdown += mdTable(enums.map((item) => [`\`${item.name}\``, item.values.map((value) => `\`${value}\``).join(", "), item.description]), ["Enum", "Giá trị", "Ý nghĩa"]);
markdown += "\n\n";

markdown += "## 4. Chi tiết bảng và field\n\n";
for (const [groupName, tableNames] of groups) {
  markdown += `### ${groupName}\n\n`;
  for (const tableName of tableNames) {
    const table = tableByName.get(tableName);
    if (!table) continue;
    markdown += `#### \`${table.name}\`\n\n`;
    markdown += `${table.purpose}\n\n`;
    if (table.constraints.length > 0 || table.indexes.length > 0) {
      markdown += "**Ràng buộc/chỉ mục chính:**\n\n";
      for (const item of table.constraints) markdown += `- \`${item}\`\n`;
      for (const item of table.indexes) markdown += `- \`${item}\`\n`;
      markdown += "\n";
    }
    markdown += mdTable(
      table.columns.map((column) => [
        `\`${column.name}\``,
        `\`${column.type}\``,
        column.required ? "Có" : "Không",
        column.defaultValue ? `\`${column.defaultValue}\`` : "-",
        column.rules.length > 0 ? column.rules.map((rule) => `\`${rule}\``).join("<br>") : "-",
        buildFieldGuide(table.name, column).description,
        buildFieldGuide(table.name, column).reason,
        buildFieldGuide(table.name, column).usage
      ]),
      ["Field", "Kiểu", "Bắt buộc", "Default", "Ràng buộc", "Ý nghĩa", "Vì sao có", "Cách dùng trong app local"]
    );
    markdown += "\n\n";
  }
}

markdown += "## 5. View hỗ trợ local runtime\n\n";
markdown += mdTable(views.map((name) => [`\`${name}\``, viewDescriptions[name] ?? "View hỗ trợ truy vấn nhanh trong app local."]), ["View", "Ý nghĩa"]);
markdown += "\n\n";

markdown += "## 6. Mapping flow với bảng local\n\n";
markdown += mdTable(
  [
    ["Startup/identity", "`local_app_settings`, `machine_cache`, `api_request_logs`, `local_notifications`", "Lưu serial, uid, request_id, trạng thái định danh và lỗi nếu bị reject/trùng."],
    ["Load config", "`server_settings_cache`, `machine_cache`, `vendor_cache`, `profile_cache`, `profile_led_code_cache`", "Upsert config server trả về, cache vendor/profile, chọn active_profile_id và ghi last_config_sync_at."],
    ["Scan online", "`local_scan_records`, `local_scan_led_items`, `api_request_logs`, `local_notifications`", "Lưu local trước, gửi server sau, update final_status theo response."],
    ["Mất mạng/pending sync", "`local_scan_records`, `sync_batches`, `sync_batch_items`", "Giữ nguyên local_scan_id, tăng sync_attempt_count và retry theo next_retry_at."],
    ["Reconcile check/pull", "`api_request_logs`, `local_scan_records`, `local_scan_led_items`, `local_notifications`", "Check không ghi đè; pull mới upsert lại record theo server khi người dùng chọn sync theo server."],
    ["Command polling", "`command_inbox`, `api_request_logs`, `local_notifications`", "Lưu command, thực thi, ack/fail lại server."],
    ["UI local", "`local_app_settings`, `local_notifications`, `v_today_scan_summary`, `v_pending_sync_scans`", "Hiển thị trạng thái máy, số OK/NG, pending sync và cảnh báo."]
  ],
  ["Flow", "Bảng liên quan", "Cách dùng"]
);
markdown += "\n\n";

markdown += "## 7. Ghi chú triển khai\n\n";
markdown += "- `local_scan_id` phải được tạo trước khi gọi server và không đổi khi retry.\n";
markdown += "- `local_scan_records` là bảng nghiệp vụ quan trọng nhất của máy local. Mọi scan nên được lưu ở đây trước khi gửi API.\n";
markdown += "- `api_request_logs` nên ghi cả request thành công và thất bại để debug LAN/API.\n";
markdown += "- `local_notifications` là notification nội bộ của app Python local, khác với `notification_events` trên database server.\n";
markdown += "- WebSocket runtime session được server lưu ở DB server; local không cần bảng session riêng trong DB local.\n";

updateSqlDocumentFieldGuide(buildFieldDocumentationSection());

if (process.argv.includes("--sql-doc-only")) {
  console.log(`updated ${sqlDocPath}`);
  console.log(`tables=${tables.length} fields=${totalFields} enums=${enums.length} views=${views.length}`);
  process.exit(0);
}

fs.writeFileSync("document/db-design-local.md", markdown, "utf8");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function inline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderTable(lines) {
  const rows = lines
    .filter((_, index) => index !== 1)
    .map((line) => line.replace(/^\|\s*/, "").replace(/\s*\|$/, "").split(/\s*\|\s*/));
  const [head, ...body] = rows;
  return [
    "<table><thead><tr>",
    head.map((cell) => `<th>${inline(cell)}</th>`).join(""),
    "</tr></thead><tbody>",
    ...body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell).replace(/&lt;br&gt;/g, "<br>")}</td>`).join("")}</tr>`),
    "</tbody></table>"
  ].join("");
}

function renderMarkdown(mdText) {
  const lines = mdText.split(/\r?\n/);
  let html = "";
  let listOpen = false;
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html += `<p>${inline(paragraph.join(" "))}</p>`;
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listOpen) {
      html += "</ul>";
      listOpen = false;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    if (line.startsWith("| ")) {
      flushParagraph();
      closeList();
      const tableLines = [];
      while (index < lines.length && lines[index].startsWith("| ")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      html += renderTable(tableLines);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${inline(heading[2])}</h${level}>`;
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      if (!listOpen) {
        html += "<ul>";
        listOpen = true;
      }
      html += `<li>${inline(line.slice(2))}</li>`;
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  closeList();
  return html;
}

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>DB Design Local - Samsung QR Recorder</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, "Segoe UI", sans-serif; color: #111827; line-height: 1.42; font-size: 11px; margin: 0; }
  h1 { font-size: 25px; margin: 0 0 8px; color: #0f172a; }
  h2 { font-size: 18px; margin: 22px 0 8px; color: #0f172a; border-bottom: 2px solid #111827; padding-bottom: 4px; break-after: avoid; }
  h3 { font-size: 15px; margin: 18px 0 6px; color: #1f2937; break-after: avoid; }
  h4 { font-size: 13px; margin: 16px 0 5px; color: #111827; break-after: avoid; }
  p { margin: 5px 0 8px; }
  ul { margin: 5px 0 10px 16px; padding: 0; }
  li { margin: 2px 0; }
  code { font-family: Consolas, "Courier New", monospace; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 3px; padding: 1px 3px; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: top; }
  th { background: #e5e7eb; text-align: left; font-weight: 700; }
  tr:nth-child(even) td { background: #f8fafc; }
  .cover { border: 2px solid #111827; padding: 18px; margin-bottom: 16px; }
  .muted { color: #475569; }
</style>
</head>
<body>
  <section class="cover">
    <h1>DB Design Local - Samsung QR Recorder</h1>
    <p class="muted">Thiết kế database PostgreSQL dành riêng cho máy local Python. Không bao gồm bảng server chính.</p>
    <p><strong>Nguồn đối chiếu:</strong> db-design.pdf, ${escapeHtml(sqlDocPath)}, ${escapeHtml(apiDocPath)}</p>
    <p><strong>Ngày tạo:</strong> ${generatedAt}</p>
  </section>
  ${renderMarkdown(markdown).replace("<h1>DB Design Local - Samsung QR Recorder</h1>", "")}
</body>
</html>`;

fs.writeFileSync("document/db-design-local.html", html, "utf8");
console.log(`generated document/db-design-local.md`);
console.log(`generated document/db-design-local.html`);
console.log(`tables=${tables.length} fields=${totalFields} enums=${enums.length} views=${views.length}`);
