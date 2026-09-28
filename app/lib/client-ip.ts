export function validIp(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 45 || value !== value.trim() || value.includes(",")) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split(".").every(part => Number(part) <= 255 && (part === "0" || !part.startsWith("0")));
  }
  if (!value.includes(":") || !/^[0-9a-fA-F:.]+$/.test(value)) return false;
  try { new URL(`http://[${value}]/`); return true; } catch { return false; }
}
