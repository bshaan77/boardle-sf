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
}

const DAILY_GOAL = parseInt(process.env.DAILY_BILLBOARD_GOAL ?? "3");
const MAX_QUERIES_PER_RUN = 20; // Safety limit to prevent runaway API costs

export async function runSmartSearch(): Promise<SmartSearchResult> {
  console.log(`[Smart Search] Starting... Daily goal: ${DAILY_GOAL} valid billboards`);

  let validBillboardsFound = 0;
  let totalCandidatesAdded = 0;
  let queriesRun = 0;
  let newQueriesGenerated = 0;
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

    console.log(`[Smart Search] Running query: ${queryPerf.query.substring(0, 60)}...`);

    const result = await searchAndValidateQuery(queryPerf.query);
    queriesRun++;
    validBillboardsFound += result.validCount;
    totalCandidatesAdded += result.candidates.length;

    // Record performance
    recordQueryResult(
      queryPerf.query,
      result.validCount,
      result.avgConfidence,
    );

    console.log(
      `[Smart Search] Query result: ${result.validCount} valid, ${result.candidates.length} total candidates`,
    );
  }

  // Phase 2: If goal not reached, generate and try new queries
  let iteration = 0;
  const MAX_ITERATIONS = 3; // Generate new queries up to 3 times

  while (
    validBillboardsFound < DAILY_GOAL &&
    queriesRun < MAX_QUERIES_PER_RUN &&
    iteration < MAX_ITERATIONS
  ) {
    iteration++;
    console.log(
      `[Smart Search] Phase 2.${iteration}: Generating new queries (${validBillboardsFound}/${DAILY_GOAL} found so far)`,
    );

    // Generate new queries with Claude
    const newQueries = await generateNewQueries(5);
    newQueriesGenerated += newQueries.length;

    // Add to tracking
    for (const query of newQueries) {
      addNewQuery(query, "claude-generated");
    }

    // Try each new query
    for (const query of newQueries) {
      if (validBillboardsFound >= DAILY_GOAL) break;
      if (queriesRun >= MAX_QUERIES_PER_RUN) break;

      console.log(`[Smart Search] Testing new query: ${query.substring(0, 60)}...`);

      const result = await searchAndValidateQuery(query);
      queriesRun++;
      validBillboardsFound += result.validCount;
      totalCandidatesAdded += result.candidates.length;

      // Record performance
      recordQueryResult(query, result.validCount, result.avgConfidence);

      console.log(
        `[Smart Search] New query result: ${result.validCount} valid, ${result.candidates.length} total candidates`,
      );
    }
  }

  // Prune underperforming queries
  pruneUnderperformingQueries();

  const endQuota = getCurrentMonthUsage().postsConsumed;
  const quotaUsed = endQuota - startQuota;

  const reachedGoal = validBillboardsFound >= DAILY_GOAL;

  console.log(
    `[Smart Search] Complete! Found ${validBillboardsFound}/${DAILY_GOAL} valid billboards (${queriesRun} queries, ${quotaUsed} quota used)`,
  );

  return {
    validBillboardsFound,
    totalCandidatesAdded,
    queriesRun,
    newQueriesGenerated,
    quotaUsed,
    reachedGoal,
  };
}

async function searchAndValidateQuery(query: string): Promise<{
  candidates: BillboardCandidate[];
  validCount: number;
  avgConfidence: number;
}> {
  try {
    // Search X
    const searchResult = await searchAndDownload(query, 20);

    if (searchResult.candidates.length === 0) {
      return { candidates: [], validCount: 0, avgConfidence: 0 };
    }

    // Validate each image with OpenAI
    const validatedCandidates: BillboardCandidate[] = [];
    let totalConfidence = 0;
    let validCount = 0;

    for (const candidate of searchResult.candidates) {
      const validation = await validateBillboardImage(candidate.imageUrl);

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
    };
  } catch (error) {
    console.error("[Smart Search] Query execution error:", error);
    return { candidates: [], validCount: 0, avgConfidence: 0 };
  }
}
