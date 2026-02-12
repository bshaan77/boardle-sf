"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "~/trpc/react";
import { GuessInput } from "./GuessInput";
import { StatsModal } from "./StatsModal";
import { ShareButton } from "./ShareButton";

const MAX_GUESSES = 6;
const HINT_THRESHOLD = 3; // show hint after this many wrong guesses

interface GameState {
  date: string;
  guesses: string[];
  won: boolean;
  lost: boolean;
}

function loadGameState(date: string): GameState {
  if (typeof window === "undefined") {
    return { date, guesses: [], won: false, lost: false };
  }
  try {
    const stored = localStorage.getItem(`billboard-game-${date}`);
    if (stored) {
      return JSON.parse(stored) as GameState;
    }
  } catch {}
  return { date, guesses: [], won: false, lost: false };
}

function saveGameState(state: GameState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`billboard-game-${state.date}`, JSON.stringify(state));
}

interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: Record<number, number>;
}

function loadStats(): Stats {
  if (typeof window === "undefined") {
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: {},
    };
  }
  try {
    const stored = localStorage.getItem("billboard-stats");
    if (stored) return JSON.parse(stored) as Stats;
  } catch {}
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: {},
  };
}

function saveStats(stats: Stats) {
  if (typeof window === "undefined") return;
  localStorage.setItem("billboard-stats", JSON.stringify(stats));
}

export function GameBoard() {
  const [showStats, setShowStats] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [stats, setStats] = useState<Stats>(loadStats());
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [animateResult, setAnimateResult] = useState<"correct" | "wrong" | null>(null);

  const { data: puzzle, isLoading } = api.billboard.getDailyPuzzle.useQuery();
  const { data: companies } = api.billboard.getCompanies.useQuery();
  const { data: revealed } = api.billboard.revealAnswer.useQuery(undefined, {
    enabled: gameState?.won === true || gameState?.lost === true,
  });
  const submitGuess = api.billboard.submitGuess.useMutation();

  // Initialize game state when puzzle loads
  useEffect(() => {
    if (puzzle?.date) {
      setGameState(loadGameState(puzzle.date));
    }
  }, [puzzle?.date]);

  // Set revealed answer when game is over
  useEffect(() => {
    if (revealed) {
      setRevealedAnswer(revealed.answer);
      setOriginalImage(revealed.originalImagePath);
    }
  }, [revealed]);

  const handleGuess = useCallback(
    async (guess: string) => {
      if (!gameState || !puzzle || gameState.won || gameState.lost) return;

      // Don't allow duplicate guesses
      if (
        gameState.guesses.some(
          (g) => g.toLowerCase() === guess.toLowerCase(),
        )
      ) {
        return;
      }

      const result = await submitGuess.mutateAsync({ guess });

      const newGuesses = [...gameState.guesses, guess];
      const won = result.correct;
      const lost = !won && newGuesses.length >= MAX_GUESSES;

      const newState: GameState = {
        ...gameState,
        guesses: newGuesses,
        won,
        lost,
      };

      setGameState(newState);
      saveGameState(newState);

      // Animate result
      setAnimateResult(won ? "correct" : "wrong");
      setTimeout(() => setAnimateResult(null), 1000);

      // Update stats if game just ended
      if (won || lost) {
        const newStats = { ...stats };
        newStats.gamesPlayed += 1;
        if (won) {
          newStats.gamesWon += 1;
          newStats.currentStreak += 1;
          newStats.maxStreak = Math.max(
            newStats.maxStreak,
            newStats.currentStreak,
          );
          const guessNum = newGuesses.length;
          newStats.guessDistribution[guessNum] =
            (newStats.guessDistribution[guessNum] ?? 0) + 1;
        } else {
          newStats.currentStreak = 0;
        }
        setStats(newStats);
        saveStats(newStats);

        // Show stats modal after a delay
        setTimeout(() => setShowStats(true), 1500);
      }
    },
    [gameState, puzzle, submitGuess, stats],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-lg text-zinc-400">Loading today&apos;s puzzle...</div>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <div className="text-2xl font-bold text-zinc-300">
          No puzzle today
        </div>
        <p className="text-zinc-500">
          Check back tomorrow for a new billboard to guess!
        </p>
        <button
          onClick={() => setShowStats(true)}
          className="mt-4 rounded-lg bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600"
        >
          View Stats
        </button>
        {showStats && (
          <StatsModal stats={stats} onClose={() => setShowStats(false)} />
        )}
      </div>
    );
  }

  if (!gameState) return null;

  const gameOver = gameState.won || gameState.lost;
  const showHint =
    gameState.guesses.length >= HINT_THRESHOLD && !gameState.won;

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6">
      {/* Billboard Image */}
      <div className="relative w-full overflow-hidden rounded-xl border border-zinc-700 shadow-2xl">
        {gameOver && originalImage ? (
          <img
            src={originalImage}
            alt="Original billboard"
            className="w-full"
          />
        ) : (
          <img
            src={puzzle.redactedImagePath}
            alt="Redacted billboard — guess the company!"
            className="w-full"
          />
        )}

        {/* Result overlay animation */}
        {animateResult && (
          <div
            className={`absolute inset-0 flex items-center justify-center ${
              animateResult === "correct"
                ? "bg-green-500/20"
                : "bg-red-500/20"
            } animate-pulse`}
          >
            <span className="text-4xl font-bold text-white drop-shadow-lg">
              {animateResult === "correct" ? "Correct!" : "Nope!"}
            </span>
          </div>
        )}
      </div>

      {/* Hint */}
      {showHint && (
        <div className="w-full rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-center text-sm text-amber-300">
          Hint: {puzzle.hint}
        </div>
      )}

      {/* Guesses */}
      <div className="flex w-full max-w-md flex-col gap-2">
        {gameState.guesses.map((guess, i) => (
          <div
            key={i}
            className={`flex items-center rounded-lg px-4 py-2 text-sm font-medium ${
              gameState.won && i === gameState.guesses.length - 1
                ? "border border-green-600 bg-green-900/30 text-green-300"
                : "border border-red-800/50 bg-red-900/20 text-red-300"
            }`}
          >
            <span className="mr-3 text-zinc-500">{i + 1}.</span>
            <span>{guess}</span>
            <span className="ml-auto">
              {gameState.won && i === gameState.guesses.length - 1
                ? "✓"
                : "✗"}
            </span>
          </div>
        ))}

        {/* Empty guess slots */}
        {!gameOver &&
          Array.from({
            length: MAX_GUESSES - gameState.guesses.length,
          }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="rounded-lg border border-zinc-700/50 px-4 py-2 text-sm text-zinc-600"
            >
              <span className="mr-3">
                {gameState.guesses.length + i + 1}.
              </span>
              <span>—</span>
            </div>
          ))}
      </div>

      {/* Input or Result */}
      {gameOver ? (
        <div className="flex flex-col items-center gap-4">
          <div
            className={`text-xl font-bold ${gameState.won ? "text-green-400" : "text-red-400"}`}
          >
            {gameState.won
              ? `You got it in ${gameState.guesses.length}!`
              : `The answer was ${revealedAnswer ?? "..."}`}
          </div>
          <div className="flex gap-3">
            <ShareButton
              date={gameState.date}
              guesses={gameState.guesses}
              won={gameState.won}
              maxGuesses={MAX_GUESSES}
            />
            <button
              onClick={() => setShowStats(true)}
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
            >
              Stats
            </button>
          </div>
        </div>
      ) : (
        <GuessInput
          companies={companies ?? []}
          onGuess={handleGuess}
          disabled={submitGuess.isPending}
        />
      )}

      {/* Stats Modal */}
      {showStats && (
        <StatsModal stats={stats} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}
