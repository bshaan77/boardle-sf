"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { RedactionCanvas } from "~/app/_components/RedactionCanvas";

type Tab = "search" | "candidates" | "schedule";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(
    null,
  );
  const [redactedPath, setRedactedPath] = useState<string | null>(null);

  // Schedule form state
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleAnswer, setScheduleAnswer] = useState("");
  const [scheduleHint, setScheduleHint] = useState("");
  const [scheduleCategory, setScheduleCategory] = useState("");

  const utils = api.useUtils();
  const { data: candidates } = api.billboard.getCandidates.useQuery();
  const { data: puzzles } = api.billboard.getAllPuzzles.useQuery();
  const { data: quotaStats } = api.billboard.getQuotaStats.useQuery();
  const searchMutation = api.billboard.searchTwitter.useMutation({
    onSuccess: () => {
      void utils.billboard.getCandidates.invalidate();
      void utils.billboard.getQuotaStats.invalidate();
    },
  });
  const updateCandidate = api.billboard.updateCandidate.useMutation({
    onSuccess: () => void utils.billboard.getCandidates.invalidate(),
  });
  const saveRedacted = api.billboard.saveRedactedImage.useMutation();
  const schedulePuzzle = api.billboard.schedulePuzzle.useMutation({
    onSuccess: () => {
      void utils.billboard.getAllPuzzles.invalidate();
      void utils.billboard.getCandidates.invalidate();
      setSelectedCandidate(null);
      setRedactedPath(null);
      setScheduleDate("");
      setScheduleAnswer("");
      setScheduleHint("");
      setScheduleCategory("");
    },
  });

  const pendingCandidates =
    candidates
      ?.filter((c) => c.status === "pending")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) ?? [];
  const approvedCandidates =
    candidates
      ?.filter((c) => c.status === "approved")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) ?? [];

  const selectedCandidateData = candidates?.find(
    (c) => c.id === selectedCandidate,
  );

  async function handleSearch() {
    await searchMutation.mutateAsync({
      query: searchQuery || undefined,
      maxResults: 20,
    });
  }

  async function handleSaveRedaction(dataUrl: string) {
    if (!selectedCandidate) return;
    const result = await saveRedacted.mutateAsync({
      imageData: dataUrl,
      candidateId: selectedCandidate,
    });
    setRedactedPath(result.path);
  }

  async function handleSchedule() {
    if (
      !selectedCandidate ||
      !redactedPath ||
      !scheduleDate ||
      !scheduleAnswer ||
      !scheduleHint ||
      !scheduleCategory
    )
      return;
    await schedulePuzzle.mutateAsync({
      candidateId: selectedCandidate,
      date: scheduleDate,
      answer: scheduleAnswer,
      hint: scheduleHint,
      category: scheduleCategory,
      redactedImagePath: redactedPath,
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold">SF Billboard Admin</h1>

        {/* Tabs */}
        <div className="mb-8 flex gap-1 rounded-lg bg-zinc-900 p-1">
          {(["search", "candidates", "schedule"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition ${
                tab === t
                  ? "bg-rose-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search Tab */}
        {tab === "search" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-lg font-semibold">
                Search X for Billboards
              </h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Custom query or leave empty for default SF billboard search...'
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-rose-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={searchMutation.isPending}
                  className="rounded-lg bg-rose-600 px-6 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {searchMutation.isPending ? "Searching..." : "Search X"}
                </button>
              </div>
              {searchMutation.isSuccess && (
                <p className="mt-3 text-sm text-green-400">
                  Found {searchMutation.data.count} billboard image(s)
                  {searchMutation.data.duplicatesSkipped > 0 &&
                    ` (skipped ${searchMutation.data.duplicatesSkipped} duplicates)`}
                  . Check the Candidates tab.
                </p>
              )}
              {searchMutation.isError && (
                <p className="mt-3 text-sm text-red-400">
                  Error: {searchMutation.error.message}
                </p>
              )}
            </div>

            {/* Quota Usage */}
            {quotaStats && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="mb-4 text-lg font-semibold">
                  Monthly Quota Usage
                </h2>
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-zinc-400">
                      {quotaStats.monthUsage.postsConsumed.toLocaleString()} /{" "}
                      {quotaStats.monthUsage.monthlyQuota.toLocaleString()} posts
                    </span>
                    <span
                      className={`font-medium ${
                        quotaStats.monthUsage.isCritical
                          ? "text-red-400"
                          : quotaStats.monthUsage.isWarning
                            ? "text-amber-400"
                            : "text-green-400"
                      }`}
                    >
                      {quotaStats.monthUsage.percentageUsed.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full transition-all ${
                        quotaStats.monthUsage.isCritical
                          ? "bg-red-500"
                          : quotaStats.monthUsage.isWarning
                            ? "bg-amber-500"
                            : "bg-green-500"
                      }`}
                      style={{
                        width: `${Math.min(quotaStats.monthUsage.percentageUsed, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-zinc-500">Searches This Month</div>
                    <div className="text-lg font-semibold text-white">
                      {quotaStats.monthUsage.searchCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Remaining Quota</div>
                    <div className="text-lg font-semibold text-white">
                      {quotaStats.monthUsage.remainingQuota.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Automated Searches</div>
                    <div className="text-lg font-semibold text-white">
                      {quotaStats.automatedSearches}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Manual Searches</div>
                    <div className="text-lg font-semibold text-white">
                      {quotaStats.manualSearches}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Searches */}
            {quotaStats?.recentSearches && quotaStats.recentSearches.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="mb-4 text-lg font-semibold">Recent Searches</h2>
                <div className="space-y-2">
                  {quotaStats.recentSearches.slice(0, 5).map((search) => (
                    <div
                      key={search.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-sm"
                    >
                      <div>
                        <span
                          className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                            search.source === "automated"
                              ? "bg-blue-900/50 text-blue-300"
                              : "bg-zinc-700 text-zinc-300"
                          }`}
                        >
                          {search.source}
                        </span>
                        <span className="text-zinc-400">
                          {new Date(search.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-zinc-300">
                        {search.candidatesAdded} added
                        {search.duplicatesSkipped > 0 &&
                          `, ${search.duplicatesSkipped} dup`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-2 text-lg font-semibold">Default Query</h2>
              <code className="block rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">
                (billboard OR &quot;out of home&quot; OR OOH) (&quot;San
                Francisco&quot; OR SF) has:images -is:retweet -is:reply lang:en
              </code>
              <p className="mt-3 text-sm text-zinc-500">
                Searches the last 7 days of tweets (X Basic API tier).
              </p>
            </div>
          </div>
        )}

        {/* Candidates Tab */}
        {tab === "candidates" && (
          <div className="space-y-6">
            {/* Pending Review */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-lg font-semibold">
                Pending Review ({pendingCandidates.length})
              </h2>
              {pendingCandidates.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No pending candidates. Search X to find billboard images.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {pendingCandidates.map((c) => (
                    <div
                      key={c.id}
                      className="overflow-hidden rounded-lg border border-zinc-700"
                    >
                      <img
                        src={c.localImagePath}
                        alt="Billboard candidate"
                        className="h-48 w-full object-cover"
                      />
                      <div className="p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="text-xs text-zinc-400">
                            @{c.authorUsername}
                          </p>
                          {c.score !== undefined && (
                            <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-xs font-medium text-rose-300">
                              Score: {c.score.toFixed(0)}
                            </span>
                          )}
                        </div>
                        <p className="mb-3 line-clamp-2 text-sm text-zinc-300">
                          {c.tweetText}
                        </p>
                        {c.likeCount !== undefined && c.retweetCount !== undefined && (
                          <p className="mb-2 text-xs text-zinc-500">
                            {c.likeCount} likes · {c.retweetCount} retweets
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateCandidate.mutate({
                                id: c.id,
                                status: "approved",
                              })
                            }
                            className="rounded bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-600"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              updateCandidate.mutate({
                                id: c.id,
                                status: "rejected",
                              })
                            }
                            className="rounded bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-600"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approved */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-lg font-semibold">
                Approved ({approvedCandidates.length})
              </h2>
              {approvedCandidates.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No approved candidates yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {approvedCandidates.map((c) => (
                    <div
                      key={c.id}
                      className="overflow-hidden rounded-lg border border-zinc-700"
                    >
                      <img
                        src={c.localImagePath}
                        alt="Approved billboard"
                        className="h-48 w-full object-cover"
                      />
                      <div className="p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <p className="text-xs text-zinc-400">
                            @{c.authorUsername}
                          </p>
                          {c.score !== undefined && (
                            <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-xs font-medium text-rose-300">
                              {c.score.toFixed(0)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCandidate(c.id);
                            setRedactedPath(null);
                            setTab("schedule");
                          }}
                          className="rounded bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-500"
                        >
                          Redact & Schedule
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {tab === "schedule" && (
          <div className="space-y-6">
            {selectedCandidateData ? (
              <>
                {/* Redaction Tool */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                  <h2 className="mb-4 text-lg font-semibold">
                    Redact Billboard
                  </h2>
                  <RedactionCanvas
                    imageSrc={selectedCandidateData.localImagePath}
                    onSave={handleSaveRedaction}
                  />
                  {saveRedacted.isPending && (
                    <p className="mt-2 text-sm text-zinc-400">
                      Saving redacted image...
                    </p>
                  )}
                  {redactedPath && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm text-green-400">
                        Redacted image saved!
                      </p>
                      <img
                        src={redactedPath}
                        alt="Redacted preview"
                        className="max-h-48 rounded-lg border border-zinc-700"
                      />
                    </div>
                  )}
                </div>

                {/* Schedule Form */}
                {redactedPath && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <h2 className="mb-4 text-lg font-semibold">
                      Schedule Puzzle
                    </h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm text-zinc-400">
                          Date
                        </label>
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-zinc-400">
                          Answer (company name)
                        </label>
                        <input
                          type="text"
                          value={scheduleAnswer}
                          onChange={(e) => setScheduleAnswer(e.target.value)}
                          placeholder="e.g. Stripe"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-zinc-400">
                          Hint
                        </label>
                        <input
                          type="text"
                          value={scheduleHint}
                          onChange={(e) => setScheduleHint(e.target.value)}
                          placeholder="e.g. Payments infrastructure for the internet"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-zinc-400">
                          Category
                        </label>
                        <input
                          type="text"
                          value={scheduleCategory}
                          onChange={(e) =>
                            setScheduleCategory(e.target.value)
                          }
                          placeholder="e.g. fintech, health, consumer"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleSchedule}
                      disabled={
                        schedulePuzzle.isPending ||
                        !scheduleDate ||
                        !scheduleAnswer ||
                        !scheduleHint ||
                        !scheduleCategory
                      }
                      className="mt-4 rounded-lg bg-rose-600 px-6 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-40"
                    >
                      {schedulePuzzle.isPending
                        ? "Scheduling..."
                        : "Schedule Puzzle"}
                    </button>
                    {schedulePuzzle.isSuccess && (
                      <p className="mt-2 text-sm text-green-400">
                        Puzzle scheduled!
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-zinc-400">
                  Select an approved candidate from the Candidates tab to redact
                  and schedule.
                </p>
              </div>
            )}

            {/* Scheduled Puzzles */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-lg font-semibold">
                Scheduled Puzzles ({puzzles?.length ?? 0})
              </h2>
              {!puzzles?.length ? (
                <p className="text-sm text-zinc-500">
                  No puzzles scheduled yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {puzzles
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-4 rounded-lg border border-zinc-700 p-3"
                      >
                        <img
                          src={p.redactedImagePath}
                          alt="Scheduled puzzle"
                          className="h-16 w-24 rounded object-cover"
                        />
                        <div>
                          <div className="text-sm font-medium text-white">
                            {p.date}
                          </div>
                          <div className="text-sm text-zinc-400">
                            {p.answer} ({p.category})
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
