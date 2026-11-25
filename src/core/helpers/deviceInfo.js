/*
  TEOS-256: what the portal tells the API about this browser, so the API can
  recognise a trusted device. The API hashes these values with a server secret;
  the browser never builds the hash itself.

  device_key: a random id created once per browser and kept in localStorage. It
  makes the device unique (two identical laptops otherwise read the same values).
  It is not a token: alone it gives no access. Clearing the site data makes the
  browser "new" again (an email code is asked), which is expected.

  Hashed by the API: device_key, browser, os, cpu_cores, memory_gb,
  touch_points, gpu, language. Shown only: browser_version, os_version,
  timezone, screen, color_depth.
*/

export const DEVICE_KEY_STORAGE = "admin_device_key";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const randomUuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Same key for every tab and every sign-in of this browser.
export const getDeviceKey = () => {
  let key = null;
  try {
    key = window.localStorage.getItem(DEVICE_KEY_STORAGE);
  } catch {
    key = null;
  }
  if (key && UUID_RE.test(key)) return key.toLowerCase();
  key = randomUuid();
  try {
    window.localStorage.setItem(DEVICE_KEY_STORAGE, key);
  } catch {
    // storage blocked: this browser will be asked for a code every time
  }
  return key;
};

const BROWSERS = [
  // order matters: Edge and Opera also say "Chrome", Chrome also says "Safari"
  ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/],
  ["Opera", /(?:OPR|Opera)\/([\d.]+)/],
  ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
  ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
  ["Safari", /Version\/([\d.]+).*Safari/],
];

const OSES = [
  ["iOS", /(?:iPhone|iPad|iPod).*?OS ([\d_]+)/],
  ["Android", /Android ([\d.]+)/],
  ["Windows", /Windows NT ([\d.]+)/],
  ["macOS", /Mac OS X ([\d_.]+)/],
  ["ChromeOS", /CrOS [^ ]+ ([\d.]+)/],
  ["Linux", /Linux()/],
];

export const parseUserAgent = (ua = "") => {
  let browser = "";
  let browserVersion = "";
  for (const [name, re] of BROWSERS) {
    const match = ua.match(re);
    if (match) {
      browser = name;
      browserVersion = (match[1] || "").split(".").slice(0, 2).join(".");
      break;
    }
  }
  let os = "";
  let osVersion = "";
  for (const [name, re] of OSES) {
    const match = ua.match(re);
    if (match) {
      os = name;
      osVersion = (match[1] || "").replace(/_/g, ".");
      break;
    }
  }
  return { browser, browserVersion, os, osVersion };
};

const readGpu = () => {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const value = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
    return typeof value === "string" ? value.slice(0, 300) : "";
  } catch {
    return "";
  }
};

const readTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
};

const numberOrNull = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

let cachedGpu;

// The `device` object of POST auth/login, auth/verify-device and auth/refresh.
export const collectDevice = () => {
  const nav = window.navigator || {};
  const { browser, browserVersion, os, osVersion } = parseUserAgent(nav.userAgent || "");
  if (cachedGpu === undefined) cachedGpu = readGpu();
  const screen = window.screen || {};
  return {
    device_key: getDeviceKey(),
    browser,
    browser_version: browserVersion,
    os,
    os_version: osVersion,
    cpu_cores: numberOrNull(nav.hardwareConcurrency),
    memory_gb: numberOrNull(nav.deviceMemory),
    touch_points: numberOrNull(nav.maxTouchPoints),
    gpu: cachedGpu || "",
    language: nav.language || "",
    timezone: readTimezone(),
    screen: screen.width && screen.height ? `${screen.width}x${screen.height}` : "",
    color_depth: numberOrNull(screen.colorDepth),
  };
};

// "Chrome on Windows", for rows with no name of their own
export const deviceLabel = (row) =>
  `${row?.browser || "Unknown browser"} on ${row?.os || "unknown OS"}`;
