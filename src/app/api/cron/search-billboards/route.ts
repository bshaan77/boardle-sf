import { NextRequest, NextResponse } from "next/server";
import { runScheduledSearch } from "~/server/services/scheduled-search";
import { env } from "~/env";

/**
 * Cron endpoint for automated billboard searches
 * Can be triggered by:
 * 1. Vercel Cron Jobs (configured in vercel.json)
 * 2. Manual API call with proper authentication
 * 3. Any external scheduler service
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization (protect endpoint from unauthorized access)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Vercel Cron sends this header automatically
    const isVercelCron = request.headers.get("x-vercel-cron") === "true";

    // Check if request is authorized
    if (isVercelCron) {
      // Vercel Cron is automatically authorized
      console.log("[Cron API] Request from Vercel Cron");
    } else if (cronSecret) {
      // If CRON_SECRET is set, require it in Authorization header
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      // If no CRON_SECRET and not Vercel Cron, only allow in development
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "CRON_SECRET not configured" },
          { status: 500 },
        );
      }
    }

    // Run the scheduled search
    await runScheduledSearch();

    return NextResponse.json({
      success: true,
      message: "Scheduled search completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Support POST as well (some cron services prefer POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
