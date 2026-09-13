import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OperatorDirectory from "../../../components/OperatorDirectory";
import { DESTINATIONS } from "../../../lib/directory-ways";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const dest = DESTINATIONS.find((d) => d.slug === slug);
  if (!dest) return {};
  const title = `${dest.label} Tours & Activities | Book Direct`;
  const description = `Book ${dest.label} tours and activities directly with the independent local operators who run them — no middleman, no booking fees.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function DestinationDirectoryPage({ params }: Props) {
  const { slug } = await params;
  const dest = DESTINATIONS.find((d) => d.slug === slug);
  if (!dest) notFound();

  return (
    <OperatorDirectory
      presetDestinationSlug={dest.slug}
      eyebrow={`Tours in ${dest.label}`}
      headline={`${dest.label} tours & activities`}
      subheadline={`Book direct with the independent operators running every trip in ${dest.label} — no middleman, no markups.`}
    />
  );
}
