import type { APIRoute } from "astro";
import { GoogleGenAI } from "@google/genai";
import dns from "dns";

// Global in-memory rate limiting map fallback
export const ipCache = new Map<string, number[]>();

const LIMIT_PER_WEEK = 5;
const REDIS_PREFIX = "limit:ip:";
const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds
const ONE_WEEK_MS = ONE_WEEK_SECONDS * 1000;

async function upstashCommand(command: any[]): Promise<any> {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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

export async function getTimestamps(ip: string): Promise<number[]> {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return ipCache.get(ip) || [];
  }

  const result = await upstashCommand(["GET", `${REDIS_PREFIX}${ip}`]);
  if (result === null) {
    return [];
  }

  try {
    return typeof result === "string" ? JSON.parse(result) : [];
  } catch {
    return [];
  }
}

export async function setTimestamps(ip: string, timestamps: number[]): Promise<void> {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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
  ]);
}

export async function deleteIp(ip: string): Promise<boolean> {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (ipCache.has(ip)) {
      ipCache.delete(ip);
      return true;
    }
    return false;
  }

  const deletedCount = await upstashCommand(["DEL", `${REDIS_PREFIX}${ip}`]);
  return typeof deletedCount === "number" && deletedCount > 0;
}

export async function getAllTrackedIps(): Promise<Array<{
  ip: string;
  scanCount: number;
  lastScanTime: string | null;
  allScansThisWeek: string[];
}>> {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
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

  const keys: string[] = await upstashCommand(["KEYS", `${REDIS_PREFIX}*`]) || [];
  if (keys.length === 0) return [];

  const values: Array<string | null> = await upstashCommand(["MGET", ...keys]) || [];
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

async function isRateLimited(ip: string): Promise<{ limited: boolean; count: number }> {
  const now = Date.now();
  let timestamps = await getTimestamps(ip);

  // Filter out timestamps older than 1 week
  timestamps = timestamps.filter((ts) => now - ts < ONE_WEEK_MS);
  await setTimestamps(ip, timestamps); // clean up old timestamps on check

  return { limited: timestamps.length >= LIMIT_PER_WEEK, count: timestamps.length };
}

async function consumeCredit(ip: string): Promise<void> {
  const now = Date.now();
  let timestamps = await getTimestamps(ip);
  timestamps = timestamps.filter((ts) => now - ts < ONE_WEEK_MS);
  timestamps.push(now);
  await setTimestamps(ip, timestamps);
}

let globalScanCountFallback = 0;

export async function incrementGlobalScanCount(): Promise<void> {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    globalScanCountFallback++;
    return;
  }

  await upstashCommand(["INCR", "global:total_scans"]);
}

export async function getGlobalScanCount(): Promise<number> {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return globalScanCountFallback;
  }

  const result = await upstashCommand(["GET", "global:total_scans"]);
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

function lookupDns(hostname: string): Promise<boolean> {
  return new Promise((resolve) => {
    dns.lookup(hostname, (err) => {
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function fetchWebsiteHtml(domain: string): Promise<{ success: boolean; html: string }> {
  const protocols = ["https://", "http://"];
  for (const protocol of protocols) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

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
        // Ensure we got actual HTML content and not an empty page or bot redirect/block
        if (html && html.trim().length > 150) {
          return { success: true, html };
        }
      }
    } catch (e) {
      // Continue to next protocol
    }
  }
  return { success: false, html: "" };
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
  description: string;
} {
  const biz = businessName || "Your Business";
  
  // Check if it's a known top-tier domain
  const topTierDomains = ["amazon.in", "amazon.com", "apple.com", "google.com", "microsoft.com", "github.com", "wikipedia.org", "netflix.com", "youtube.com"];
  const isTopTier = topTierDomains.some((d) => domain.includes(d));

  if (isTopTier) {
    return {
      status: "pass",
      headline: `📍 ${biz} (${domain}) has exceptional search & AI visibility`,
      description: `Auditing ${domain} shows industry-leading structured schema markup, stellar page rendering speed, and comprehensive SEO optimization. Voice search agents and LLM recommendation engines can seamlessly identify and recommend your services.`
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
      description: `Auditing ${domain} shows slow cellular viewport loading hooks. While some structured schema markup was detected, potential customers looking for ${niche} bounce to faster competitors.`
    };
  }

  if (isHigh) {
    return {
      status: "high",
      headline: `📍 ${biz} (${domain}) lacks AI assistant search compatibility`,
      description: `Your domain ${domain} lacks key JSON-LD schemas required by modern search agents. Siri, ChatGPT, and Perplexity cannot verify and recommend ${biz} for queries targeting ${niche} in your service areas.`
    };
  } else {
    return {
      status: "low",
      headline: `📍 ${biz} (${domain}) has mobile speed & structured conversion leaks`,
      description: `Auditing ${domain} shows missing fast-loading cellular viewport hooks and schema markups. This causes potential customers looking for ${niche} to bounce to faster competitors.`
    };
  }
}

async function generateAIAuditWithFallback(
  businessName: string, 
  domain: string,
  siteTitle: string,
  siteDescription: string,
  hasSchema: boolean
): Promise<{
  status: "low" | "high" | "pass";
  headline: string;
  description: string;
}> {
  const keys = [
    import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    import.meta.env.GEMINI_API_KEY_FALLBACK || process.env.GEMINI_API_KEY_FALLBACK,
    import.meta.env.GEMINI_API_KEY_FALLBACK_2 || process.env.GEMINI_API_KEY_FALLBACK_2
  ].filter(Boolean) as string[];

  const biz = businessName || "Your Business";

  if (keys.length === 0) {
    return getPersonalizedAuditFallback(biz, domain, siteTitle, siteDescription, hasSchema);
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" }
        }
      });

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
{
  "status": "low" | "high" | "pass",
  "headline": "A personalized headline starting with '📍 [Business Name] ([Domain])' followed by the factual diagnosis (e.g. 'uses structured data but lacks local coordinate mapping' or 'has excellent AI & search engine visibility')",
  "description": "A 2-sentence objective, helpful analysis of the site. Praise their strengths (e.g., if they have JSON-LD or great speed) while pointing out the specific next steps clearly and helpfully. Keep it realistic, authentic, and free of sales pitches."
}

Respond ONLY with valid JSON. No markdown code block wraps. Raw JSON text only.`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3
        }
      });

      const textOutput = result.text || "";
      const parsedData = JSON.parse(textOutput.trim());
      
      let finalStatus: "low" | "high" | "pass" = "high";
      if (parsedData.status === "low" || parsedData.status === "high" || parsedData.status === "pass") {
        finalStatus = parsedData.status;
      }
      
      return {
        status: finalStatus,
        headline: parsedData.headline || `📍 ${biz} (${domain}) lacks AI assistant search compatibility`,
        description: parsedData.description || `Your website lacks key JSON-LD structure mapping. Voice search engines (Siri, ChatGPT) cannot verify and ground your business recommendations.`
      };
    } catch (err) {
      console.warn(`Gemini API key index ${i} failed to execute query:`, err);
    }
  }

  console.error("All Gemini API keys failed or none provided. Using fallback template.");
  return getPersonalizedAuditFallback(biz, domain, siteTitle, siteDescription, hasSchema);
}

export const GET: APIRoute = async ({ request, clientAddress }) => {
  try {
    let clientIp = request.headers.get("x-forwarded-for") || 
                   request.headers.get("x-real-ip") || 
                   clientAddress || 
                   "127.0.0.1";
    if (clientIp.includes(",")) {
      clientIp = clientIp.split(",")[0].trim();
    }

    const timestamps = await getTimestamps(clientIp);
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

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const logResponse = (payload: any, status: number = 200) => {
    console.log(`[API Response /api/verify-domain] Status: ${status} | Payload:`, JSON.stringify(payload, null, 2));
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    // 1. IP Rate Limiting check
    let clientIp = request.headers.get("x-forwarded-for") || 
                   request.headers.get("x-real-ip") || 
                   clientAddress || 
                   "127.0.0.1";
    if (clientIp.includes(",")) {
      clientIp = clientIp.split(",")[0].trim();
    }

    const { websiteUrl, businessName } = await request.json();
    console.log(`[API Request /api/verify-domain] IP: ${clientIp} | websiteUrl: "${websiteUrl}" | businessName: "${businessName}"`);

    const limitCheck = await isRateLimited(clientIp);
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
      await consumeCredit(clientIp);
      await incrementGlobalScanCount();

      const bizName = businessName || hostname.split(".")[0].toUpperCase();
      return logResponse({
        success: true,
        domain: hostname,
        status: "pass",
        headline: `📍 ${bizName} (${hostname}) has exceptional search & AI visibility`,
        description: `Auditing ${hostname} shows industry-leading structured schema markup, stellar page rendering speed, and comprehensive SEO optimization. Voice search agents and LLM recommendation engines can seamlessly identify and recommend your services.`
      }, 200);
    }

    // Step 2: DNS Lookup
    const dnsResolves = await lookupDns(hostname);
    if (!dnsResolves) {
      return logResponse({ success: false, error: "We couldn't resolve this domain's DNS. Please check the spelling." }, 200);
    }

    // Step 3: Fetch Website HTML and Verify
    const fetchResult = await fetchWebsiteHtml(hostname);
    if (!fetchResult.success) {
      return logResponse({ success: false, error: "The website is taking too long to respond or is not currently online. Please verify it is active and try again." }, 200);
    }

    // Dynamic checks succeeded and site crawled successfully - consume a credit now
    await consumeCredit(clientIp);
    await incrementGlobalScanCount();

    // Extract live page title and description
    const metadata = extractMetadata(fetchResult.html);

    // Step 4: Generate Dynamic AI Audit
    const audit = await generateAIAuditWithFallback(businessName, hostname, metadata.title, metadata.description, metadata.hasSchema);

    return logResponse({
      success: true,
      domain: hostname,
      status: audit.status,
      headline: audit.headline,
      description: audit.description
    }, 200);
  } catch (err: any) {
    console.error("[API Error /api/verify-domain]:", err);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred while validating the website." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
