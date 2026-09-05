import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Space_Grotesk, JetBrains_Mono, Inter } from "next/font/google";
import { defaultTheme } from "@/lib/featureFlags";
import { isTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // The tab title, the bookmark, and the first line of a search result.
  // "Five" alone is not findable and not obviously software; the second
  // half says what it is without claiming a category. It deliberately does
  // not say AI or agentic: nothing here acts on its own yet, you press
  // Analyze, and a title is a bad place to be caught overclaiming.
  title: "Five · Deal management",
  description:
    "Deal management for one to five sellers. Five slots, a line after each call, and a read on which deal has stopped moving.",
};

/**
 * The theme is decided here, on the server, and written into the HTML
 * before anything paints.
 *
 * The alternative - a script that reads localStorage and sets the
 * attribute on load - is the reason so many apps flash the wrong colour
 * for a frame. The cookie is already travelling with the request, so the
 * right answer is available before the first byte of markup.
 *
 * `isTheme` is the gate: the cookie value goes straight into an attribute,
 * so anything that is not one of the two known words has to fall back
 * here rather than reach the document.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const stored = cookieStore.get(THEME_COOKIE)?.value;
  const theme = isTheme(stored) ? stored : defaultTheme();

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
