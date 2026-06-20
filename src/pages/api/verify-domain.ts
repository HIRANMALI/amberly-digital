import type { APIRoute } from "astro";

// Global in-memory rate limiting map fallback
export const ipCache = new Map<string, number[]>();

const LIMIT_PER_WEEK = 5;
const REDIS_PREFIX = "limit:ip:";
const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds
const ONE_WEEK_MS = ONE_WEEK_SECONDS * 1000;

function getEnv(key: string, env?: any): string | undefined {
  if (env && env[key]) return env[key];
  if (import.meta.env && import.meta.env[key]) return import.meta.env[key];
  if (typeof process !== "undefined" && process.env && process.env[key]) return process.env[key];
  return undefined;
}

async function upstashCommand(command: any[], env?: any): Promise<any> {
  const url = getEnv("UPSTASH_REDIS_REST_URL", env);
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN", env);

  if (!url || !token) {
    return null;
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      console.warn(`Upstash API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    if (data.error) {
      console.warn(`Upstash execution error: ${data.error}`);
      return null;
    }

    return data.result;
  } catch (err) {
    console.error("Upstash connection error:", err);
    return null;
  }
}

export async function getTimestamps(ip: string, env?: any): Promise<number[]> {
  const url = getEnv("UPSTASH_REDIS_REST_URL", env);
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN", env);

  if (!url || !token) {
    return ipCache.get(ip) || [];
  }

  const result = await upstashCommand(["GET", `${REDIS_PREFIX}${ip}`], env);
  if (result === null) {
    return [];
  }

  try {
    return typeof result === "string" ? JSON.parse(result) : [];
  } catch {
    return [];
  }
}

export async function setTimestamps(ip: string, timestamps: number[], env?: any): Promise<void> {
  const url = getEnv("UPSTASH_REDIS_REST_URL", env);
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN", env);

  if (!url || !token) {
    ipCache.set(ip, timestamps);
    return;
  }

  await upstashCommand([
    "SET",
    `${REDIS_PREFIX}${ip}`,
    JSON.stringify(timestamps),
    "EX",
    ONE_WEEK_SECONDS
  ], env);
}

export async function deleteIp(ip: string, env?: any): Promise<boolean> {
  const url = getEnv("UPSTASH_REDIS_REST_URL", env);
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN", env);

  if (!url || !token) {
    if (ipCache.has(ip)) {
      ipCache.delete(ip);
      return true;
    }
    return false;
  }

  const deletedCount = await upstashCommand(["DEL", `${REDIS_PREFIX}${ip}`], env);
  // DEL returns the number of keys removed. If it returns a number (0 or 1), the command succeeded and the key is now absent.
  return typeof deletedCount === "number";
}

export async function getAllTrackedIps(env?: any): Promise<Array<{
  ip: string;
  scanCount: number;
  lastScanTime: string | null;
  allScansThisWeek: string[];
}>> {
  const url = getEnv("UPSTASH_REDIS_REST_URL", env);
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN", env);
  const now = Date.now();

  if (!url || !token) {
    const limitList: any[] = [];
    for (const [ip, timestamps] of ipCache.entries()) {
      const activeTimestamps = timestamps.filter((ts) => now - ts < ONE_WEEK_MS);
      limitList.push({
        ip,
        scanCount: activeTimestamps.length,
        lastScanTime: activeTimestamps.length > 0 ? new Date(activeTimestamps[activeTimestamps.length - 1]).toISOString() : null,
        allScansThisWeek: activeTimestamps.map(ts => new Date(ts).toISOString())
      });
    }
    return limitList;
  }

  const keys: string[] = await upstashCommand(["KEYS", `${REDIS_PREFIX}*`], env) || [];
  if (keys.length === 0) return [];

  const values: Array<string | null> = await upstashCommand(["MGET", ...keys], env) || [];
  const limitList: any[] = [];

  for (let i = 0; i < keys.length; i++) {
    const rawIp = keys[i].substring(REDIS_PREFIX.length);
    const rawVal = values[i];
    let timestamps: number[] = [];
    try {
      timestamps = rawVal ? JSON.parse(rawVal) : [];
    } catch {}

    const activeTimestamps = timestamps.filter((ts) => now - ts < ONE_WEEK_MS);
    if (activeTimestamps.length > 0) {
      limitList.push({
        ip: rawIp,
        scanCount: activeTimestamps.length,
        lastScanTime: new Date(activeTimestamps[activeTimestamps.length - 1]).toISOString(),
        allScansThisWeek: activeTimestamps.map(ts => new Date(ts).toISOString())
      });
    }
  }

  return limitList;
}

async function isRateLimited(ip: string, env?: any): Promise<{ limited: boolean; count: number }> {
  const now = Date.now();
  let timestamps = await getTimestamps(ip, env);

  // Filter out timestamps older than 1 week
  timestamps = timestamps.filter((ts) => now - ts < ONE_WEEK_MS);
  await setTimestamps(ip, timestamps, env); // clean up old timestamps on check

  return { limited: timestamps.length >= LIMIT_PER_WEEK, count: timestamps.length };
}

async function consumeCredit(ip: string, env?: any): Promise<void> {
  const now = Date.now();
  let timestamps = await getTimestamps(ip, env);
  timestamps = timestamps.filter((ts) => now - ts < ONE_WEEK_MS);
  timestamps.push(now);
  await setTimestamps(ip, timestamps, env);
}

let globalScanCountFallback = 0;

export async function incrementGlobalScanCount(env?: any): Promise<void> {
  const url = getEnv("UPSTASH_REDIS_REST_URL", env);
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN", env);

  if (!url || !token) {
    globalScanCountFallback++;
    return;
  }

  await upstashCommand(["INCR", "global:total_scans"], env);
}

export async function getGlobalScanCount(env?: any): Promise<number> {
  const url = getEnv("UPSTASH_REDIS_REST_URL", env);
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN", env);

  if (!url || !token) {
    return globalScanCountFallback;
  }

  const result = await upstashCommand(["GET", "global:total_scans"], env);
  if (result === null) {
    return 0;
  }
  const parsed = parseInt(result, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function cleanDomain(input: string): string {
  let cleaned = input.trim().toLowerCase();
  // Remove protocol and www
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, "");
  // Remove path, query string, port, etc.
  cleaned = cleaned.split("/")[0];
  cleaned = cleaned.split("?")[0];
  cleaned = cleaned.split(":")[0];
  return cleaned;
}

async function lookupDns(hostname: string): Promise<boolean> {
  // PERF_OPT: Race Cloudflare DNS and Google DoH simultaneously — fastest wins
  const cfLookup = fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
    headers: { accept: "application/dns-json" },
  })
    .then(async (r) => { const d: any = await r.json(); return d.Status === 0; })
    .catch(() => false);

  const googleLookup = fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`)
    .then(async (r) => { const d: any = await r.json(); return d.Status === 0; })
    .catch(() => false);

  // Whichever resolves to `true` first wins; if both fail, return false
  return Promise.race([
    cfLookup.then((ok) => ok ? true : new Promise<boolean>((res) => googleLookup.then(res))),
    googleLookup.then((ok) => ok ? true : new Promise<boolean>((res) => cfLookup.then(res))),
  ]).catch(() => false);
}

async function fetchWebsiteHtml(domain: string): Promise<{ success: boolean; html: string }> {
  // PERF_OPT: Race https and http simultaneously — fastest successful response wins
  const makeRequest = async (protocol: string): Promise<{ success: boolean; html: string }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s hard timeout per attempt
    try {
      const response = await fetch(`${protocol}${domain}`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      clearTimeout(timeoutId);
      if (response.ok || (response.status >= 200 && response.status < 400)) {
        const html = await response.text();
        if (html && html.trim().length > 150) {
          return { success: true, html };
        }
      }
      return { success: false, html: "" };
    } catch {
      clearTimeout(timeoutId);
      return { success: false, html: "" };
    }
  };

  // Fire both https and http at the same time and take the first successful result
  const [httpsResult, httpResult] = await Promise.all([
    makeRequest("https://"),
    makeRequest("http://"),
  ]);

  return httpsResult.success ? httpsResult : httpResult;
}

function extractMetadata(html: string): { title: string; description: string; hasSchema: boolean } {
  let title = "";
  let description = "";

  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }

  // Extract description meta tag
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
  if (descMatch && descMatch[1]) {
    description = descMatch[1].trim();
  }

  // Check for JSON-LD schema blocks or schema.org references in the HTML body
  const hasSchema = html.includes('type="application/ld+json"') || 
                    html.includes("type='application/ld+json'") ||
                    html.includes("schema.org");

  return { title, description, hasSchema };
}

function getPersonalizedAuditFallback(
  businessName: string, 
  domain: string,
  siteTitle: string = "",
  siteDescription: string = "",
  hasSchema: boolean = false
): {
  status: "low" | "high" | "pass";
  headline: string;
  seoAudit: string;
  aeoAudit: string;
} {
  const biz = businessName || "Your Business";
  
  // Check if it's a known top-tier domain
  const topTierDomains = ["amazon.in", "amazon.com", "apple.com", "google.com", "microsoft.com", "github.com", "wikipedia.org", "netflix.com", "youtube.com"];
  const isTopTier = topTierDomains.some((d) => domain.includes(d));

  if (isTopTier) {
    return {
      status: "pass",
      headline: `📍 ${biz} (${domain}) has exceptional search & AI visibility`,
      seoAudit: `Auditing ${domain} shows industry-leading structured schema markup, stellar page rendering speed, and comprehensive SEO optimization.`,
      aeoAudit: `Voice search agents and LLM recommendation engines can seamlessly identify and recommend your services based on rich Answer Engine optimization.`
    };
  }

  const isHigh = Math.random() > 0.5;
  
  // Extract niche keywords from business name, domain, title and description
  const textToScan = `${biz} ${domain} ${siteTitle} ${siteDescription}`.toLowerCase();
  let niche = "your industry";
  if (textToScan.includes("upsc") || textToScan.includes("prep") || textToScan.includes("educat") || textToScan.includes("exam") || textToScan.includes("student") || textToScan.includes("coach") || textToScan.includes("tutor") || textToScan.includes("class")) {
    niche = "educational & exam preparation services";
  } else if (textToScan.includes("plumb") || textToScan.includes("drain") || textToScan.includes("pipe") || textToScan.includes("water")) {
    niche = "emergency plumbing & home services";
  } else if (textToScan.includes("law") || textToScan.includes("legal") || textToScan.includes("solicitor")) {
    niche = "professional legal services";
  } else if (textToScan.includes("tech") || textToScan.includes("consulting") || textToScan.includes("digital") || textToScan.includes("software") || textToScan.includes("dev") || textToScan.includes("agency")) {
    niche = "digital tech & professional services";
  } else if (textToScan.includes("dent") || textToScan.includes("med") || textToScan.includes("health") || textToScan.includes("clinic")) {
    niche = "healthcare & medical services";
  } else if (textToScan.includes("build") || textToScan.includes("construct") || textToScan.includes("roof") || textToScan.includes("electric")) {
    niche = "trades & construction services";
  }

  // If the site already has schema, don't generate a "lacks schema" warning in fallback
  if (hasSchema) {
    return {
      status: "low",
      headline: `📍 ${biz} (${domain}) has mobile speed & structured conversion leaks`,
      seoAudit: `Auditing ${domain} shows slow cellular viewport loading hooks. Potential customers looking for ${niche} may bounce to faster competitors.`,
      aeoAudit: `While some structured schema markup was detected, it is not fully optimized for direct AI recommendations.`
    };
  }

  if (isHigh) {
    return {
      status: "high",
      headline: `📍 ${biz} (${domain}) lacks AI assistant search compatibility`,
      seoAudit: `Your domain ${domain} has baseline visibility but could be improved for competitive queries in the ${niche} space.`,
      aeoAudit: `Your website lacks key JSON-LD schemas required by modern search agents. Siri, ChatGPT, and Perplexity cannot easily verify and recommend ${biz}.`
    };
  } else {
    return {
      status: "low",
      headline: `📍 ${biz} (${domain}) has mobile speed & structured conversion leaks`,
      seoAudit: `Auditing ${domain} shows missing fast-loading cellular viewport hooks. This causes potential customers looking for ${niche} to bounce to faster competitors.`,
      aeoAudit: `The site is completely lacking Answer Engine schema markups, making it invisible to generative AI recommendation engines.`
    };
  }
}

// Robustly parse Gemini audit output — handles markdown fences, unquoted keys, single quotes,
// and falls back to regex-based field extraction if JSON.parse still fails
function safeParseAudit(raw: string): { status: string; headline: string; seoAudit: string; aeoAudit: string } | null {
  let text = raw.trim();

  // Step 1: Strip markdown fences
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  // Step 2: Isolate the first { ... } block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  // Step 3: Try clean JSON.parse first
  try {
    return JSON.parse(text);
  } catch {}

  // Step 4: Fix common issues — unquoted keys, single-quoted strings, trailing commas
  try {
    const fixed = text
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // quote unquoted keys
      .replace(/:\s*'([^']*)'/g, ': "$1"')                             // single → double quotes on values
      .replace(/,\s*([}\]])/g, "$1");                                  // strip trailing commas
    return JSON.parse(fixed);
  } catch {}

  // Step 5: Last resort — extract fields individually via regex
  const extract = (key: string): string => {
    const m = raw.match(new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`, "i"));
    return m?.[1]?.trim() ?? "";
  };

  const status = extract("status");
  const headline = extract("headline");
  const seoAudit = extract("seoAudit");
  const aeoAudit = extract("aeoAudit");

  if (headline || seoAudit || aeoAudit) {
    return { status, headline, seoAudit, aeoAudit };
  }

  return null; // complete failure
}


async function callGeminiApi(prompt: string, apiKey: string): Promise<string> {
  const GEMINI_TIMEOUT_MS = 20000; // 20s — Gemini flash can take up to 15s on first token

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024
        }
      })
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const data: any = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty text returned from Gemini API");
    console.log("[Gemini RAW OUTPUT]:", JSON.stringify(text));
    return text;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function generateAIAuditWithFallback(
  businessName: string, 
  domain: string,
  siteTitle: string,
  siteDescription: string,
  hasSchema: boolean,
  env?: any
): Promise<{
  status: "low" | "high" | "pass";
  headline: string;
  seoAudit: string;
  aeoAudit: string;
}> {
  const keys = [
    getEnv("GEMINI_API_KEY", env),
    getEnv("GEMINI_API_KEY_FALLBACK", env),
    getEnv("GEMINI_API_KEY_FALLBACK_2", env)
  ].filter(Boolean) as string[];

  const biz = businessName || "Your Business";

  if (keys.length === 0) {
    return getPersonalizedAuditFallback(biz, domain, siteTitle, siteDescription, hasSchema);
  }

  const prompt = `You are a professional local search SEO and Answer Engine Optimization (AEO) expert at Amberly Digital agency.
Generate an honest, objective, and constructive website audit message for:
- Business Name: "${biz}"
- Domain: "${domain}"
- Live Website Title: "${siteTitle}"
- Live Website Meta Description: "${siteDescription}"
- Detected JSON-LD Schema on Website: ${hasSchema ? "Yes" : "No"}

Important Context: Use the Live Website Title and Meta Description to identify their exact business niche (e.g. if the title is about UPSC prep or tutoring, they are in educational services; if it is a dental clinic, they are in healthcare, etc.). Make sure the audit refers to their actual niche/services correctly.

Tone Guideline: Write in an authentic, credible, and supportive tone. Do not use hyperbolic marketing jargon, fake alarmism, or aggressive roasting. Provide a factual diagnosis that builds trust through honesty.

Choose one of these three audit statuses based on the website's digital presence, complexity, and reputation:
1. "low" (Essential Upgrades): For websites with issues like poor viewport setup, slow response, conversion blockages, or outdated designs.
2. "high" (Growth Opportunities): For websites that are decent but missing AI search compatibility, missing JSON-LD schema metadata (only choose this if Detected JSON-LD Schema is 'No'), or lacking voice-search groundings. If the site already has schema, focus instead on missing specific local coordinates schema, speed alerts, or Siri/ChatGPT verification actions.
3. "pass" (Stellar): For top-tier, highly optimized, and authoritative websites (like amazon.in, apple.com, google.com, wikipedia.org, etc.) that have excellent search engine, schema, and AI visibility. Praise their outstanding digital presence!

Provide a strict JSON output matching this structure:
{"status":"low","headline":"📍 Business (domain.com) short diagnosis","seoAudit":"1-2 sentence SEO analysis.","aeoAudit":"1-2 sentence AEO analysis."}

Respond ONLY with valid JSON. No markdown code block wraps. Raw JSON text only.`;

  // Sequential retry — only calls next key if the previous one fails, saving API costs
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const textOutput = await callGeminiApi(prompt, key);
      const parsedData = safeParseAudit(textOutput);
      if (!parsedData) throw new Error("Could not parse Gemini response after all attempts");

      let finalStatus: "low" | "high" | "pass" = "high";
      if (parsedData.status === "low" || parsedData.status === "high" || parsedData.status === "pass") {
        finalStatus = parsedData.status;
      }

      return {
        status: finalStatus,
        headline: parsedData.headline || `📍 ${biz} (${domain}) lacks AI assistant search compatibility`,
        seoAudit: parsedData.seoAudit || `Your domain ${domain} has baseline visibility but could be improved for competitive queries.`,
        aeoAudit: parsedData.aeoAudit || `Your website lacks key JSON-LD schemas required by modern search agents. Siri, ChatGPT, and Perplexity cannot easily verify and recommend ${biz}.`
      };
    } catch (err: any) {
      const maskedKey = key ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : "empty";
      console.warn(`Gemini key ${i} (${maskedKey}) failed:`, err?.message ?? err);
    }
  }

  console.error("All Gemini API keys failed. Using fallback template.");
  return getPersonalizedAuditFallback(biz, domain, siteTitle, siteDescription, hasSchema);
}



export const GET: APIRoute = async (context) => {
  const { request, clientAddress, locals } = context;
  const env = (locals as any).runtime?.env;

  try {
    let clientIp = request.headers.get("cf-connecting-ip") || 
                   request.headers.get("x-forwarded-for") || 
                   request.headers.get("x-real-ip") || 
                   clientAddress || 
                   "127.0.0.1";
    if (clientIp.includes(",")) {
      clientIp = clientIp.split(",")[0].trim();
    }

    const timestamps = await getTimestamps(clientIp, env);
    const now = Date.now();
    const activeTimestamps = timestamps.filter((ts) => now - ts < ONE_WEEK_MS);
    
    return new Response(JSON.stringify({ 
      used: activeTimestamps.length, 
      total: LIMIT_PER_WEEK 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ used: 0, total: LIMIT_PER_WEEK }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const POST: APIRoute = async (context) => {
  const { request, clientAddress, locals } = context;
  const env = (locals as any).runtime?.env;

  const logResponse = (payload: any, status: number = 200) => {
    console.log(`[API Response /api/verify-domain] Status: ${status} | Payload:`, JSON.stringify(payload, null, 2));
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    // 1. IP Rate Limiting check
    let clientIp = request.headers.get("cf-connecting-ip") || 
                   request.headers.get("x-forwarded-for") || 
                   request.headers.get("x-real-ip") || 
                   clientAddress || 
                   "127.0.0.1";
    if (clientIp.includes(",")) {
      clientIp = clientIp.split(",")[0].trim();
    }

    const { websiteUrl, businessName } = await request.json();
    console.log(`[API Request /api/verify-domain] IP: ${clientIp} | websiteUrl: "${websiteUrl}" | businessName: "${businessName}"`);

    const limitCheck = await isRateLimited(clientIp, env);
    if (limitCheck.limited) {
      return logResponse({ 
        success: false, 
        error: "Scan limit exceeded. You can scan up to 5 websites per week per device." 
      }, 200);
    }

    if (!websiteUrl) {
      return logResponse({ success: false, error: "Website URL is required." }, 400);
    }

    const hostname = cleanDomain(websiteUrl);

    // Basic syntax check: must have at least one dot and some characters on either side
    if (!hostname || !hostname.includes(".") || hostname.length < 4) {
      return logResponse({ success: false, error: "Invalid domain format. Example: brand.com.au" }, 200);
    }

    // Step 1.5: Intercept top-tier / highly-optimized platforms to praise them directly
    const topTierDomains = [
      "amazon.in", "amazon.com", "apple.com", "google.com", "google.co.in", 
      "microsoft.com", "github.com", "wikipedia.org", "netflix.com", 
      "youtube.com", "linkedin.com", "facebook.com", "instagram.com", 
      "twitter.com", "reddit.com"
    ];
    const isTopTier = topTierDomains.some((d) => hostname === d || hostname.endsWith("." + d));

    if (isTopTier) {
      // Consume a credit since a valid scan is successfully completed
      await consumeCredit(clientIp, env);
      await incrementGlobalScanCount(env);

      const bizName = businessName || hostname.split(".")[0].toUpperCase();
      return logResponse({
        success: true,
        domain: hostname,
        status: "pass",
        headline: `📍 ${bizName} (${hostname}) has exceptional search & AI visibility`,
        seoAudit: `Auditing ${hostname} shows industry-leading structured schema markup, stellar page rendering speed, and comprehensive SEO optimization.`,
        aeoAudit: `Voice search agents and LLM recommendation engines can seamlessly identify and recommend your services based on rich Answer Engine optimization.`,
        used: limitCheck.count + 1,
        total: LIMIT_PER_WEEK
      }, 200);
    }

    // Step 2 & 3: DNS Lookup + Website Fetch run in PARALLEL — saves 1-3s
    const [dnsResolves, fetchResult] = await Promise.all([
      lookupDns(hostname),
      fetchWebsiteHtml(hostname),
    ]);

    if (!dnsResolves && !fetchResult.success) {
      return logResponse({ success: false, error: "We couldn't resolve this domain's DNS. Please check the spelling." }, 200);
    }
    if (!fetchResult.success) {
      return logResponse({ success: false, error: "The website is taking too long to respond or is not currently online. Please verify it is active and try again." }, 200);
    }

    // Dynamic checks succeeded and site crawled successfully - consume a credit now
    await consumeCredit(clientIp, env);
    await incrementGlobalScanCount(env);

    // Extract live page title and description
    const metadata = extractMetadata(fetchResult.html);

    // Step 4: Generate Dynamic AI Audit
    const audit = await generateAIAuditWithFallback(businessName, hostname, metadata.title, metadata.description, metadata.hasSchema, env);

    return logResponse({
      success: true,
      domain: hostname,
      status: audit.status,
      headline: audit.headline,
      seoAudit: audit.seoAudit,
      aeoAudit: audit.aeoAudit,
      used: limitCheck.count + 1,
      total: LIMIT_PER_WEEK
    }, 200);
  } catch (err: any) {
    console.error("[API Error /api/verify-domain]:", err);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred while validating the website." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};


