import assert from "node:assert/strict";
import test from "node:test";
import { tenantJsonLd } from "../app/lib/tenant-jsonld.ts";

test("tenant JSON-LD preserves visible facts without closing the script", () => {
  const injected = '</script><script>alert("xss")</script>';
  const serialized = tenantJsonLd({ business_name: injected, business_tagline: "Paddle Cape Town" });
  assert(!serialized.includes("<"));
  assert(!serialized.includes("</script"));
  assert.deepEqual(JSON.parse(serialized), {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: injected,
    description: "Paddle Cape Town",
  });
  assert.equal(tenantJsonLd(null), null);
  assert.equal(tenantJsonLd({ business_name: null }), null);
});
