import { searchAndDownload } from "./twitter";
import { validateBillboardImage } from "./openai-vision";
import { generateNewQueries } from "./claude-query-generator";
import {
  getTopPerformingQueries,
  recordQueryResult,
  addNewQuery,
  pruneUnderperformingQueries,
} from "~/server/data/query-performance";
import { addCandidates, getCandidates } from "~/server/data/puzzles";
import { recordSearch, getCurrentMonthUsage } from "~/server/data/quota";
import type { BillboardCandidate } from "./twitter";

interface SmartSearchResult {
  validBillboardsFound: number;
  totalCandidatesAdded: number;
  queriesRun: number;
  newQueriesGenerated: number;
  quotaUsed: number;
  reachedGoal: boolean;
  totalCostUSD: number;
  stoppedReason: "goal_reached" | "budget_exceeded" | "max_queries" | "quota_critical";
}

const DAILY_GOAL = parseInt(process.env.DAILY_BILLBOARD_GOAL ?? "3");
const MAX_QUERIES_PER_RUN = 20; // Safety limit to prevent runaway API costs
const MAX_DAILY_COST = parseFloat(process.env.MAX_DAILY_AI_COST ?? "1.0"); // $1 default

// Cost estimates per API call (in USD)
const COSTS = {
  OPENAI_VISION_PER_IMAGE: 0.00015, // gpt-4o-mini vision
  CLAUDE_QUERY_GEN: 0.02, // Claude Sonnet 3.5 (approx per generation)
};

export async function runSmartSearch(): Promise<SmartSearchResult> {
  console.log(
    `[Smart Search] Starting... Goal: ${DAILY_GOAL} billboards OR $${MAX_DAILY_COST} budget`,
  );

  let validBillboardsFound = 0;
  let totalCandidatesAdded = 0;
  let queriesRun = 0;
  let newQueriesGenerated = 0;
  let totalCostUSD = 0;
  const startQuota = getCurrentMonthUsage().postsConsumed;

  // Check if we should stop due to quota
  const quotaStatus = getCurrentMonthUsage();
  if (quotaStatus.isCritical) {
    console.error("[Smart Search] ABORTED: Quota critical");
    return {
      validBillboardsFound: 0,
      totalCandidatesAdded: 0,
      queriesRun: 0,
      newQueriesGenerated: 0,
      quotaUsed: 0,
      reachedGoal: false,
      totalCostUSD: 0,
      stoppedReason: "quota_critical",
    };
  }

  // Get existing candidates to check how many valid ones we already have today
  const existingCandidates = getCandidates();
  const today = new Date().toISOString().split("T")[0]!;
  const todaysCandidates = existingCandidates.filter((c) =>
    c.fetchedAt.startsWith(today),
  );

  console.log(`[Smart Search] Already have ${todaysCandidates.length} candidates from today`);

  // Phase 1: Try top-performing queries
  console.log("[Smart Search] Phase 1: Testing top-performing queries");
  const topQueries = getTopPerformingQueries(5);

  for (const queryPerf of topQueries) {
    if (validBillboardsFound >= DAILY_GOAL) break;
    if (queriesRun >= MAX_QUERIES_PER_RUN) break;
    if (totalCostUSD >= MAX_DAILY_COST) {
      console.log(`[Smart Search] Budget limit reached: $${totalCostUSD.toFixed(4)}`);
      break;
    }

    console.log(`[Smart Search] Running query: ${queryPerf.query.substring(0, 60)}...`);

    const result = await searchAndValidateQuery(queryPerf.query);
    queriesRun++;
    validBillboardsFound += result.validCount;
    totalCandidatesAdded += result.candidates.length;
    totalCostUSD += result.costUSD;

    // Record performance
    recordQueryResult(
      queryPerf.query,
      result.validCount,
      result.avgConfidence,
    );

    console.log(
      `[Smart Search] Query result: ${result.validCount} valid, ${result.candidates.length} total (cost: $${result.costUSD.toFixed(4)}, total: $${totalCostUSD.toFixed(4)})`,
    );
  }

  // Phase 2: If goal not reached, generate and try new queries
  let iteration = 0;
  const MAX_ITERATIONS = 3; // Generate new queries up to 3 times

  while (
    validBillboardsFound < DAILY_GOAL &&
    queriesRun < MAX_QUERIES_PER_RUN &&
    totalCostUSD < MAX_DAILY_COST &&
    iteration < MAX_ITERATIONS
  ) {
    iteration++;
    console.log(
      `[Smart Search] Phase 2.${iteration}: Generating new queries (${validBillboardsFound}/${DAILY_GOAL} found, $${totalCostUSD.toFixed(4)} spent)`,
    );

    // Generate new queries with Claude (costs money!)
    const newQueries = await generateNewQueries(5);
    newQueriesGenerated += newQueries.length;
    totalCostUSD += COSTS.CLAUDE_QUERY_GEN;

    console.log(
      `[Smart Search] Generated ${newQueries.length} new queries (cost: $${COSTS.CLAUDE_QUERY_GEN.toFixed(4)})`,
    );

    // Add to tracking
    for (const query of newQueries) {
      addNewQuery(query, "claude-generated");
    }

    // Try each new query
    for (const query of newQueries) {
      if (validBillboardsFound >= DAILY_GOAL) break;
      if (queriesRun >= MAX_QUERIES_PER_RUN) break;
      if (totalCostUSD >= MAX_DAILY_COST) {
        console.log(`[Smart Search] Budget limit reached: $${totalCostUSD.toFixed(4)}`);
        break;
      }

      console.log(`[Smart Search] Testing new query: ${query.substring(0, 60)}...`);

      const result = await searchAndValidateQuery(query);
      queriesRun++;
      validBillboardsFound += result.validCount;
      totalCandidatesAdded += result.candidates.length;
      totalCostUSD += result.costUSD;

      // Record performance
      recordQueryResult(query, result.validCount, result.avgConfidence);

      console.log(
        `[Smart Search] New query result: ${result.validCount} valid, ${result.candidates.length} total (cost: $${result.costUSD.toFixed(4)}, total: $${totalCostUSD.toFixed(4)})`,
      );
    }
  }

  // Prune underperforming queries
  pruneUnderperformingQueries();

  const endQuota = getCurrentMonthUsage().postsConsumed;
  const quotaUsed = endQuota - startQuota;

  const reachedGoal = validBillboardsFound >= DAILY_GOAL;
  const budgetExceeded = totalCostUSD >= MAX_DAILY_COST;

  // Determine why we stopped
  let stoppedReason: SmartSearchResult["stoppedReason"];
  if (reachedGoal) {
    stoppedReason = "goal_reached";
  } else if (budgetExceeded) {
    stoppedReason = "budget_exceeded";
  } else if (queriesRun >= MAX_QUERIES_PER_RUN) {
    stoppedReason = "max_queries";
  } else {
    stoppedReason = "quota_critical";
  }

  console.log(
    `[Smart Search] Complete! Found ${validBillboardsFound}/${DAILY_GOAL} valid billboards ` +
      `(${queriesRun} queries, $${totalCostUSD.toFixed(4)} spent, ${quotaUsed} quota) - ${stoppedReason}`,
  );

  return {
    validBillboardsFound,
    totalCandidatesAdded,
    queriesRun,
    newQueriesGenerated,
    quotaUsed,
    reachedGoal,
    totalCostUSD,
    stoppedReason,
  };
}

async function searchAndValidateQuery(query: string): Promise<{
  candidates: BillboardCandidate[];
  validCount: number;
  avgConfidence: number;
  costUSD: number;
}> {
  try {
    // Search X
    const searchResult = await searchAndDownload(query, 20);

    if (searchResult.candidates.length === 0) {
      return { candidates: [], validCount: 0, avgConfidence: 0, costUSD: 0 };
    }

    // Validate each image with OpenAI (costs money!)
    const validatedCandidates: BillboardCandidate[] = [];
    let totalConfidence = 0;
    let validCount = 0;
    let costUSD = 0;

    for (const candidate of searchResult.candidates) {
      const validation = await validateBillboardImage(candidate.imageUrl);
      costUSD += COSTS.OPENAI_VISION_PER_IMAGE; // Track cost per image

      // Add validation data to candidate
      const enrichedCandidate = {
        ...candidate,
        aiValidation: {
          isValid: validation.isValid,
          confidence: validation.confidence,
          reason: validation.reason,
          details: validation.details,
        },
      };

      // Auto-approve, flag for review, or auto-reject based on confidence
      if (validation.isValid && validation.confidence >= 0.9) {
        enrichedCandidate.status = "approved";
        validCount++;
      } else if (validation.isValid && validation.confidence >= 0.5) {
        enrichedCandidate.status = "pending"; // Manual review
        validCount++;
      } else {
        enrichedCandidate.status = "rejected";
      }

      validatedCandidates.push(enrichedCandidate);
      totalConfidence += validation.confidence;
    }

    const avgConfidence = totalConfidence / searchResult.candidates.length;

    // Add to database
    if (validatedCandidates.length > 0) {
      addCandidates(validatedCandidates);

      // Record in quota system
      recordSearch({
        timestamp: new Date().toISOString(),
        query: query.substring(0, 100),
        resultsCount: 20,
        candidatesAdded: validCount,
        duplicatesSkipped: searchResult.duplicatesSkipped,
        source: "automated",
      });
    }

    return {
      candidates: validatedCandidates,
      validCount,
      avgConfidence,
      costUSD,
    };
  } catch (error) {
    console.error("[Smart Search] Query execution error:", error);
    return { candidates: [], validCount: 0, avgConfidence: 0, costUSD: 0 };
  }
}
