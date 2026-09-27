import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") || "booking.bookingtours.co.za";
  const baseUrl = `https://${host}`;
  return {
    rules: [
      {
        userAgent: [
          "Googlebot",
          "Bingbot",
          "Applebot",
          "Slurp",
          "DuckDuckBot",
          "YandexBot",
        ],
        allow: ["/", "/book", "/voucher", "/directory", "/terms", "/privacy", "/cookies"],
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
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "ClaudeBot",
          "PerplexityBot",
          "Google-Extended",
          "Applebot-Extended",
          "CCBot",
        ],
        allow: ["/", "/book", "/voucher", "/directory", "/terms", "/privacy", "/cookies"],
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
