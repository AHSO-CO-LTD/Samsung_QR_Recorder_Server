import { app } from "electron";
import { createRequire } from "node:module";
import path from "node:path";

const SERVER_LICENSE_PRODUCT = "samsung-qr-recorder-server";
const DEFAULT_RELEASE_DATE = "2026-07-15";

type LicensePayload = {
  lic_id?: string;
  customer_id?: string;
  project?: string;
  product?: string;
  purchased_version?: string;
  max_major?: number;
  update_until?: string | null;
  machine_id?: string;
  type?: string;
  expires_at?: string | null;
  features?: string[];
  issued_at?: string;
  edition?: string;
  v?: number;
  [key: string]: unknown;
};

type LicenseSdkStatus = {
  state: "active" | "unactivated" | "invalid";
  machineId: string;
  lic: LicensePayload | null;
  why: string | null;
};

type LicenseSdk = {
  APP: {
    version: string;
    releaseDate: string;
    product: string;
  };
  getMachineId: () => Promise<string>;
  evaluate: () => Promise<LicenseSdkStatus>;
  activate: (licenseString: string) => Promise<{ ok: boolean; lic?: LicensePayload | null; why?: string | null }>;
  clearLicense: () => void;
  hasFeature: (featureName: string) => Promise<boolean>;
};

export type ServerLicenseState = "active" | "unactivated" | "invalid";

export type ServerLicenseStatus = {
  state: ServerLicenseState;
  ok: boolean;
  machineId: string;
  product: string;
  version: string;
  releaseDate: string;
  licensePath: string;
  lic: LicensePayload | null;
  why: string | null;
};

export type ServerLicenseRequestInfo = {
  license_request_format: "SAMSUNG_QR_SERVER_LICENSE_REQUEST_V1";
  product: string;
  machine_id: string;
  app_version: string;
  release_date: string;
  app_name: string;
  generated_at: string;
};

const runtimeRequire = createRequire(__filename);
let cachedSdk: LicenseSdk | null = null;

function getLicenseProduct() {
  return process.env.LICENSE_PRODUCT?.trim() || SERVER_LICENSE_PRODUCT;
}

function getAppVersion() {
  return process.env.LICENSE_APP_VERSION?.trim() || getPackageVersion() || app.getVersion() || "0.1.0";
}

function getReleaseDate() {
  return process.env.LICENSE_RELEASE_DATE?.trim() || process.env.BUILD_RELEASE_DATE?.trim() || DEFAULT_RELEASE_DATE;
}

function getSdkRoot() {
  return path.join(__dirname, "..", "license-key", "electron");
}

function getPackageVersion() {
  try {
    const packageJson = runtimeRequire(path.join(__dirname, "..", "package.json")) as { version?: string };
    return packageJson.version?.trim() || null;
  } catch {
    return null;
  }
}

function getSdk() {
  if (!cachedSdk) {
    cachedSdk = runtimeRequire(path.join(getSdkRoot(), "licenseManager.js")) as LicenseSdk;
  }

  cachedSdk.APP.version = getAppVersion();
  cachedSdk.APP.releaseDate = getReleaseDate();
  cachedSdk.APP.product = getLicenseProduct();
  return cachedSdk;
}

export function getServerLicensePath() {
  return path.join(app.getPath("userData"), "license.dat");
}

export async function evaluateServerLicense(): Promise<ServerLicenseStatus> {
  const sdk = getSdk();
  const result = await sdk.evaluate();

  return {
    state: result.state,
    ok: result.state === "active",
    machineId: result.machineId,
    product: getLicenseProduct(),
    version: getAppVersion(),
    releaseDate: getReleaseDate(),
    licensePath: getServerLicensePath(),
    lic: result.lic,
    why: result.why
  };
}

export async function activateServerLicense(licenseString: string): Promise<ServerLicenseStatus> {
  const sdk = getSdk();
  const result = await sdk.activate(licenseString);

  if (!result.ok) {
    return {
      state: "invalid",
      ok: false,
      machineId: await sdk.getMachineId(),
      product: getLicenseProduct(),
      version: getAppVersion(),
      releaseDate: getReleaseDate(),
      licensePath: getServerLicensePath(),
      lic: result.lic ?? null,
      why: result.why ?? "license_invalid"
    };
  }

  return evaluateServerLicense();
}

export async function getServerLicenseRequestInfo(): Promise<ServerLicenseRequestInfo> {
  return {
    license_request_format: "SAMSUNG_QR_SERVER_LICENSE_REQUEST_V1",
    product: getLicenseProduct(),
    machine_id: await getSdk().getMachineId(),
    app_version: getAppVersion(),
    release_date: getReleaseDate(),
    app_name: app.getName(),
    generated_at: new Date().toISOString()
  };
}

export async function clearServerLicense() {
  getSdk().clearLicense();
  return evaluateServerLicense();
}

export async function hasServerLicenseFeature(featureName: string) {
  return getSdk().hasFeature(featureName);
}
