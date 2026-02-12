import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { searchAndDownload } from "~/server/services/twitter";
import {
  getTodaysPuzzle,
  getCandidates,
  addCandidates,
  updateCandidateStatus,
  addPuzzle,
  getAllPuzzles,
} from "~/server/data/puzzles";
import { COMPANIES } from "~/server/data/companies";
import { recordSearch, getSearchStats } from "~/server/data/quota";
import { runSmartSearch } from "~/server/services/smart-search";
import { getQueryStats } from "~/server/data/query-performance";

export const billboardRouter = createTRPCRouter({
  // Get today's puzzle (hides the answer)
  getDailyPuzzle: publicProcedure.query(() => {
    const puzzle = getTodaysPuzzle();
    if (!puzzle) {
      return null;
    }
    return {
      id: puzzle.id,
      date: puzzle.date,
      redactedImagePath: puzzle.redactedImagePath,
      hint: puzzle.hint,
      category: puzzle.category,
      authorUsername: puzzle.authorUsername,
    };
  }),

  // Submit a guess for today's puzzle
  submitGuess: publicProcedure
    .input(z.object({ guess: z.string().min(1) }))
    .mutation(({ input }) => {
      const puzzle = getTodaysPuzzle();
      if (!puzzle) {
        return { correct: false, error: "No puzzle today" };
      }
      const correct =
        input.guess.toLowerCase().trim() ===
        puzzle.answer.toLowerCase().trim();
      return {
        correct,
        answer: correct ? puzzle.answer : undefined,
      };
    }),

  // Reveal the answer (called when game is over)
  revealAnswer: publicProcedure.query(() => {
    const puzzle = getTodaysPuzzle();
    if (!puzzle) return null;
    return {
      answer: puzzle.answer,
      originalImagePath: puzzle.originalImagePath,
    };
  }),

  // Get companies list for autocomplete
  getCompanies: publicProcedure.query(() => {
    return COMPANIES;
  }),

  // --- Admin endpoints ---

  // Trigger X API search for billboard images
  searchTwitter: publicProcedure
    .input(
      z
        .object({
          query: z.string().optional(),
          maxResults: z.number().min(1).max(100).optional(),
          source: z.enum(["manual", "automated"]).optional(),
        })
        .optional(),
    )
    .mutation(async ({ input }) => {
      const maxResults = input?.maxResults ?? 20;
      const result = await searchAndDownload(input?.query, maxResults);

      // Record search in quota tracking
      recordSearch({
        timestamp: new Date().toISOString(),
        query: input?.query ?? "default",
        resultsCount: maxResults,
        candidatesAdded: result.candidates.length,
        duplicatesSkipped: result.duplicatesSkipped,
        source: input?.source ?? "manual",
      });

      addCandidates(result.candidates);
      return {
        count: result.candidates.length,
        candidates: result.candidates,
        duplicatesSkipped: result.duplicatesSkipped,
      };
    }),

  // Get all billboard candidates
  getCandidates: publicProcedure.query(() => {
    return getCandidates();
  }),

  // Update candidate status (approve/reject)
  updateCandidate: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["approved", "rejected"]),
      }),
    )
    .mutation(({ input }) => {
      updateCandidateStatus(input.id, input.status);
      return { success: true };
    }),

  // Schedule a puzzle
  schedulePuzzle: publicProcedure
    .input(
      z.object({
        candidateId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        answer: z.string().min(1),
        hint: z.string().min(1),
        category: z.string().min(1),
        redactedImagePath: z.string().min(1),
      }),
    )
    .mutation(({ input }) => {
      const candidates = getCandidates();
      const candidate = candidates.find((c) => c.id === input.candidateId);
      if (!candidate) {
        throw new Error("Candidate not found");
      }

      addPuzzle({
        id: input.candidateId,
        date: input.date,
        originalImagePath: candidate.localImagePath,
        redactedImagePath: input.redactedImagePath,
        answer: input.answer,
        hint: input.hint,
        category: input.category,
        tweetId: candidate.tweetId,
        authorUsername: candidate.authorUsername,
      });

      updateCandidateStatus(input.candidateId, "scheduled");
      return { success: true };
    }),

  // Get all scheduled puzzles
  getAllPuzzles: publicProcedure.query(() => {
    return getAllPuzzles();
  }),

  // Save a redacted image (receives base64 data)
  saveRedactedImage: publicProcedure
    .input(
      z.object({
        imageData: z.string(), // base64 encoded image
        candidateId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const base64Data = input.imageData.replace(
        /^data:image\/\w+;base64,/,
        "",
      );
      const buffer = Buffer.from(base64Data, "base64");
      const filename = `redacted-${input.candidateId}.png`;
      const dir = path.join(process.cwd(), "public", "puzzles");

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), buffer);

      return { path: `/puzzles/${filename}` };
    }),

  // Get quota and search statistics
  getQuotaStats: publicProcedure.query(() => {
    return getSearchStats();
  }),

  // Get query performance statistics
  getQueryStats: publicProcedure.query(() => {
    return getQueryStats();
  }),

  // Run smart search (AI-powered search with goal-seeking)
  runSmartSearch: publicProcedure.mutation(async () => {
    const result = await runSmartSearch();
    return result;
  }),
});
