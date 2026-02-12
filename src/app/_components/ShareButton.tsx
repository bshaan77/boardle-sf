"use client";

import { useState } from "react";

interface Props {
  date: string;
  guesses: string[];
  won: boolean;
  maxGuesses: number;
}

export function ShareButton({ date, guesses, won, maxGuesses }: Props) {
  const [copied, setCopied] = useState(false);

  function generateShareText() {
    const score = won ? `${guesses.length}/${maxGuesses}` : `X/${maxGuesses}`;
    const grid = guesses
      .map((_, i) => {
        if (won && i === guesses.length - 1) {
          return "🟩";
        }
        return "🟥";
      })
      .join("");

    return `SF Billboard ${date}\n${score}\n\n${grid}\n\nPlay at sfbillboard.com`;
  }

  async function handleShare() {
    const text = generateShareText();

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-500"
    >
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
