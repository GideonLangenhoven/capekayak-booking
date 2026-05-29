import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") || "booking.bookingtours.co.za";
  const baseUrl = `https://${host}`;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/embed",
          "/auth/",
          "/success",
          "/cancelled",
          "/voucher-success",
          "/voucher-confirmed",
          "/my-bookings",
          "/waiver",
          "/review",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
