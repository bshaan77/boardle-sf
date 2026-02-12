import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "SF Billboard — Guess the Company",
  description:
    "A daily guessing game. We redact the brand from a San Francisco billboard — can you figure out which company it belongs to?",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="bg-zinc-950">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
