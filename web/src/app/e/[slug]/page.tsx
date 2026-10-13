import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Feed } from "@/components/feed/Feed";
import { unofficial } from "@/lib/feed";
import { loadEntityPitches, loadFeed, withPitches } from "@/lib/server";

async function find(slug: string) {
  const feed = await loadFeed();
  const entity = feed.entities.find((e) => e.slug === slug.toLowerCase());
  return { feed, entity };
}

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { entity } = await find((await params).slug).catch(() => ({ entity: undefined }));
  if (!entity) return { title: "Not found" };
  const title = `${entity.name} memes`;
  const description = `Pitch and back ${entity.name} memecoins on Meme This. First to fill is born. ${unofficial(entity)}`;
  return { title, description, openGraph: { title, description } };
}

export default async function EntityPage({ params }: PageProps<"/e/[slug]">) {
  await connection();
  const { feed, entity } = await find((await params).slug);
  if (!entity) notFound();
  const extra = await loadEntityPitches(feed, entity.id);
  return (
    <Suspense>
      <Feed feed={withPitches(feed, extra)} entity={entity} />
    </Suspense>
  );
}
