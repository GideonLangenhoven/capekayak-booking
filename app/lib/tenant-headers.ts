export function buildTenantHeaders(input: {
  businessId?: string | null;
  subdomain?: string | null;
  origin?: string | null;
}) {
  const headers: Record<string, string> = {};
  const businessId = input.businessId?.trim();
  const subdomain = input.subdomain?.trim().toLowerCase();
  const origin = input.origin?.trim().replace(/\/+$/, "");

  if (businessId) headers["x-tenant-business-id"] = businessId;
  if (subdomain) headers["x-tenant-subdomain"] = subdomain;
  if (origin) headers["x-tenant-origin"] = origin;

  return headers;
}

export function normalizeVoucherCode(code: string) {
  return code.toUpperCase().replace(/\s/g, "");
}

export function buildVoucherHeaders(code: string, businessId?: string | null) {
  return {
    ...buildTenantHeaders({ businessId }),
    "x-voucher-code": normalizeVoucherCode(code),
  };
}

export function tenantSubdomainFromHost(hostname: string) {
  const host = hostname.toLowerCase().split(":")[0];
  const suffix = ".booking.bookingtours.co.za";
  if (!host.endsWith(suffix)) return null;

  const subdomain = host.slice(0, -suffix.length);
  return subdomain && !subdomain.includes(".") ? subdomain : null;
}
