import type { APIRoute } from "astro";
import { getAdminAuth, unauthorizedResponse } from "@/lib/adminAuth";

export const GET: APIRoute = async (context) => {
  const { isAuthorized, adminSecret, backendUrl } = getAdminAuth(context);

  if (!isAuthorized) {
    return unauthorizedResponse();
  }

  try {
    const backendRes = await fetch(`${backendUrl}/admin/stats`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminSecret,
        Authorization: `Bearer ${adminSecret}`,
      },
    });

    if (backendRes.ok) {
      const json = await backendRes.json();
      const payload = json.data || json;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If backend endpoint is not implemented yet or returned an error, return a structured fallback response
    const statusText = backendRes.statusText || `Backend responded with ${backendRes.status}`;
    return new Response(
      JSON.stringify({
        success: false,
        error: `Backend error: ${statusText}`,
        stats: {
          totalUsers: 0,
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          totalCreditsGranted: 0,
          backendConnected: false,
          backendUrl,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to connect to backend server at ${backendUrl}: ${err?.message || "Connection refused"}`,
        stats: {
          totalUsers: 0,
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          totalCreditsGranted: 0,
          backendConnected: false,
          backendUrl,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
};
