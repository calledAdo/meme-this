import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Feed } from "@/components/feed/Feed";
import { loadFeed, loadPitch, withPitches } from "@/lib/server";
import { CARD_KEYS } from "@/lib/share";

/** Shared pitch link: the pitch's own X card, and for people, the feed with the pitch already open. */
export async function generateMetadata({ params, searchParams }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  // The card is drawn from the stats carried in the shared link; no chain reads needed for the image.
  const q = new URLSearchParams();
  for (const k of CARD_KEYS) if (typeof sp[k] === "string") q.set(k, sp[k] as string);
  const sym = q.get("sym") ?? "MEME";
  const title = `$${sym} on Meme This`;
  const description = `Back $${sym} with USDC. When it hits its target, it's born as a coin.`;
  const image = `/card/p/${id}?${q.toString()}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PitchPage({ params }: PageProps<"/p/[id]">) {
  await connection();
  const { id } = await params;
  const [pitch, feed] = await Promise.all([loadPitch(id), loadFeed()]);
  if (!pitch) notFound();
  return (
    <Suspense>
      <Feed feed={withPitches(feed, [pitch])} initialPitch={id} />
    </Suspense>
  );
}
