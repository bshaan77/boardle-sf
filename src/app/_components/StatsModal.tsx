"use client";

interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: Record<number, number>;
}

interface Props {
  stats: Stats;
  onClose: () => void;
}

export function StatsModal({ stats, onClose }: Props) {
  const winRate =
    stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;

  const maxDistValue = Math.max(
    ...Object.values(stats.guessDistribution),
    1,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Statistics</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Stats Grid */}
        <div className="mb-6 grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">
              {stats.gamesPlayed}
            </div>
            <div className="text-xs text-zinc-400">Played</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{winRate}</div>
            <div className="text-xs text-zinc-400">Win %</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {stats.currentStreak}
            </div>
            <div className="text-xs text-zinc-400">Current Streak</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {stats.maxStreak}
            </div>
            <div className="text-xs text-zinc-400">Max Streak</div>
          </div>
        </div>

        {/* Guess Distribution */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Guess Distribution
          </h3>
          {stats.gamesPlayed === 0 ? (
            <p className="text-sm text-zinc-500">No data yet</p>
          ) : (
            <div className="space-y-1.5">
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const count = stats.guessDistribution[num] ?? 0;
                const width = Math.max(
                  (count / maxDistValue) * 100,
                  count > 0 ? 10 : 0,
                );
                return (
                  <div key={num} className="flex items-center gap-2">
                    <span className="w-3 text-sm text-zinc-400">{num}</span>
                    <div
                      className="flex h-6 items-center justify-end rounded bg-rose-600 px-2 text-xs font-medium text-white transition-all"
                      style={{ width: `${width}%`, minWidth: count > 0 ? "24px" : "0px" }}
                    >
                      {count > 0 && count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
