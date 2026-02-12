import Anthropic from "@anthropic-ai/sdk";
import { getAllQueries, getTopPerformingQueries } from "~/server/data/query-performance";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateNewQueries(count = 5): Promise<string[]> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("[Claude] API key not configured, returning fallback queries");
      return [
        'billboard SF has:images -is:retweet',
        '"San Francisco" (billboard OR advertisement) has:images',
        '(tech OR startup) billboard "San Francisco" has:images',
      ];
    }

    const topQueries = getTopPerformingQueries(5);
    const allQueries = getAllQueries();

    const successfulQueries = topQueries
      .filter((q) => q.validBillboardsFound > 0)
      .map((q) => `"${q.query}" (${q.validBillboardsFound} found, ${(q.successRate * 100).toFixed(0)}% success)`)
      .join("\n");

    const failedQueries = allQueries
      .filter((q) => q.totalAttempts > 0 && q.validBillboardsFound === 0)
      .slice(0, 5)
      .map((q) => `"${q.query}" (0 found after ${q.totalAttempts} attempts)`)
      .join("\n");

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a search query optimization AI for finding SF tech company billboards on X (Twitter).

## Current Situation
We're searching X for posts with photos of real physical billboards in San Francisco. We need to find 3 valid billboards per day.

## What Works (Successful Queries):
${successfulQueries || "No successful queries yet"}

## What Doesn't Work (Failed Queries):
${failedQueries || "No failed queries yet"}

## X API Constraints:
- Pay-as-you-go tier (no min_faves, min_retweets, filter:verified)
- Can use: has:images, -is:retweet, -is:reply, from:username, OR, AND, quotes, -url
- 7-day search window only

## Patterns That Work Well:
- Companies/founders announcing their billboards ("just dropped", "our billboard", "launched")
- Specific company names + billboard
- SF location mentions (South Park, Mission, SOMA, Highway 101)
- Tech/startup context

## Generate ${count} NEW Search Queries:
- Different from existing queries
- Focus on patterns similar to successful ones
- Avoid patterns from failed queries
- Be creative - try new angles (specific neighborhoods, events, company types)
- Keep queries concise and focused

Respond with ONLY a JSON array of query strings, no explanation:
["query1", "query2", "query3", ...]`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Parse JSON response
    const queries = JSON.parse(content.text) as string[];

    console.log(`[Claude] Generated ${queries.length} new queries`);
    return queries;
  } catch (error) {
    console.error("[Claude] Query generation error:", error);
    // Return fallback queries on error
    return [
      '("dropped" OR "launched") billboard SF has:images',
      '(tech OR startup OR YC) "San Francisco" billboard has:images',
      '"our billboard" (SF OR "San Francisco") has:images',
    ];
  }
}

export async function analyzeQueryPerformance(): Promise<{
  insights: string;
  recommendations: string[];
}> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        insights: "Claude API key not configured",
        recommendations: ["Configure ANTHROPIC_API_KEY to enable query optimization"],
      };
    }

    const topQueries = getTopPerformingQueries(10);
    const allQueries = getAllQueries();

    const summary = topQueries
      .map(
        (q) =>
          `Query: "${q.query}"\nAttempts: ${q.totalAttempts}, Found: ${q.validBillboardsFound}, Success Rate: ${(q.successRate * 100).toFixed(1)}%, Avg Confidence: ${q.avgConfidence.toFixed(2)}`,
      )
      .join("\n\n");

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Analyze these X search query results for finding SF billboards:

${summary}

Total queries tested: ${allQueries.length}

Provide insights and recommendations in JSON format:
{
  "insights": "1-2 sentence summary of what's working and what's not",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return JSON.parse(content.text);
  } catch (error) {
    console.error("[Claude] Analysis error:", error);
    return {
      insights: "Unable to analyze query performance",
      recommendations: ["Continue testing current queries"],
    };
  }
}
