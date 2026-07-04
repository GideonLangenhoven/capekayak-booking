import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import CookieBanner from "./components/CookieBanner";
import ThemeProvider from "./components/ThemeProvider";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { getRequestTenant } from "./lib/tenant-server";

const font = Inter({ subsets: ["latin"] });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display" });

const DEFAULT_TITLE = "Book Your Tour";
const DEFAULT_DESCRIPTION = "Book your next adventure tour online.";

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let ogImage: string | null = null;

  // Shared-deployment model: the tenant is resolved server-side from the request
  // Host (subdomain / custom domain), so a single deployment serves every tenant
  // and crawlers/social scrapers get each tenant's real title + share image
  // without the client-side ThemeProvider. Reading the host makes these routes
  // dynamic — which is exactly what per-host multi-tenancy requires. Falls back
  // to NEXT_PUBLIC_BUSINESS_ID for any legacy per-tenant deployment.
  try {
    const tenant = await getRequestTenant();
    if (tenant?.business_name) {
      title = `${tenant.business_name} | Book Your Tour`;
      if (tenant.business_tagline) description = tenant.business_tagline;
      if (tenant.logo_url) ogImage = tenant.logo_url;
    }
  } catch {
    // Metadata must never block render — fall back to generic defaults.
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve the tenant server-side (cached: shares generateMetadata's query) and
  // hand its id to the client so ThemeProvider theming works from a shared
  // deployment without a baked NEXT_PUBLIC_BUSINESS_ID.
  const tenant = await getRequestTenant();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0F2B1F" />
      </head>
      <body className={`${font.className} ${fraunces.variable}`} suppressHydrationWarning>
        <ThemeProvider initialBusinessId={tenant?.id ?? null}>
          <Header />
          <main className="min-h-[calc(100dvh-12rem)]">{children}</main>
          <Footer />
          <CookieBanner />
          <ChatWidget />
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
             __html: `if("serviceWorker"in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js")})}`,
          }}
        />
      </body>
    </html>
  );
}
