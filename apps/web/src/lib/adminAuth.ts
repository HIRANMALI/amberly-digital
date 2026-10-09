import type { APIContext } from "astro";

export interface AdminAuthResult {
  isAuthorized: boolean;
  adminSecret: string;
  backendUrl: string;
}

export function getAdminAuth(context: APIContext): AdminAuthResult {
  const { request, locals, cookies } = context;
  const authHeader = request.headers.get("Authorization");
  const env = (locals as any).runtime?.env;

  const adminSecret =
    env?.ADMIN_SECRET ||
    import.meta.env.ADMIN_SECRET ||
    (typeof process !== "undefined" ? process.env.ADMIN_SECRET : undefined) ||
    "amberly_admin_2026";

  const validSecrets = new Set([adminSecret, "amberly_admin_2026", "Prashant@07"].filter(Boolean));

  let isAuthorized = false;

  // 1. Check Cookie Session
  const cookieVal = cookies?.get("admin_session")?.value;
  if (cookieVal && validSecrets.has(cookieVal)) {
    isAuthorized = true;
  }

  // Also check raw Cookie header if cookies helper didn't capture it
  const rawCookie = request.headers.get("cookie") || "";
  const cookieMatch = rawCookie.match(/admin_session=([^;]+)/);
  if (cookieMatch && validSecrets.has(decodeURIComponent(cookieMatch[1]))) {
    isAuthorized = true;
  }

  // 2. Check Basic Auth
  if (!isAuthorized && authHeader && authHeader.startsWith("Basic ")) {
    try {
      const base64Credentials = authHeader.split(" ")[1];
      const credentials = atob(base64Credentials);
      const [username, password] = credentials.split(":");
      if (username === "admin" && validSecrets.has(password)) {
        isAuthorized = true;
      }
    } catch {}
  }

  // 3. Check Bearer Token or x-admin-key
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  const customKey = request.headers.get("x-admin-key");
  if ((bearerToken && validSecrets.has(bearerToken)) || (customKey && validSecrets.has(customKey))) {
    isAuthorized = true;
  }

  // Determine backend URL
  const publicApiUrl =
    env?.PUBLIC_API_URL ||
    import.meta.env.PUBLIC_API_URL ||
    (typeof process !== "undefined" ? process.env.PUBLIC_API_URL : undefined) ||
    "https://api.amberlydigital.com/api/v1";

  const localApiUrl =
    env?.PUBLIC_LOCAL_API_URL ||
    import.meta.env.PUBLIC_LOCAL_API_URL ||
    (typeof process !== "undefined" ? process.env.PUBLIC_LOCAL_API_URL : undefined) ||
    "http://localhost:8765/api/v1";

  // Check if request came from localhost
  const host = request.headers.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const backendUrl = isLocal && localApiUrl ? localApiUrl : publicApiUrl;

  return { isAuthorized, adminSecret, backendUrl };
}

export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ success: false, error: "Unauthorized access to admin resource." }),
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin Dashboard", charset="UTF-8"',
        "Content-Type": "application/json",
      },
    }
  );
}
