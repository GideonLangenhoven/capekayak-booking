"use client";

// Full-bleed decorative backdrop the glass surfaces blur against.
// The operator's uploaded background when they have set one, otherwise a mesh
// gradient generated from their palette (both under the engine-computed scrim).
// Purely decorative: aria-hidden, never carries text, z-index -1.
//
// This used to fall back to the first active tour's photo when no background
// was uploaded. That put an image on the storefront that appears nowhere in the
// booking-site settings — the settings screen offers "Upload background" and
// reports none is set, while the site showed one anyway. A tour photo is
// chosen to sell that tour, not to be site furniture, so an operator who has
// uploaded no background now gets the palette mesh.
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";

export default function GlassBackdrop() {
  const theme = useTheme();
  const pathname = usePathname() || "";
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The embed widget iframes with a transparent page background — a fixed
  // backdrop would paint over the host site.
  const isEmbed = pathname.startsWith("/embed");

  // The uploaded background is a pure derivation from theme, so it is tracked
  // during render rather than in an effect — it needs no async work.
  //
  // Assigned unconditionally, including to null. It used to only ever be set,
  // never cleared, which the tour-photo fallback hid: removing the background
  // simply swapped one image for another. With no fallback, a one-way assign
  // would leave the deleted image on screen until the page remounted.
  const [prevHeroKey, setPrevHeroKey] = useState<string | null>(null);
  const heroKey = `${theme.id || ""}|${theme.hero_image || ""}|${isEmbed}`;
  if (heroKey !== prevHeroKey) {
    setPrevHeroKey(heroKey);
    const hero = !isEmbed && theme.id ? String(theme.hero_image || "").trim() : "";
    setImageUrl(hero || null);
    // Re-arm the fade so a newly chosen image eases in instead of appearing at
    // full opacity on the previous image's `loaded` flag.
    setLoaded(false);
  }

  if (isEmbed) return null;

  return (
    <div className="glass-backdrop" aria-hidden="true">
      {/* Mesh always renders — it's the blur content while an uploaded
          background loads, and the permanent backdrop when none is set. */}
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
