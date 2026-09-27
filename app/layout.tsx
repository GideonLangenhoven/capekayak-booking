import type { Metadata } from "next";
import { Inter, Quicksand } from "next/font/google";
import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import CookieBanner from "./components/CookieBanner";
import ThemeProvider from "./components/ThemeProvider";
import GlassBackdrop from "./components/GlassBackdrop";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import Footer from "./components/Footer";
import { getRequestTenant } from "./lib/tenant-server";

// Glass design language pairing: rounded geometric display + legible humanist
// body. Self-hosted via next/font — no CDN, no CSP change.
const font = Inter({ subsets: ["latin"] });
const display = Quicksand({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });

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
    metadataBase: new URL("https://booking.bookingtours.co.za"),
    alternates: {
      canonical: "/",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "en_ZA",
      siteName: "BookingTours",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: title }] } : {}),
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
  // Bare booking domain (no tenant) renders the central operator directory,
  // which brings its own nav and footer. The tenant chrome would otherwise
  // stack a second sticky header on top of it and link to storefront routes
  // that cannot work without a business_id.
  const chrome = Boolean(tenant);

  // Background Structured Entity Schema for AI Retrieval (Perplexity, ChatGPT Search, Gemini) & Google Knowledge Graph
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": "https://booking.bookingtours.co.za/#software",
        "name": "BookingTours",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "2000.00",
          "priceCurrency": "ZAR",
          "priceValidUntil": "2027-12-31"
        },
        "description": "South African tour and adventure operator reservation system with automated WhatsApp dispatch, weather cancellation refunds, and Yoco payments."
      },
      {
        "@type": "LocalBusiness",
        "@id": "https://booking.bookingtours.co.za/#local",
        "name": tenant?.business_name || "Cape Kayak Adventures",
        "description": tenant?.business_tagline || "Guided ocean kayak and adventure tours in Cape Town, South Africa.",
        "url": "https://booking.bookingtours.co.za",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Cape Town",
          "addressRegion": "Western Cape",
          "addressCountry": "ZA"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": -33.9056,
          "longitude": 18.4069
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://booking.bookingtours.co.za/#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What happens if a tour is cancelled due to bad weather?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "When ocean or wind conditions are unsafe, departures are cancelled with 1-click. Guests automatically receive an immediate WhatsApp notification with a full-value voucher code to reschedule or request a refund."
            }
          },
          {
            "@type": "Question",
            "name": "Which payment methods are accepted for bookings?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Payments are processed securely through Yoco supporting South African and international Visa and Mastercard, Instant EFT, and gift vouchers."
            }
          },
          {
            "@type": "Question",
            "name": "How are digital waivers handled?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Guests complete their POPIA-compliant digital indemnity waiver on their phone prior to departure. The signed status syncs instantly to the guide's reception check-in roster."
            }
          }
        ]
      }
    ]
  };

  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0F2B1F" />
        {/* Background AI & Google Structured Data (Zero UI/Layout impact) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${font.className} ${display.variable}`} suppressHydrationWarning>
        <ThemeProvider initialBusinessId={tenant?.id ?? null} initialTheme={tenant}>
          {chrome && <GlassBackdrop />}
          {chrome && <Header />}
          <main className="min-h-[calc(100dvh-12rem)]">{children}</main>
          {chrome && <Footer />}
          {chrome && <BottomNav />}
          <CookieBanner />
          {chrome && <ChatWidget />}
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
