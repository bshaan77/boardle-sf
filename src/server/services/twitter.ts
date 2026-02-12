import { env } from "~/env";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getCandidates } from "~/server/data/puzzles";

const X_API_BASE = "https://api.x.com/2";

export interface TweetMedia {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
  width?: number;
  height?: number;
}

export interface TweetResult {
  tweetId: string;
  text: string;
  authorId: string;
  authorUsername?: string;
  createdAt: string;
  imageUrls: string[];
  likeCount: number;
  retweetCount: number;
}

export interface BillboardCandidate {
  id: string;
  tweetId: string;
  tweetText: string;
  authorUsername: string;
  imageUrl: string;
  localImagePath: string;
  fetchedAt: string;
  status: "pending" | "approved" | "rejected" | "scheduled";
  score?: number; // Quality score based on engagement and other factors
  likeCount?: number;
  retweetCount?: number;
}

function getHeaders(): Record<string, string> {
  const token = env.X_BEARER_TOKEN;
  if (!token) {
    throw new Error("X_BEARER_TOKEN is not configured");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Calculate a quality score for a billboard candidate
 * Higher score = better quality/more likely to be a good billboard
 */
function scoreTweetCandidate(tweet: TweetResult): number {
  let score = 0;

  // Engagement metrics (weighted)
  score += tweet.likeCount * 0.5;
  score += tweet.retweetCount * 2;

  // Multiple images is good (shows billboard from different angles)
  score += tweet.imageUrls.length * 5;

  // Bonus for tweets with company/brand-related keywords
  const brandKeywords = [
    "company",
    "brand",
    "advertising",
    "campaign",
    "tech",
    "startup",
  ];
  const lowerText = tweet.text.toLowerCase();
  brandKeywords.forEach((keyword) => {
    if (lowerText.includes(keyword)) score += 3;
  });

  // Penalty for very short tweet text (might be spam)
  if (tweet.text.length < 20) score -= 5;

  return Math.max(0, score); // Ensure non-negative
}

export async function searchBillboards(
  query?: string,
  maxResults = 20,
): Promise<TweetResult[]> {
  // Enhanced default query with engagement filter
  const defaultQuery =
    '(billboard OR "out of home" OR OOH OR #SFBillboard) ("San Francisco" OR SF) has:images -is:retweet -is:reply lang:en min_faves:5';
  const searchQuery = query ?? defaultQuery;

  const params = new URLSearchParams({
    query: searchQuery,
    max_results: String(Math.min(maxResults, 100)),
    "tweet.fields": "created_at,public_metrics,author_id",
    expansions: "attachments.media_keys,author_id",
    "media.fields": "url,type,width,height,preview_image_url",
    "user.fields": "username",
  });

  const url = `${X_API_BASE}/tweets/search/recent?${params.toString()}`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      text: string;
      author_id: string;
      created_at: string;
      public_metrics: {
        like_count: number;
        retweet_count: number;
      };
      attachments?: { media_keys?: string[] };
    }>;
    includes?: {
      media?: TweetMedia[];
      users?: Array<{ id: string; username: string }>;
    };
  };

  if (!json.data) return [];

  const mediaMap = new Map<string, TweetMedia>();
  for (const m of json.includes?.media ?? []) {
    mediaMap.set(m.media_key, m);
  }

  const userMap = new Map<string, string>();
  for (const u of json.includes?.users ?? []) {
    userMap.set(u.id, u.username);
  }

  return json.data.map((tweet) => {
    const mediaKeys = tweet.attachments?.media_keys ?? [];
    const imageUrls = mediaKeys
      .map((key) => mediaMap.get(key))
      .filter(
        (m): m is TweetMedia => m?.type === "photo" && !!m.url,
      )
      .map((m) => m.url!);

    return {
      tweetId: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      authorUsername: userMap.get(tweet.author_id),
      createdAt: tweet.created_at,
      imageUrls,
      likeCount: tweet.public_metrics.like_count,
      retweetCount: tweet.public_metrics.retweet_count,
    };
  });
}

export async function downloadImage(
  imageUrl: string,
): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to download image: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  const ext = imageUrl.includes(".png") ? "png" : "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "puzzles");

  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);

  return `/puzzles/${filename}`;
}

export async function searchAndDownload(
  query?: string,
  maxResults = 20,
): Promise<{ candidates: BillboardCandidate[]; duplicatesSkipped: number }> {
  const tweets = await searchBillboards(query, maxResults);
  const candidates: BillboardCandidate[] = [];
  let duplicatesSkipped = 0;

  // Get existing candidates to check for duplicates
  const existingCandidates = getCandidates();
  const existingTweetIds = new Set(existingCandidates.map((c) => c.tweetId));

  for (const tweet of tweets) {
    // Skip if we've already processed this tweet
    if (existingTweetIds.has(tweet.tweetId)) {
      duplicatesSkipped++;
      console.log(`[Duplicate] Skipping tweet ${tweet.tweetId} - already exists`);
      continue;
    }

    const score = scoreTweetCandidate(tweet);

    for (const imageUrl of tweet.imageUrls) {
      const localPath = await downloadImage(imageUrl);
      candidates.push({
        id: randomUUID(),
        tweetId: tweet.tweetId,
        tweetText: tweet.text,
        authorUsername: tweet.authorUsername ?? tweet.authorId,
        imageUrl,
        localImagePath: localPath,
        fetchedAt: new Date().toISOString(),
        status: "pending",
        score,
        likeCount: tweet.likeCount,
        retweetCount: tweet.retweetCount,
      });
    }
  }

  // Sort by score (highest first)
  candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  console.log(
    `[Search] Found ${tweets.length} tweets, created ${candidates.length} candidates, skipped ${duplicatesSkipped} duplicates`,
  );

  return { candidates, duplicatesSkipped };
}
