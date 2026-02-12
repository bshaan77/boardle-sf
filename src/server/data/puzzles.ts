import fs from "fs";
import path from "path";

export interface Puzzle {
  id: string;
  date: string; // YYYY-MM-DD — the day this puzzle goes live
  originalImagePath: string; // path to original billboard image
  redactedImagePath: string; // path to redacted version
  answer: string; // company name (display casing)
  hint: string;
  category: string;
  tweetId?: string;
  authorUsername?: string;
}

export interface CandidateImage {
  id: string;
  tweetId: string;
  tweetText: string;
  authorUsername: string;
  imageUrl: string;
  localImagePath: string;
  fetchedAt: string;
  status: "pending" | "approved" | "rejected" | "scheduled";
  score?: number; // Quality score based on engagement
  likeCount?: number;
  retweetCount?: number;
  aiValidation?: {
    isValid: boolean;
    confidence: number;
    reason: string;
    details: {
      isPhysicalBillboard: boolean;
      isInSanFrancisco: boolean;
      hasCompanyBranding: boolean;
      imageQuality: "high" | "medium" | "low";
    };
  };
}

interface PuzzleStore {
  puzzles: Puzzle[];
  candidates: CandidateImage[];
}

const DATA_PATH = path.join(process.cwd(), "data", "puzzles.json");

function ensureDataFile(): PuzzleStore {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_PATH)) {
    const initial: PuzzleStore = { puzzles: [], candidates: [] };
    fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8")) as PuzzleStore;
}

function saveStore(store: PuzzleStore): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
}

export function getAllPuzzles(): Puzzle[] {
  return ensureDataFile().puzzles;
}

export function getTodaysPuzzle(): Puzzle | null {
  const today = new Date().toISOString().split("T")[0]!;
  const store = ensureDataFile();
  return store.puzzles.find((p) => p.date === today) ?? null;
}

export function getPuzzleByDate(date: string): Puzzle | null {
  const store = ensureDataFile();
  return store.puzzles.find((p) => p.date === date) ?? null;
}

export function addPuzzle(puzzle: Puzzle): void {
  const store = ensureDataFile();
  store.puzzles.push(puzzle);
  saveStore(store);
}

export function getCandidates(): CandidateImage[] {
  return ensureDataFile().candidates;
}

export function addCandidates(candidates: CandidateImage[]): void {
  const store = ensureDataFile();
  store.candidates.push(...candidates);
  saveStore(store);
}

export function updateCandidateStatus(
  id: string,
  status: CandidateImage["status"],
): void {
  const store = ensureDataFile();
  const candidate = store.candidates.find((c) => c.id === id);
  if (candidate) {
    candidate.status = status;
    saveStore(store);
  }
}
