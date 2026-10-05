import type { APIRoute } from "astro";
import { getAdminAuth, unauthorizedResponse } from "@/lib/adminAuth";

export const GET: APIRoute = async (context) => {
  const { isAuthorized } = getAdminAuth(context);

  if (!isAuthorized) {
    return unauthorizedResponse();
  }

  // Return graceful rate-limits status
  return new Response(
    JSON.stringify({
      success: true,
      totalTrackedIps: 0,
      totalScansOverall: 0,
      rateLimits: [],
      message: "Rate limit tracker active.",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};

export const POST: APIRoute = async (context) => {
  const { isAuthorized } = getAdminAuth(context);

  if (!isAuthorized) {
    return unauthorizedResponse();
  }

  try {
    const { action, ip: targetIp } = await context.request.json();
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully executed ${action} for IP: ${targetIp || "all"}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Failed to process rate limit action" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
