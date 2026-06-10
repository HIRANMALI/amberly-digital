import type { APIRoute } from "astro";
import { deleteIp, getAllTrackedIps, getGlobalScanCount } from "../verify-domain";

function getAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }
  try {
    const base64Credentials = authHeader.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    const [username, password] = credentials.split(":");
    const adminSecret = import.meta.env.ADMIN_SECRET || process.env.ADMIN_SECRET || "amberly_admin_2026";
    return username === "admin" && password === adminSecret;
  } catch {
    return false;
  }
}

function getUnauthorizedResponse() {
  return new Response(
    JSON.stringify({ success: false, error: "Unauthorized access." }),
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin Rate Limits", charset="UTF-8"',
        "Content-Type": "application/json"
      }
    }
  );
}

export const GET: APIRoute = async ({ request, url }) => {
  const logResponse = (payload: any, status: number = 200) => {
    console.log(`[API Response /api/admin/rate-limits GET] Status: ${status} | Payload:`, JSON.stringify(payload, null, 2));
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    if (!getAuthorized(request)) {
      return getUnauthorizedResponse();
    }

    const action = url.searchParams.get("action");
    const targetIp = url.searchParams.get("ip");

    console.log(`[API Request /api/admin/rate-limits GET] action: "${action}" | targetIp: "${targetIp}"`);

    // 2. Action Handlers: Reset Specific IP
    if (action === "reset" && targetIp) {
      const deleted = await deleteIp(targetIp);
      if (deleted) {
        return logResponse({
          success: true,
          message: `Successfully reset rate limit count to 0 for IP: ${targetIp}`
        }, 200);
      } else {
        return logResponse({
          success: false,
          error: `IP address ${targetIp} was not found in the active cache.`
        }, 404);
      }
    }

    // 3. Get Listing of Active IPs
    const limitList = await getAllTrackedIps();
    const totalScansOverall = await getGlobalScanCount();

    return logResponse({
      success: true,
      totalTrackedIps: limitList.length,
      totalScansOverall,
      rateLimits: limitList
    }, 200);
  } catch (err: any) {
    console.error("Admin rate limits view error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred while managing rate limits." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const logResponse = (payload: any, status: number = 200) => {
    console.log(`[API Response /api/admin/rate-limits POST] Status: ${status} | Payload:`, JSON.stringify(payload, null, 2));
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    if (!getAuthorized(request)) {
      return getUnauthorizedResponse();
    }

    const { action, ip: targetIp } = await request.json();

    console.log(`[API Request /api/admin/rate-limits POST] action: "${action}" | targetIp: "${targetIp}"`);

    // 2. Action Handler: Reset Specific IP
    if (action === "reset" && targetIp) {
      const deleted = await deleteIp(targetIp);
      if (deleted) {
        return logResponse({
          success: true,
          message: `Successfully reset rate limit count to 0 for IP: ${targetIp}`
        }, 200);
      } else {
        return logResponse({
          success: false,
          error: `IP address ${targetIp} was not found in the active cache.`
        }, 404);
      }
    }

    return logResponse({ success: false, error: "Invalid POST action requested." }, 400);
  } catch (err: any) {
    console.error("Admin rate limits action error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred while executing rate limit operation." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
