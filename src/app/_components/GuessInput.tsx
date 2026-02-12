"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  companies: string[];
  onGuess: (guess: string) => void;
  disabled: boolean;
}

export function GuessInput({ companies, onGuess, disabled }: Props) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (value.length >= 1) {
      const filtered = companies
        .filter((c) => c.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 8);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, companies]);

  function handleSubmit(guess?: string) {
    const finalGuess = guess ?? value;
    if (!finalGuess.trim()) return;
    onGuess(finalGuess.trim());
    setValue("");
    setShowSuggestions(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSubmit(suggestions[selectedIndex]);
      } else {
        handleSubmit();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 1 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          disabled={disabled}
          placeholder="Guess the company..."
          className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 outline-none transition focus:border-rose-500 focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
        />
        <button
          onClick={() => handleSubmit()}
          disabled={disabled || !value.trim()}
          className="rounded-lg bg-rose-600 px-6 py-3 font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
        >
          Guess
        </button>
      </div>

      {showSuggestions && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-600 bg-zinc-800 py-1 shadow-lg"
        >
          {suggestions.map((company, i) => (
            <li
              key={company}
              onMouseDown={() => handleSubmit(company)}
              className={`cursor-pointer px-4 py-2 text-sm ${
                i === selectedIndex
                  ? "bg-rose-600 text-white"
                  : "text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {company}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
