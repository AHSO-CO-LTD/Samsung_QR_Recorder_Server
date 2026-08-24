export type MachineErrorRankingItem = {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  line_name: string | null;
  ng_count: number;
  percentage: number;
};

export type ProfileErrorRankingItem = {
  profile_id: number;
  profile_name: string;
  factory_code: string;
  ng_count: number;
  percentage: number;
};

export type ErrorTypeRankingItem = {
  code: string;
  name_vi: string | null;
  name_en: string | null;
  ng_count: number;
  percentage: number;
};

export type ScanAnalyticsResult = {
  ok_count: number;
  ng_count: number;
  rework_count: number;
  total_count: number;
  ranking_status?: "NG" | "REWORK";
  ranking_type?: "machine" | "profile" | "error_type";
  machines: MachineErrorRankingItem[];
  profiles?: ProfileErrorRankingItem[];
  errors?: ErrorTypeRankingItem[];
};
