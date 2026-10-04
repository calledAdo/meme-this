import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Feed } from "@/components/feed/Feed";
import { loadFeed, loadPrompt, withPitches } from "@/lib/server";

export async function generateMetadata({ params }: PageProps<"/prompt/[id]">): Promise<Metadata> {
  const data = await loadPrompt((await params).id).catch(() => null);
  if (!data) return { title: "Prompt not found" };
  const description = `Meme this: ${data.prompt.title}. Pitch a coin, back the best one with USDC. The first to fill is born.`;
  return { title: data.prompt.title, description, openGraph: { title: data.prompt.title, description } };
}

export default async function PromptPage({ params }: PageProps<"/prompt/[id]">) {
  await connection();
  const [data, feed] = await Promise.all([loadPrompt((await params).id), loadFeed()]);
  if (!data) notFound();
  return (
    <Suspense>
      <Feed feed={withPitches(feed, data.pitches)} prompt={data.prompt} />
    </Suspense>
  );
}
