import type { APIRoute } from "astro";
import { getAdminAuth, unauthorizedResponse } from "@/lib/adminAuth";

export const POST: APIRoute = async (context) => {
  const { isAuthorized, adminSecret, backendUrl } = getAdminAuth(context);

  if (!isAuthorized) {
    return unauthorizedResponse();
  }

  try {
    const body = await context.request.json();
    const { userId, amount, action, reason } = body;

    if (!userId || amount === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: "userId and amount are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const backendRes = await fetch(`${backendUrl}/admin/users/${userId}/credits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminSecret,
        Authorization: `Bearer ${adminSecret}`,
      },
      body: JSON.stringify({
        amount: Number(amount),
        action: action || "add", // 'add', 'deduct', 'set'
        reason: reason || "Admin manual adjustment",
      }),
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const errData = await backendRes.json().catch(() => ({}));
    return new Response(
      JSON.stringify({
        success: false,
        error: errData.detail || errData.error || `Backend returned error ${backendRes.status}`,
      }),
      { status: backendRes.status, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Failed to update credits" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
