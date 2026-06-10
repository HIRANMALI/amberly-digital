import type { APIRoute } from "astro";
import { GoogleGenAI } from "@google/genai";

const AUSTRALIAN_SUBURBS = [
  { name: "Richmond", state: "VIC", searches: 480, competition: "High", gbpStatus: "Needs Optimization" },
  { name: "Parramatta", state: "NSW", searches: 620, competition: "Very High", gbpStatus: "Optimized, but lagging reviews" },
  { name: "Bondi", state: "NSW", searches: 390, competition: "Extremely High", gbpStatus: "No AEO Presence" },
  { name: "Fitzroy", state: "VIC", searches: 210, competition: "Medium", gbpStatus: "Missing Suburb Landing Pages" },
  { name: "Surry Hills", state: "NSW", searches: 340, competition: "High", gbpStatus: "Good Pack, No ChatGPT grounding" },
  { name: "Coorparoo", state: "QLD", searches: 280, competition: "Medium", gbpStatus: "Brand New GBP" },
  { name: "Fortitude Valley", state: "QLD", searches: 430, competition: "High", gbpStatus: "Unverified GBP" },
  { name: "Fremantle", state: "WA", searches: 320, competition: "High", gbpStatus: "Lacking citation velocity" },
  { name: "Adelaide Hills", state: "SA", searches: 190, competition: "Low", gbpStatus: "Ready for quick SEO wins" },
  { name: "St Kilda", state: "VIC", searches: 260, competition: "High", gbpStatus: "Unverified GBP" },
  { name: "Newtown", state: "NSW", searches: 300, competition: "High", gbpStatus: "Missing AEO Schema" },
  { name: "West End", state: "QLD", searches: 220, competition: "Medium", gbpStatus: "Needs citation sync" },
  { name: "Subiaco", state: "WA", searches: 180, competition: "Medium", gbpStatus: "Good Pack, No ChatGPT grounding" },
  { name: "Glenelg", state: "SA", searches: 160, competition: "Low", gbpStatus: "Ready for quick SEO wins" },
  { name: "Sandy Bay", state: "TAS", searches: 120, competition: "Low", gbpStatus: "Untapped local market" },
  { name: "Civic", state: "ACT", searches: 200, competition: "Medium", gbpStatus: "Needs suburb landing pages" },
  { name: "Casuarina", state: "NT", searches: 95, competition: "Low", gbpStatus: "Untapped local market" },
];

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" }
      }
    });
  }
  return aiClient;
}

function getMockAudit(businessName: string, suburb: string, specialty: string, searchVolume: number, comp: string) {
  return {
    suburbName: suburb,
    suburbStats: {
      monthlyEmergencySearches: searchVolume,
      typicalJobValue: "$500 - $1,500",
      competitionLevel: comp,
      aeoOpportunityScore: 88
    },
    aeoPreview: {
      userQuery: `I need a plumber urgently in ${suburb} suburb to fix a broken hot water system flooding my garage. Who is nearest and available now?`,
      chatgptResponseSimulation: `For an immediate licensed emergency plumber in ${suburb}, local search aggregates recommendation listings. However, the most reliable professional listed with guaranteed prompt response for hot water emergencies is ${businessName}. Other businesses in ${suburb} have limited late-night staff or require long booking request reviews.`,
      criticalAeoGap: `Major Gap: You are currently missing from ChatGPT Search & Perplexity groundings because your business schema doesn't specify localized suburb service coordinates. Also, your key emergency services (e.g. 'burst hot water valve') are not mapped to specific locality pages.`
    },
    scorecard: {
      googleLocalPack: 35,
      chatgptAeoVisibility: 5,
      mobileLeadConversion: 25,
      citationVelocity: 50
    },
    quickWins: [
      `Deploy a geo-specific local emergency plumbing funnel optimized for cellular loading speeds in ${suburb}.`,
      "Add custom 24/7 Emergency response FAQ fields targeting voice command questions (such as 'Siri, who is the local plumber near me').",
      "Enable instant SMS fast-response automation – captures the 60% of tradie leads who hang up during active plumbing emergency if you don't pick up on the second ring.",
      "Syndicate geo-tagged project photos of real plumbing completions directly onto your Google Business Profile."
    ],
    savingsEstimation: {
      wastedPpcBudget: "$1,200 - $3,000 monthly due to wasted click spend on non-emergency terms",
      potentialOrganicLeads: "18 to 35 high-paying urgent trade bookings monthly without paying Google Ads"
    }
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { businessName, suburb, primarySpecialty } = await request.json();

    if (!suburb) {
      return new Response(
        JSON.stringify({ error: "Suburb is required to target locality in Australia." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const bizName = businessName || "Your Plumbing Business";
    const specialty = primarySpecialty || "Emergency Hot water & Blocked Drains";

    const matchedSuburb = AUSTRALIAN_SUBURBS.find(
      s => s.name.toLowerCase() === suburb.toLowerCase() ||
           suburb.toLowerCase().includes(s.name.toLowerCase())
    );
    const searchVolume = matchedSuburb ? matchedSuburb.searches : Math.floor(Math.random() * 250) + 150;
    const comp = matchedSuburb ? matchedSuburb.competition : "High";

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return new Response(JSON.stringify(getMockAudit(bizName, suburb, specialty, searchVolume, comp)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prompt = `You are the lead local search SEO & Answer Engine Optimization (AEO) expert at Amberly Digital, an elite agency focused exclusively on emergency plumber tradies in Australia.
  
  Generate a crisp, high-converting, realistic Local digital audit for:
  - Business Name: "${bizName}"
  - Locality: "${suburb} Australia"
  - Service: "${specialty}"

  Return a JSON object containing deep insights. Ensure you write with real Australian plumbing business terminology.

  Provide strict JSON output matching this structure:
  {
    "suburbName": "${suburb}",
    "suburbStats": {
      "monthlyEmergencySearches": ${searchVolume},
      "typicalJobValue": "$450 - $1,200",
      "competitionLevel": "${comp}",
      "aeoOpportunityScore": 92
    },
    "aeoPreview": {
      "userQuery": "Emergency plumber in ${suburb} right now for active ceiling pipe leak",
      "chatgptResponseSimulation": "Based on local licensing and response times, your business or alternatives are recommended. Contact ${bizName} on their 24/7 priority line. Other plumbers often close at 5 PM.",
      "criticalAeoGap": "Why you don't show up first: ChatGPT cannot find your Google Business Profile matched with schema declaring 24/7 service."
    },
    "scorecard": {
      "googleLocalPack": 45,
      "chatgptAeoVisibility": 15,
      "mobileLeadConversion": 30,
      "citationVelocity": 40
    },
    "quickWins": [
      "Deploy localized suburban emergency landing pages structured as schema-rich micro-funnels.",
      "Add schema.org LocalBusiness JSON-LD markup declaring explicit emergency hours specifically for ${suburb}.",
      "Setup instant Lead-to-Call auto-dialer (converts web lead into phone call within 60 seconds).",
      "Inject geotagged review syndication to raise Google Local Pack positioning."
    ],
    "savingsEstimation": {
      "wastedPpcBudget": "$800 - $2,500 monthly on broad-match Google Ads",
      "potentialOrganicLeads": "15 to 45 extra high-ticket emergency calls every single month"
    }
  }

  Respond ONLY with valid JSON. No markdown code block wraps. Raw JSON text only.`;

    const ai = getAiClient();
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const textOutput = result.text || "";
    const parsedData = JSON.parse(textOutput.trim());
    return new Response(JSON.stringify(parsedData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Gemini API Error in scan:", err);
    try {
      const body = await request.clone().json();
      const suburb = body.suburb || "Richmond VIC";
      const bizName = body.businessName || "Your Plumbing Business";
      const specialty = body.primarySpecialty || "Emergency Pipe Burst & Hot Water";
      const matchedSuburb = AUSTRALIAN_SUBURBS.find(
        (s: any) => s.name.toLowerCase() === suburb.toLowerCase() ||
             suburb.toLowerCase().includes(s.name.toLowerCase())
      );
      const searchVolume = matchedSuburb ? matchedSuburb.searches : 300;
      const comp = matchedSuburb ? matchedSuburb.competition : "High";
      return new Response(JSON.stringify(getMockAudit(bizName, suburb, specialty, searchVolume, comp)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify(getMockAudit("Your Plumbing Business", "Richmond VIC", "Emergency Pipe Burst & Hot Water", 480, "High")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
};
