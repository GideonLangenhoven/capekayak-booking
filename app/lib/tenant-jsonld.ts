export function tenantJsonLd(tenant: { business_name?: string | null; business_tagline?: string | null } | null): string | null {
  if (!tenant?.business_name) return null;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: tenant.business_name,
    ...(tenant.business_tagline ? { description: tenant.business_tagline } : {}),
  }).replace(/</g, "\\u003c");
}
