-- Replace migrated legacy messages with concise localized names for built-in codes.
-- Only rows whose two new names still equal the old message are changed, so later
-- administrator-owned names are not overwritten.
UPDATE "error_codes"
SET
  "name_vi" = CASE "code"
    WHEN 'SERVER_DUPLICATE' THEN 'Trùng dữ liệu trên máy chủ'
    WHEN 'LED_SUFFIX_NOT_MATCH' THEN 'Hậu tố LED không khớp'
    WHEN 'MACHINE_NOT_FOUND' THEN 'Không tìm thấy máy'
    WHEN 'PROFILE_NOT_FOUND' THEN 'Không tìm thấy hồ sơ'
    WHEN 'LOCAL_DUPLICATE' THEN 'Trùng dữ liệu tại máy local'
    WHEN 'PAYLOAD_INVALID' THEN 'Dữ liệu gửi lên không hợp lệ'
    ELSE "name_vi"
  END,
  "name_en" = CASE "code"
    WHEN 'SERVER_DUPLICATE' THEN 'Server duplicate'
    WHEN 'LED_SUFFIX_NOT_MATCH' THEN 'LED suffix mismatch'
    WHEN 'MACHINE_NOT_FOUND' THEN 'Machine not found'
    WHEN 'PROFILE_NOT_FOUND' THEN 'Profile not found'
    WHEN 'LOCAL_DUPLICATE' THEN 'Local duplicate'
    WHEN 'PAYLOAD_INVALID' THEN 'Invalid payload'
    ELSE "name_en"
  END
WHERE "code" IN (
  'SERVER_DUPLICATE',
  'LED_SUFFIX_NOT_MATCH',
  'MACHINE_NOT_FOUND',
  'PROFILE_NOT_FOUND',
  'LOCAL_DUPLICATE',
  'PAYLOAD_INVALID'
)
AND "name_vi" = "default_message"
AND "name_en" = "default_message";
