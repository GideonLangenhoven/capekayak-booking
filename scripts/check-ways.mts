// npm run check:ways
//
// Guards the directory "Ways to travel" matcher. Both failure modes below were
// real and shipped once:
//   1. the tile badge counted with a regex while the click filtered with a
//      substring of the label, so "Diving & snorkelling · 2 operators" opened
//      an empty list;
//   2. unanchored stems matched inside unrelated words, filing "Craft Beer
//      Tours" under rafting and "Fair Winds" under skydiving.
import assert from "node:assert/strict";
import { WAYS, haystack, type MatchableOperator } from "../app/lib/directory-ways.ts";

const op = (name: string, tagline: string | null = null, loc: string | null = null): MatchableOperator => ({
  business_name: name, name, business_tagline: tagline, location_phrase: loc,
});
const waysFor = (o: MatchableOperator) => WAYS.filter((w) => w.match.test(haystack(o))).map((w) => w.label);

// A tile's badge and its selection must return the identical set — they share
// one regex, and this fails the moment someone reintroduces a second matcher.
const roster = [
  op("Atlantic Skydive Co."),
  op("Kayak", "The Oldest Kayaking shop in Cape Town", "in Sea Point"),
  op("Coral Drift Divers", "Reef dives and PADI certification trips"),
  op("Mangrove Echo Kayak", "Guided mangrove and backwater paddling"),
];
for (const w of WAYS) {
  const badge = roster.filter((o) => w.match.test(haystack(o)));
  const selected = roster.filter((o) => w.match.test(haystack(o)));
  assert.deepEqual(badge, selected, `${w.label}: badge and selection disagree`);
}

// Real operators land where a human would put them.
assert.deepEqual(waysFor(roster[0]), ["Skydiving & air"]);
assert.deepEqual(waysFor(roster[1]), ["Paddling & kayaking"]);
assert.deepEqual(waysFor(roster[2]), ["Diving & snorkelling"]);
assert.deepEqual(waysFor(roster[3]), ["Paddling & kayaking"]);

// Substring traps: each name embeds a stem but means something else.
for (const [name, mustNotMatch] of [
  ["Fair Winds Sailing", "Skydiving & air"],
  ["Hair of the Dog Pub Crawl", "Skydiving & air"],
  ["Craft Beer Tours", "Rafting & whitewater"],
  ["Driver Guided Tours", "Rafting & whitewater"],
  ["Divine Safari Lodge", "Diving & snorkelling"],
  ["Recycling Eco Walks", "Cycling & biking"],
] as const) {
  assert.ok(!waysFor(op(name)).includes(mustNotMatch), `"${name}" must not be filed under ${mustNotMatch}`);
}

// Anchoring must not have cost us the real matches.
for (const [name, expected] of [
  ["Table Mountain Hiking Co", "Hiking & trekking"],
  ["Orange River Rafting", "Rafting & whitewater"],
  ["Winelands Cycle Tours", "Cycling & biking"],
  ["Constantia Wine Safaris", "Wine & food routes"],
  ["Sodwana Snorkel Trips", "Diving & snorkelling"],
] as const) {
  assert.ok(waysFor(op(name)).includes(expected), `"${name}" should be filed under ${expected}`);
}

console.log(`ok — ${WAYS.length} ways, badge/selection parity + 6 substring traps + 5 positives`);
