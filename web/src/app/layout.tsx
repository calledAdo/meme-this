import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import { ConnectButton } from "@/components/ConnectButton";
import { SITE_URL } from "@/lib/chain";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Meme This", template: "%s · Meme This" },
  description: "Pitch a memecoin for free. Back it with USDC. When it hits its target it is born on Arc, with every backer buying in at one price.",
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions (recorders, wallets) inject attributes into <html>/<body> before React hydrates.
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <Providers>
          <header className="sticky top-0 z-20 border-b border-black/10 bg-white/80 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
              <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tighter">
                <span className="flex size-7 items-center justify-center rounded-lg bg-black">
                  <span className="size-2.5 rounded-full bg-white" />
                </span>
                Meme This
              </Link>
              <nav className="hidden items-center gap-6 text-sm text-black/60 sm:flex">
                <Link href="/" className="transition-colors hover:text-black">Live</Link>
                <Link href="/archive" className="transition-colors hover:text-black">Born</Link>
                <Link href="/how" className="transition-colors hover:text-black">How it works</Link>
              </nav>
              <ConnectButton />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</main>
          <footer className="border-t border-black/10">
            <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-xs text-black/50 sm:px-6">
              <span>Experimental and unaudited · Arc mainnet · small caps</span>
              <span>Coins are memes, not investments.</span>
            </div>
          </footer>
          <Toaster position="bottom-right" toastOptions={{ className: "font-sans tracking-tight" }} />
        </Providers>
      </body>
    </html>
  );
}
