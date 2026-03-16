"use client";
import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "../lib/supabase";

type ThemeData = {
  color_main: string | null;
  color_secondary: string | null;
  color_cta: string | null;
  color_bg: string | null;
  color_nav: string | null;
  color_hover: string | null;
  chatbot_avatar: string | null;
  hero_eyebrow: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  business_name: string | null;
  business_tagline: string | null;
  logo_url: string | null;
};

var ThemeCtx = createContext<ThemeData>({ color_main: null, color_secondary: null, color_cta: null, color_bg: null, color_nav: null, color_hover: null, chatbot_avatar: null, hero_eyebrow: null, hero_title: null, hero_subtitle: null, business_name: null, business_tagline: null, logo_url: null });

export function useTheme() { return useContext(ThemeCtx); }

function hexToRgb(hex: string) {
  var h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function darken(hex: string, pct: number) {
  var { r, g, b } = hexToRgb(hex);
  var f = 1 - pct / 100;
  return "#" + [Math.round(r * f), Math.round(g * f), Math.round(b * f)].map(v => v.toString(16).padStart(2, "0")).join("");
}

function lighten(hex: string, pct: number) {
  var { r, g, b } = hexToRgb(hex);
  var f = pct / 100;
  return "#" + [Math.round(r + (255 - r) * f), Math.round(g + (255 - g) * f), Math.round(b + (255 - b) * f)].map(v => v.toString(16).padStart(2, "0")).join("");
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  var [theme, setTheme] = useState<ThemeData>({ color_main: null, color_secondary: null, color_cta: null, color_bg: null, color_nav: null, color_hover: null, chatbot_avatar: null, hero_eyebrow: null, hero_title: null, hero_subtitle: null, business_name: null, business_tagline: null, logo_url: null });

  useEffect(() => {
    (async () => {
      var { data } = await supabase.from("businesses").select("color_main, color_secondary, color_cta, color_bg, color_nav, color_hover, chatbot_avatar, hero_eyebrow, hero_title, hero_subtitle, business_name, business_tagline, logo_url").limit(1).single();
      if (data) {
        // Force professional branding for screenshots
        data.business_name = "Kayaks Adventures";
        data.business_tagline = "Premium Marine Experiences";
        data.hero_title = "Explore the Coast";
        data.hero_subtitle = "Book your next ocean adventure in seconds. Professional guides, top-tier equipment, and unforgettable memories.";
        setTheme(data);
      }
    })();
    // Load dotlottie script for animated avatars
    if (!document.getElementById("dotlottie-script")) {
      var script = document.createElement("script");
      script.id = "dotlottie-script";
      script.src = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.3/dist/dotlottie-wc.js";
      script.type = "module";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    var root = document.documentElement;
    if (theme.color_main) {
      root.style.setProperty("--accent", theme.color_main);
      root.style.setProperty("--accentHover", darken(theme.color_main, 15));
      root.style.setProperty("--accentSoft", lighten(theme.color_main, 85));
      root.style.setProperty("--focusRing", theme.color_main);
    }
    if (theme.color_secondary) {
      root.style.setProperty("--text", theme.color_secondary);
      root.style.setProperty("--textMuted", lighten(theme.color_secondary, 35));
    }
    if (theme.color_cta) {
      root.style.setProperty("--cta", theme.color_cta);
      root.style.setProperty("--ctaHover", darken(theme.color_cta, 15));
    }
    if (theme.color_bg) {
      root.style.setProperty("--bg", theme.color_bg);
      root.style.setProperty("--surface2", darken(theme.color_bg, 3));
    }
    if (theme.color_nav) {
      root.style.setProperty("--surface", theme.color_nav);
      root.style.setProperty("--border", darken(theme.color_nav, 12));
    }
    if (theme.color_hover) {
      root.style.setProperty("--hoverOverlay", theme.color_hover);
    }
  }, [theme]);

  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}
