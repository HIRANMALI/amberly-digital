import type { APIRoute } from "astro";
import { getAdminAuth, unauthorizedResponse } from "@/lib/adminAuth";

export const GET: APIRoute = async (context) => {
  const { isAuthorized, adminSecret, backendUrl } = getAdminAuth(context);

  if (!isAuthorized) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(context.request.url);
  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "50";

  try {
    const backendRes = await fetch(
      `${backendUrl}/admin/users?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminSecret,
          Authorization: `Bearer ${adminSecret}`,
        },
      }
    );

    if (backendRes.ok) {
      const data = await backendRes.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: `Backend error: ${backendRes.statusText}`,
        users: [],
        total: 0,
      }),
      { status: backendRes.status, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Could not reach backend at ${backendUrl}: ${err?.message || "Connection failed"}`,
        users: [],
        total: 0,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};
