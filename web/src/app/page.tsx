import { connection } from "next/server";
import { Suspense } from "react";
import { Feed } from "@/components/feed/Feed";
import { loadFeed } from "@/lib/server";

/** Home is the live feed itself: pitches racing to their target. */
export default async function Home() {
  await connection();
  const feed = await loadFeed();
  return (
    <Suspense>
      <Feed feed={feed} />
    </Suspense>
  );
}
