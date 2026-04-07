import type { Metadata } from "next";
import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import CookieBanner from "./components/CookieBanner";
import ThemeProvider from "./components/ThemeProvider";
import Header from "./components/Header";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  title: "Book Your Tour",
  description: "Book your next adventure tour online.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body suppressHydrationWarning>
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
