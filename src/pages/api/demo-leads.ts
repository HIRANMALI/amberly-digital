import type { APIRoute } from "astro";

interface SimulationLead {
  id: string;
  customerName: string;
  suburb: string;
  phone: string;
  urgentIssue: string;
  source: string;
  revenueEstimate: string;
  status: string;
  timestamp: string;
}

export const GET: APIRoute = async () => {
  const simulatedLeads: SimulationLead[] = [
    {
      id: "lead-1",
      customerName: "Glenn Henderson",
      suburb: "Preston VIC",
      phone: "0491 570 156",
      urgentIssue: "Burst Pipe in wall – flooding lounge room",
      source: "AEO / ChatGPT Search Referral",
      revenueEstimate: "$850",
      status: "Booked (SMS Bot Auto-confirmation)",
      timestamp: "5 mins ago"
    },
    {
      id: "lead-2",
      customerName: "Sarah Jenkins",
      suburb: "Chadstone VIC",
      phone: "0491 570 293",
      urgentIssue: "Blocked Sewer drainage - backflowing into ensuite toilet",
      source: "Google Local Map Pack - Rank #2",
      revenueEstimate: "$1,200",
      status: "Hot - Awaiting response dialer",
      timestamp: "12 mins ago"
    },
    {
      id: "lead-3",
      customerName: "David Vance",
      suburb: "Cremorne NSW",
      phone: "0491 570 811",
      urgentIssue: "Gas Leak smell near gas meter",
      source: "Google Assistant Voice Search",
      revenueEstimate: "$450+",
      status: "Booked",
      timestamp: "32 mins ago"
    },
    {
      id: "lead-4",
      customerName: "Rebecca Moss",
      suburb: "Milton QLD",
      phone: "0491 570 422",
      urgentIssue: "No Hot Water – 400L tank heater unit replacement needed",
      source: "AEO / Perplexity Search Finder",
      revenueEstimate: "$2,400",
      status: "Booked (Form Capture)",
      timestamp: "1 hour ago"
    }
  ];
  
  return new Response(JSON.stringify(simulatedLeads), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
