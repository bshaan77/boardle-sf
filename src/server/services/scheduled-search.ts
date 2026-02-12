import cron from "node-cron";
import { searchAndDownload } from "./twitter";
import { addCandidates } from "~/server/data/puzzles";
import { recordSearch, getCurrentMonthUsage } from "~/server/data/quota";

let cronJob: cron.ScheduledTask | null = null;

export async function runScheduledSearch() {
  console.log("[Scheduled Search] Starting automated billboard search...");

  // Check quota before running
  const quotaUsage = getCurrentMonthUsage();
  if (quotaUsage.isCritical) {
    console.error(
      `[Scheduled Search] ABORTED: Quota usage critical (${quotaUsage.percentageUsed.toFixed(1)}%)`,
    );
    return;
  }

  try {
    const result = await searchAndDownload(undefined, 20);

    // Record search in quota tracking
    recordSearch({
      timestamp: new Date().toISOString(),
      query: "default",
      resultsCount: 20, // maxResults requested
      candidatesAdded: result.candidates.length,
      duplicatesSkipped: result.duplicatesSkipped,
      source: "automated",
    });

    // Add new candidates
    addCandidates(result.candidates);

    console.log(
      `[Scheduled Search] Completed: ${result.candidates.length} new candidates added, ${result.duplicatesSkipped} duplicates skipped`,
    );
  } catch (error) {
    console.error("[Scheduled Search] Error:", error);
  }
}

export function startScheduledSearches(schedule = "0 9 * * *") {
  if (cronJob) {
    console.log("[Scheduled Search] Cron job already running");
    return;
  }

  // Validate cron expression
  if (!cron.validate(schedule)) {
    console.error(`[Scheduled Search] Invalid cron schedule: ${schedule}`);
    return;
  }

  console.log(`[Scheduled Search] Starting cron job with schedule: ${schedule}`);
  cronJob = cron.schedule(schedule, runScheduledSearch);

  console.log("[Scheduled Search] Cron job initialized successfully");
}

export function stopScheduledSearches() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[Scheduled Search] Cron job stopped");
  }
}

// Auto-start if in production and ENABLE_CRON is true
if (process.env.NODE_ENV === "production" && process.env.ENABLE_CRON === "true") {
  const schedule = process.env.CRON_SCHEDULE ?? "0 9 * * *"; // Default: 9 AM daily
  startScheduledSearches(schedule);
}
