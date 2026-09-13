import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OperatorDirectory from "../../../components/OperatorDirectory";
import { WAYS } from "../../../lib/directory-ways";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const way = WAYS.find((w) => w.slug === slug);
  if (!way) return {};
  const title = `${way.label} Tours in Southern Africa | Book Direct`;
  const description = `Find ${way.label.toLowerCase()} tours across Southern Africa and book directly with the independent local operators who run them — no middleman, no booking fees.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function ActivityDirectoryPage({ params }: Props) {
  const { slug } = await params;
  const way = WAYS.find((w) => w.slug === slug);
  if (!way) notFound();

  return (
    <OperatorDirectory
      presetWaySlug={way.slug}
      eyebrow={way.label}
      headline={`${way.label} tours`}
      subheadline={`Book direct with the independent operators running every ${way.label.toLowerCase()} trip across Southern Africa — no middleman, no markups.`}
    />
  );
}
