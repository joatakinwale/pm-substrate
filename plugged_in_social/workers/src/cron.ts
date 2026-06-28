/**
 * Stevie Social — Cron Worker
 *
 * Lightweight scheduler that triggers FastAPI endpoints on a schedule.
 * The Worker doesn't do the heavy lifting — it just fires HTTP requests
 * to your origin with a shared secret for auth.
 *
 * Cron schedules are defined in wrangler.toml [env.cron.triggers].
 */

interface Env {
  ORIGIN_URL: string;
  CRON_SECRET: string;
}

// Map cron expressions to FastAPI endpoints
const CRON_JOBS: Record<string, { endpoint: string; description: string }> = {
  "*/15 * * * *": {
    endpoint: "/internal/cron/publish-scheduled-posts",
    description: "Publish blog posts whose scheduled_for has passed",
  },
  "0 * * * *": {
    endpoint: "/internal/cron/sync-analytics",
    description: "Pull latest metrics from Umami into analytics_daily",
  },
  "0 2 * * *": {
    endpoint: "/internal/cron/recompute-engagement",
    description: "Recalculate contact engagement scores from email events",
  },
  "0 3 * * *": {
    endpoint: "/internal/cron/cleanup-media",
    description: "Hard-delete media assets soft-deleted >30 days ago",
  },
  "0 9 * * 1": {
    endpoint: "/internal/cron/weekly-digest",
    description: "Generate weekly metrics summary for the dashboard",
  },
  "0 8 * * *": {
    endpoint: "/internal/cron/proactive-agents",
    description: "Agent-assisted proactive drafting of campaigns and reports",
  },
  "30 * * * *": {
    endpoint: "/internal/cron/booking-reminders",
    description:
      "Send 24h-before reminder emails for upcoming Cal.com bookings",
  },
};

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const job = CRON_JOBS[event.cron];

    if (!job) {
      console.error(`Unknown cron expression: ${event.cron}`);
      return;
    }

    console.log(`[CRON] Running: ${job.description}`);

    const url = `${env.ORIGIN_URL}${job.endpoint}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cron-Secret": env.CRON_SECRET,
          "X-Cron-Expression": event.cron,
          "X-Cron-Scheduled-Time": new Date(event.scheduledTime).toISOString(),
        },
        body: JSON.stringify({
          cron: event.cron,
          scheduled_time: event.scheduledTime,
          description: job.description,
        }),
      });

      if (!response.ok) {
        console.error(
          `[CRON] ${job.endpoint} failed: ${response.status} ${response.statusText}`
        );
        // Cloudflare will retry on next cron tick if needed
        return;
      }

      const result = await response.json();
      console.log(`[CRON] ${job.endpoint} completed:`, result);
    } catch (error) {
      console.error(`[CRON] ${job.endpoint} error:`, error);
    }
  },

  // Also handle HTTP requests for manual trigger via dashboard
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          worker: "stevie-cron",
          jobs: Object.entries(CRON_JOBS).map(([cron, job]) => ({
            cron,
            endpoint: job.endpoint,
            description: job.description,
          })),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Manual trigger: POST /trigger/<job-endpoint>
    if (request.method === "POST" && url.pathname.startsWith("/trigger/")) {
      const secret = request.headers.get("X-Cron-Secret");
      if (secret !== env.CRON_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      const endpoint = url.pathname.replace("/trigger", "");
      const job = Object.values(CRON_JOBS).find((j) => j.endpoint === endpoint);

      if (!job) {
        return new Response("Unknown job", { status: 404 });
      }

      try {
        const response = await fetch(`${env.ORIGIN_URL}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Cron-Secret": env.CRON_SECRET,
            "X-Manual-Trigger": "true",
          },
          body: JSON.stringify({
            manual: true,
            description: job.description,
          }),
        });

        const result = await response.json();
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: String(error) }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
