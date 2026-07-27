"use client";

// Full-bleed decorative backdrop the glass surfaces blur against.
// First active tour image when one exists, else a mesh gradient generated
// from the operator palette (both under the engine-computed scrim).
// Purely decorative: aria-hidden, never carries text, z-index -1.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createTenantSupabase } from "../lib/supabase";
import { useTheme } from "./ThemeProvider";

export default function GlassBackdrop() {
  const theme = useTheme();
  const pathname = usePathname() || "";
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The embed widget iframes with a transparent page background — a fixed
  // backdrop would paint over the host site.
  const isEmbed = pathname.startsWith("/embed");

  // Operator-uploaded background wins immediately — a pure derivation from
  // theme, tracked during render (not an effect) since it needs no async work.
  const [prevHeroKey, setPrevHeroKey] = useState<string | null>(null);
  const heroKey = `${theme.id || ""}|${theme.hero_image || ""}|${isEmbed}`;
  if (heroKey !== prevHeroKey) {
    setPrevHeroKey(heroKey);
    if (!isEmbed && theme.id && theme.hero_image && theme.hero_image.trim()) {
      setImageUrl(theme.hero_image.trim());
    }
  }

  useEffect(() => {
    // First active tour photo is the fallback when there's no operator background.
    if (!theme.id || isEmbed || (theme.hero_image && theme.hero_image.trim())) return;
    let cancelled = false;
    (async () => {
      const supabase = createTenantSupabase(theme.id);
      const { data } = await supabase
        .from("tours")
        .select("image_url")
        .eq("business_id", theme.id!)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .limit(6);
      if (cancelled) return;
      const first = (data || []).map((t) => t.image_url).find((u) => typeof u === "string" && u.trim());
      if (first) setImageUrl(first);
    })();
    return () => { cancelled = true; };
  }, [theme.id, theme.hero_image, isEmbed]);

  if (isEmbed) return null;

  return (
    <div className="glass-backdrop" aria-hidden="true">
      {/* Mesh always renders — it's the blur content while the photo loads,
          and the permanent backdrop when the operator has no tour imagery. */}
      <div className="glass-backdrop-mesh" />
      {imageUrl && (
        // Plain <img>: the custom next/image loader allow-list doesn't cover
        // every operator-supplied host, and this layer is decorative + lazy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          style={{
            position: "absolute",
            inset: 0,
            opacity: loaded ? 1 : 0,
            transition: "opacity 600ms ease",
            // Pre-blur the photo itself so glass panels above don't have to
            // work as hard, and plain regions still show soft structure.
            filter: "blur(2px)",
            transform: "scale(1.03)",
          }}
        />
      )}
      {/* ::after on .glass-backdrop paints the scrim above both layers */}
    </div>
  );
}
