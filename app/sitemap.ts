import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { WAYS, DESTINATIONS } from "./lib/directory-ways";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host") || "booking.bookingtours.co.za";
  const baseUrl = `https://${host}`;
  const now = new Date();
  const routes = [
    "",
    "/book",
    "/voucher",
    "/terms",
    "/privacy",
    "/cookies",
    "/directory",
    ...DESTINATIONS.map((d) => `/directory/destinations/${d.slug}`),
    ...WAYS.map((w) => `/directory/activities/${w.slug}`),
  ];
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.6,
  }));
}
