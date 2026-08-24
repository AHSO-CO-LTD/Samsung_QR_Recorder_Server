import type { ReportColumnKey, ReportStatus } from "@/features/reports/reports-view";

export type ReportTemplateId = "operational" | "error-detail" | "technical";

export type ReportExportTemplate = {
  id: ReportTemplateId;
  columns: readonly ReportColumnKey[];
  statuses: readonly ReportStatus[];
};

export const reportExportTemplates: readonly ReportExportTemplate[] = [
  {
    id: "operational",
    columns: ["scan_at", "machine_code", "machine_name", "line_name", "profile", "local_scan_id", "final_status", "ng_reason", "full_code_raw"],
    statuses: ["OK", "NG", "REWORK"]
  },
  {
    id: "error-detail",
    columns: [
      "scan_at",
      "machine_code",
      "machine_name",
      "line_name",
      "profile",
      "local_scan_id",
      "local_status",
      "server_status",
      "final_status",
      "ng_stage",
      "ng_reason",
      "full_code_raw",
      "chassis_scan_raw",
      "led_all_raw",
      "duplicate_key"
    ],
    statuses: ["NG", "REWORK"]
  },
  {
    id: "technical",
    columns: [],
    statuses: ["OK", "NG", "REWORK", "PENDING"]
  }
];
