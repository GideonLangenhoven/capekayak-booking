import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import CookieBanner from "./components/CookieBanner";
import ThemeProvider from "./components/ThemeProvider";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { createBusinessResolverSupabase } from "./lib/supabase";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const DEFAULT_TITLE = "Book Your Tour";
const DEFAULT_DESCRIPTION = "Book your next adventure tour online.";

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let ogImage: string | null = null;

  // Per-deployment model: a business is locked in via NEXT_PUBLIC_BUSINESS_ID.
  // We resolve it server-side here so crawlers and social scrapers (which don't
  // run the client-side ThemeProvider) get the tenant's real title + share image.
  // Deliberately NOT reading the request host — that would opt every route into
  // dynamic rendering. Shared-subdomain previews still rely on client title.
  const businessId = process.env.NEXT_PUBLIC_BUSINESS_ID || "";
  if (businessId) {
    try {
      const scoped = createBusinessResolverSupabase({ businessId });
      const { data } = await scoped
        .from("businesses")
        .select("business_name,business_tagline,logo_url")
        .eq("id", businessId)
        .maybeSingle();
      if (data?.business_name) {
        title = `${data.business_name} | Book Your Tour`;
        if (data.business_tagline) description = data.business_tagline;
        if (data.logo_url) ogImage = data.logo_url;
      }
    } catch {
      // Metadata must never block render — fall back to generic defaults.
    }
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={font.className} suppressHydrationWarning>
        <ThemeProvider>
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
