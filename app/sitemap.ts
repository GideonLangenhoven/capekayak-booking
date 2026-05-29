import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host") || "booking.bookingtours.co.za";
  const baseUrl = `https://${host}`;
  const now = new Date();
  const routes = ["", "/book", "/voucher", "/terms", "/privacy", "/cookies"];
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.6,
  }));
}
