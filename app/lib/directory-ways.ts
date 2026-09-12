// Operator matching for the directory's "Ways to travel" tiles.
// Pure data + regex, kept out of the component so scripts/check-ways.ts can
// exercise it without a React or Next runtime.

// Self-hosted in public/stock (downloaded once from Unsplash under the
// Unsplash License, which permits commercial use without attribution).
// These were hotlinked to images.unsplash.com originally; a returning
// visitor's service worker cached an opaque CDN rate-limit response for some
// of them and replayed it as a broken image on every visit. Same-origin
// files remove the third-party failure mode entirely.
export const PHOTO = {
  capeTown: "/stock/cape-town", // Table Mountain / Cape Town aerial
  coast: "/stock/coast", // turquoise bay with boats
  hike: "/stock/hike", // hiker at a summit cairn
  hikeAlt: "/stock/hike-alt", // trekker, mountain pass
  dive: "/stock/dive", // scuba diver in a shoal
  skydive: "/stock/skydive", // skydiver in freefall
  wine: "/stock/wine", // vineyard rows at sunrise
  cycle: "/stock/cycle", // road cycling peloton
  raft: "/stock/raft", // whitewater rafting
  boat: "/stock/boat", // bow of a boat on open water
  canyon: "/stock/canyon", // Blyde River Canyon
  mountain: "/stock/mountain", // misty green mountains
  safari: "/stock/safari", // game vehicle at sunset
  giraffe: "/stock/giraffe", // giraffe on the savanna
};

// Rendition picker. Every photo has a 900px base; only the three hero-slide
// photos (capeTown, coast, hike) also ship -hero (1600px) and -thumb (240px)
// files, and only the hero requests those widths.
export const stock = (base: string, w = 900) =>
  `${base}${w >= 1600 ? "-hero" : w <= 400 ? "-thumb" : ""}.jpg`;

export type MatchableOperator = {
  business_name: string | null;
  name: string | null;
  business_tagline: string | null;
  location_phrase: string | null;
};

// One haystack for every operator match — tile badge, tile selection and the
// text search all read it, so they cannot drift apart.
export function haystack(o: MatchableOperator) {
  return `${o.business_name || ""} ${o.name || ""} ${o.business_tagline || ""} ${o.location_phrase || ""}`;
}

// Selecting a tile filters by the same regex that produced its count, so the
// badge can never disagree with what the tile shows.
// Every alternative is \b-anchored. Unanchored stems match inside unrelated
// words: "Craft"/"Driver" -> rafting, "Fair"/"Hair" -> air, "Divine" -> diving,
// "Recycling" -> cycling. scripts/check-ways.ts guards this.
// `slug` backs the dedicated /directory/activities/[slug] SEO landing pages —
// keep it stable, it's a public URL once indexed.
export const WAYS: Array<{ label: string; slug: string; photo: string; match: RegExp }> = [
  { label: "Paddling & kayaking", slug: "kayaking", photo: PHOTO.boat, match: /\bkayak|\bpaddl|\bcanoe|\bsup\b/i },
  { label: "Diving & snorkelling", slug: "diving", photo: PHOTO.dive, match: /\bdiv(e|ing|er)|\bsnorkel|\breef|\bpadi\b/i },
  { label: "Hiking & trekking", slug: "hiking", photo: PHOTO.hikeAlt, match: /\bhik|\btrek|\bclimb|\bsummit|\balpine|\btrail/i },
  { label: "Wildlife & safari", slug: "safari", photo: PHOTO.safari, match: /\bsafari|\bwildlife|\bgame\b|\bbig five|\bbird/i },
  { label: "Skydiving & air", slug: "skydiving", photo: PHOTO.skydive, match: /\bskydiv|\bparachut|\bparaglid|\bkite|\bair\b/i },
  { label: "Wine & food routes", slug: "wine-routes", photo: PHOTO.wine, match: /\bwine|\bvineyard|\bfood|\btast/i },
  { label: "Rafting & whitewater", slug: "rafting", photo: PHOTO.raft, match: /\braft|\bwhitewater|\briver|\brapid/i },
  { label: "Cycling & biking", slug: "cycling", photo: PHOTO.cycle, match: /\bcycl|\bbik|\bmtb\b/i },
];

// Stock imagery for well-known Southern African locations, used only when no
// operator in that location has uploaded a photo yet. Also backs the dedicated
// /directory/destinations/[slug] SEO landing pages — keep `slug` stable.
export const DESTINATIONS: Array<{ label: string; slug: string; photo: string; match: RegExp }> = [
  { label: "Cape Town", slug: "cape-town", photo: PHOTO.capeTown, match: /cape town|sea point|camps bay|table mountain|atlantic seaboard|hout bay/i },
  { label: "Cape Winelands", slug: "winelands", photo: PHOTO.wine, match: /winelands|stellenbosch|franschhoek|paarl|constantia/i },
  { label: "Garden Route", slug: "garden-route", photo: PHOTO.coast, match: /garden route|knysna|plettenberg|hermanus|mossel/i },
  { label: "Drakensberg", slug: "drakensberg", photo: PHOTO.mountain, match: /drakensberg|berg|maloti|lesotho/i },
  { label: "Kruger & Mpumalanga", slug: "kruger-mpumalanga", photo: PHOTO.canyon, match: /kruger|mpumalanga|limpopo|blyde|panorama/i },
  { label: "Namibia", slug: "namibia", photo: PHOTO.giraffe, match: /namibia|swakopmund|sossusvlei|desert|kalahari/i },
  { label: "Durban & KZN", slug: "durban-kzn", photo: PHOTO.dive, match: /durban|zululand|kwazulu|st lucia|sodwana/i },
];
