import type { APIRoute } from "astro";
import { getAdminAuth, unauthorizedResponse } from "@/lib/adminAuth";

export const GET: APIRoute = async (context) => {
  const { isAuthorized, adminSecret, backendUrl } = getAdminAuth(context);

  if (!isAuthorized) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(context.request.url);
  const userId = searchParams.get("user_id") || "";
  const status = searchParams.get("status") || "";
  const taskType = searchParams.get("task_type") || "";
  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "50";

  const query = new URLSearchParams({
    ...(userId ? { user_id: userId } : {}),
    ...(status ? { status } : {}),
    ...(taskType ? { task_type: taskType } : {}),
    ...(search ? { search } : {}),
    page,
    limit,
  });

  try {
    const backendRes = await fetch(`${backendUrl}/admin/tasks?${query.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminSecret,
        Authorization: `Bearer ${adminSecret}`,
      },
    });

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
        tasks: [],
        total: 0,
      }),
      { status: backendRes.status, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Could not reach backend at ${backendUrl}: ${err?.message || "Connection failed"}`,
        tasks: [],
        total: 0,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const POST: APIRoute = async (context) => {
  const { isAuthorized, adminSecret, backendUrl } = getAdminAuth(context);

  if (!isAuthorized) {
    return unauthorizedResponse();
  }

  try {
    const body = await context.request.json();
    const { action, taskId } = body;

    if (!taskId) {
      return new Response(JSON.stringify({ success: false, error: "Missing taskId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const endpoint = action === "retry" ? `${backendUrl}/admin/tasks/${taskId}/retry` : `${backendUrl}/admin/tasks/${taskId}`;
    const backendRes = await fetch(endpoint, {
      method: action === "delete" ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminSecret,
        Authorization: `Bearer ${adminSecret}`,
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();
    return new Response(JSON.stringify(data), {
      status: backendRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Failed to execute task action" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
