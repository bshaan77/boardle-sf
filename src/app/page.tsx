import { HydrateClient } from "~/trpc/server";
import { GameBoard } from "~/app/_components/GameBoard";

export default function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-zinc-950 text-white">
        {/* Header */}
        <header className="w-full border-b border-zinc-800 px-4 py-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-rose-500">SF</span> Billboard
            </h1>
            <p className="text-sm text-zinc-500">Guess the company</p>
          </div>
        </header>

        {/* Game */}
        <div className="flex w-full flex-1 flex-col items-center px-4 py-8">
          <GameBoard />
        </div>

        {/* Footer */}
        <footer className="w-full border-t border-zinc-800 px-4 py-4 text-center text-xs text-zinc-600">
          A new billboard every day. Can you guess the company?
        </footer>
      </main>
    </HydrateClient>
  );
}
