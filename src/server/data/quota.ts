import fs from "fs";
import path from "path";

export interface SearchRecord {
  id: string;
  timestamp: string; // ISO date string
  query: string;
  resultsCount: number;
  candidatesAdded: number;
  duplicatesSkipped: number;
  source: "manual" | "automated";
}

interface QuotaStore {
  searches: SearchRecord[];
  monthlyQuota: number; // X API Basic tier limit
  quotaWarningThreshold: number; // Warn at 80%
  quotaCriticalThreshold: number; // Critical at 95%
}

const QUOTA_PATH = path.join(process.cwd(), "data", "quota.json");

const DEFAULT_STORE: QuotaStore = {
  searches: [],
  monthlyQuota: 10000, // X API Basic tier monthly post limit
  quotaWarningThreshold: 0.8,
  quotaCriticalThreshold: 0.95,
};

function ensureQuotaFile(): QuotaStore {
  const dir = path.dirname(QUOTA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(QUOTA_PATH)) {
    fs.writeFileSync(QUOTA_PATH, JSON.stringify(DEFAULT_STORE, null, 2));
    return DEFAULT_STORE;
  }
  return JSON.parse(fs.readFileSync(QUOTA_PATH, "utf-8")) as QuotaStore;
}

function saveQuotaStore(store: QuotaStore): void {
  const dir = path.dirname(QUOTA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(QUOTA_PATH, JSON.stringify(store, null, 2));
}

export function recordSearch(record: Omit<SearchRecord, "id">): void {
  const store = ensureQuotaFile();
  const newRecord: SearchRecord = {
    ...record,
    id: `search-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
  store.searches.push(newRecord);
  saveQuotaStore(store);

  // Log quota status
  const usage = getCurrentMonthUsage();
  console.log(
    `[Quota] Search recorded: ${record.resultsCount} results, ${record.candidatesAdded} added, ${record.duplicatesSkipped} duplicates`,
  );
  console.log(
    `[Quota] Current month usage: ${usage.postsConsumed}/${store.monthlyQuota} (${usage.percentageUsed.toFixed(1)}%)`,
  );

  if (usage.percentageUsed >= store.quotaCriticalThreshold * 100) {
    console.warn(
      `[Quota] CRITICAL: ${usage.percentageUsed.toFixed(1)}% of monthly quota used!`,
    );
  } else if (usage.percentageUsed >= store.quotaWarningThreshold * 100) {
    console.warn(
      `[Quota] WARNING: ${usage.percentageUsed.toFixed(1)}% of monthly quota used`,
    );
  }
}

export function getCurrentMonthUsage() {
  const store = ensureQuotaFile();
  const now = new Date();
  const currentMonth = now.toISOString().substring(0, 7); // YYYY-MM

  // Filter searches from current month
  const monthSearches = store.searches.filter((s) =>
    s.timestamp.startsWith(currentMonth),
  );

  // Sum up results count (each result counts toward quota)
  const postsConsumed = monthSearches.reduce(
    (sum, s) => sum + s.resultsCount,
    0,
  );

  return {
    postsConsumed,
    monthlyQuota: store.monthlyQuota,
    percentageUsed: (postsConsumed / store.monthlyQuota) * 100,
    searchCount: monthSearches.length,
    remainingQuota: store.monthlyQuota - postsConsumed,
    warningThreshold: store.quotaWarningThreshold,
    criticalThreshold: store.quotaCriticalThreshold,
    isWarning: postsConsumed >= store.monthlyQuota * store.quotaWarningThreshold,
    isCritical:
      postsConsumed >= store.monthlyQuota * store.quotaCriticalThreshold,
  };
}

export function getSearchHistory(limit = 50): SearchRecord[] {
  const store = ensureQuotaFile();
  return store.searches
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export function getSearchStats() {
  const store = ensureQuotaFile();
  const monthUsage = getCurrentMonthUsage();
  const recentSearches = getSearchHistory(10);

  const totalSearches = store.searches.length;
  const automatedSearches = store.searches.filter(
    (s) => s.source === "automated",
  ).length;
  const manualSearches = store.searches.filter(
    (s) => s.source === "manual",
  ).length;

  return {
    monthUsage,
    recentSearches,
    totalSearches,
    automatedSearches,
    manualSearches,
  };
}
