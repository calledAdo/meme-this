import { pitchCardFromQuery } from "@/lib/cards";

export async function GET(request: Request) {
  const res = await pitchCardFromQuery(new URL(request.url).searchParams);
  res.headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
  return res;
}
