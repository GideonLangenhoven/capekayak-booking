// Operator matching for the directory's "Ways to travel" tiles.
// Pure data + regex, kept out of the component so scripts/check-ways.ts can
// exercise it without a React or Next runtime.

export const PHOTO = {
  capeTown: "photo-1580060839134-75a5edca2e99", // Table Mountain / Cape Town aerial
  coast: "photo-1506929562872-bb421503ef21", // turquoise bay with boats
  hike: "photo-1526772662000-3f88f10405ff", // hiker at a summit cairn
  hikeAlt: "photo-1551632811-561732d1e306", // trekker, mountain pass
  dive: "photo-1544551763-46a013bb70d5", // scuba diver in a shoal
  skydive: "photo-1521673252667-e05da380b252", // skydiver in freefall
  wine: "photo-1560493676-04071c5f467b", // vineyard rows at sunrise
  cycle: "photo-1517649763962-0c623066013b", // road cycling peloton
  raft: "photo-1530866495561-507c9faab2ed", // whitewater rafting
  boat: "photo-1476514525535-07fb3b4ae5f1", // bow of a boat on open water
  canyon: "photo-1484318571209-661cf29a69c3", // Blyde River Canyon
  mountain: "photo-1470071459604-3b5ec3a7fe05", // misty green mountains
  safari: "photo-1516426122078-c23e76319801", // game vehicle at sunset
  giraffe: "photo-1523805009345-7448845a9e53", // giraffe on the savanna
};

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
export const WAYS: Array<{ label: string; photo: string; match: RegExp }> = [
  { label: "Paddling & kayaking", photo: PHOTO.boat, match: /\bkayak|\bpaddl|\bcanoe|\bsup\b/i },
  { label: "Diving & snorkelling", photo: PHOTO.dive, match: /\bdiv(e|ing|er)|\bsnorkel|\breef|\bpadi\b/i },
  { label: "Hiking & trekking", photo: PHOTO.hikeAlt, match: /\bhik|\btrek|\bclimb|\bsummit|\balpine|\btrail/i },
  { label: "Wildlife & safari", photo: PHOTO.safari, match: /\bsafari|\bwildlife|\bgame\b|\bbig five|\bbird/i },
  { label: "Skydiving & air", photo: PHOTO.skydive, match: /\bskydiv|\bparachut|\bparaglid|\bkite|\bair\b/i },
  { label: "Wine & food routes", photo: PHOTO.wine, match: /\bwine|\bvineyard|\bfood|\btast/i },
  { label: "Rafting & whitewater", photo: PHOTO.raft, match: /\braft|\bwhitewater|\briver|\brapid/i },
  { label: "Cycling & biking", photo: PHOTO.cycle, match: /\bcycl|\bbik|\bmtb\b/i },
];
