export interface CityInfo {
  name: string;
  state: string;
  postcode: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  suburbs: string[];
}

export interface ServiceInfo {
  title: string;
  shortDesc: string;
  longDesc: string;
  benefits: string[];
  features: string[];
  icon: string;
}

export interface ToolInfo {
  title: string;
  shortDesc: string;
  longDesc: string;
  componentName: string;
  icon: string;
}

export const CITIES: Record<string, CityInfo> = {
  sydney: {
    name: "Sydney",
    state: "NSW",
    postcode: "2000",
    address: "Level 3, 100 George Street, Sydney NSW 2000",
    phone: "1300 262 375",
    lat: -33.8688,
    lng: 151.2093,
    suburbs: ["Bondi", "Parramatta", "Manly", "Surry Hills", "Chatswood", "Randwick", "Cronulla", "Newtown"],
  },
  melbourne: {
    name: "Melbourne",
    state: "VIC",
    postcode: "3000",
    address: "Level 5, 440 Collins Street, Melbourne VIC 3000",
    phone: "1300 262 375",
    lat: -37.8136,
    lng: 144.9631,
    suburbs: ["Richmond", "Fitzroy", "St Kilda", "Brunswick", "South Yarra", "Carlton", "Prahran", "Hawthorn"],
  },
  brisbane: {
    name: "Brisbane",
    state: "QLD",
    postcode: "4000",
    address: "Level 12, 300 Queen Street, Brisbane QLD 4000",
    phone: "1300 262 375",
    lat: -27.4705,
    lng: 153.0260,
    suburbs: ["Fortitude Valley", "West End", "Paddington", "New Farm", "South Brisbane", "Indooroopilly", "Carindale"],
  },
  perth: {
    name: "Perth",
    state: "WA",
    postcode: "6000",
    address: "Level 28, 140 St Georges Terrace, Perth WA 6000",
    phone: "1300 262 375",
    lat: -31.9505,
    lng: 115.8605,
    suburbs: ["Fremantle", "Subiaco", "Northbridge", "Scarborough", "Victoria Park", "Cottesloe", "Claremont"],
  },
  adelaide: {
    name: "Adelaide",
    state: "SA",
    postcode: "5000",
    address: "Level 2, 70 Pirie Street, Adelaide SA 5000",
    phone: "1300 262 375",
    lat: -34.9285,
    lng: 138.6007,
    suburbs: ["Glenelg", "Norwood", "North Adelaide", "Prospect", "Unley", "Mawson Lakes", "Burnside"],
  },
  hobart: {
    name: "Hobart",
    state: "TAS",
    postcode: "7000",
    address: "111 Macquarie Street, Hobart TAS 7000",
    phone: "1300 262 375",
    lat: -42.8821,
    lng: 147.3272,
    suburbs: ["Sandy Bay", "Battery Point", "North Hobart", "Bellerive", "Glenorchy", "Kingston", "Howrah"],
  },
  canberra: {
    name: "Canberra",
    state: "ACT",
    postcode: "2601",
    address: "Level 6, 39 London Circuit, Canberra ACT 2601",
    phone: "1300 262 375",
    lat: -35.2809,
    lng: 149.1300,
    suburbs: ["Civic", "Kingston", "Manuka", "Belconnen", "Braddon", "Gungahlin", "Woden"],
  },
  darwin: {
    name: "Darwin",
    state: "NT",
    postcode: "0800",
    address: "Level 1, 48-50 Smith Street, Darwin NT 0800",
    phone: "1300 262 375",
    lat: -12.4634,
    lng: 130.8456,
    suburbs: ["Casuarina", "Palmerston", "Nightcliff", "Fannie Bay", "Larrakeyah", "Rapid Creek", "Berrimah"],
  },
};

export const SERVICES: Record<string, ServiceInfo> = {
  "custom-websites": {
    title: "Custom Websites",
    shortDesc: "Custom-built, ultra-fast, and mobile-optimized websites designed specifically for local businesses.",
    longDesc: "We build custom, high-speed, and mobile-responsive websites designed to maximize lead capture and customer conversion. Our sites load in under a second and are built with direct neobrutalist action funnels, so your company stands out instantly.",
    benefits: [
      "Optimized for maximum conversion of customer inquiries",
      "Ultra-fast loading times on 4G/5G mobile networks",
      "Neobrutalist, clean, and premium high-converting layouts",
      "Built-in local suburb routing configurations"
    ],
    features: [
      "Custom React / Next.js / Astro architecture",
      "Mobile-first responsive design integrations",
      "High-contrast CTA booking frameworks",
      "Full analytics and lead-tracking support"
    ],
    icon: "Code",
  },
  "ai-receptionist": {
    title: "AI Receptionist",
    shortDesc: "Answers every call instantly and captures job details 24/7.",
    longDesc: "Never miss another customer inquiry. Our AI Receptionist answers calls 24/7, qualifies customer needs, collects job details, and coordinates scheduling so your business keeps booking jobs even after hours.",
    benefits: [
      "Answers calls instantly 24/7 without extra admin staff",
      "Qualifies leads and collects booking details automatically",
      "Integrates with your booking calendar seamlessly",
      "Maintains a premium, professional response for every caller"
    ],
    features: [
      "Natural voice conversational AI",
      "Instant SMS confirmation details",
      "Auto-scheduling calendar sync",
      "Real-time email and dispatch notifications"
    ],
    icon: "Phone",
  },
  "ai-sms-follow-up": {
    title: "AI SMS Follow-Up",
    shortDesc: "Responds to missed calls within seconds and books jobs automatically.",
    longDesc: "If you miss a call because you're busy, customers won't wait. They hang up and call the next business. Our AI SMS Follow-Up system texts back missed callers instantly, qualifies their problem, and locks in the job.",
    benefits: [
      "Save up to 60% of jobs you would otherwise lose to voicemail",
      "Keeps interested customers from moving on to your competitors",
      "Works 24/7 without you having to pick up the phone",
      "Connects directly with your business phone links"
    ],
    features: [
      "Text sent within 5 seconds of a missed call",
      "Smart system that asks what the problem is",
      "Automatically checks and saves the customer's details",
      "Saves the booking details straight to your calendar"
    ],
    icon: "MessageSquare",
  },
  "ai-email-automation": {
    title: "AI Email Automation",
    shortDesc: "Follows up leads, nurtures prospects, and sends targeted quotes automatically via email.",
    longDesc: "Never let a warm lead go cold. Our AI Email Automation system handles follow-ups, nurtures prospects with timely information, and ensures your quotes get approved faster by keeping your business top-of-mind.",
    benefits: [
      "Increase quote approval rates with automatic friendly follow-ups",
      "Nurture warm prospects without spending hours typing emails",
      "Keep clients informed with automated scheduling and job updates",
      "Saves you hours of administration work every week"
    ],
    features: [
      "Smart automated email sequence design",
      "Direct sync with CRM and booking systems",
      "Dynamic template personalization",
      "Open rate and click tracking dashboards"
    ],
    icon: "Globe",
  },
  "workflow-automation": {
    title: "Workflow Automation",
    shortDesc: "Connects your tools, syncs calendar bookings, and automates invoices to run your business on autopilot.",
    longDesc: "Stop wasting hours copying details between spreadsheets, invoicing apps, and scheduling calendars. We build customized integrations to connect all your business tools, automating manual data entry so you can focus entirely on completing jobs.",
    benefits: [
      "Eliminate double data entry across different software tools",
      "Automates scheduling and invoice creation in real time",
      "Reduces admin errors and delays in getting paid",
      "Runs 24/7 in the background so your business works for you"
    ],
    features: [
      "Custom API and Zapier integration layers",
      "Xero, ServiceM8, CRM, and calendar synchronization",
      "Automated client onboarding workflow",
      "Real-time team notification pipelines"
    ],
    icon: "Layers",
  },
  "advanced-seo": {
    title: "Advanced SEO",
    shortDesc: "Get found first on Google Maps and search results where local customers look for services.",
    longDesc: "When local customers are searching for urgent services, they call the top businesses they see on Google. We optimize your business profile, clean up directories, and build localized content models to rank you in the Top 3 Map Pack.",
    benefits: [
      "Pushes your business into the Google Maps Top 3 where 70% of clicks go",
      "Establishes local search authority in all your target suburbs",
      "Synchronizes your location coordinates to align with AI search voice engines",
      "Targets high-intent search terms that lead directly to bookings"
    ],
    features: [
      "Google Business Profile setup and audit optimization",
      "Local citation synchronization across Australian registries",
      "High-authority local search signal generation",
      "Detailed maps rank tracking and visibility reports"
    ],
    icon: "MapPin",
  },
};

export const TOOLS: Record<string, ToolInfo> = {
  "missed-call-calculator": {
    title: "Missed Call Calculator",
    shortDesc: "Find out exactly how much weekly emergency revenue you are losing when you can't answer the phone.",
    longDesc: "A simple but eye-opening calculator that shows you how much cash is leaking from your business when you miss calls. Just input your average job rate and how many calls you miss a week to see your estimated losses—and find out how to stop the leak with text automation.",
    componentName: "ValuationCalculator",
    icon: "Calculator",
  },
  "google-chatgpt-scanner": {
    title: "Visibility Scanner",
    shortDesc: "See if your business is showing up in Google's Top 3 Maps and recommended by AI Search in your target suburbs.",
    longDesc: "Check if Siri, ChatGPT, or Google Maps would recommend your business when a local homeowner asks for a nearby emergency expert. Find search gaps and see how visible your trade team is today.",
    componentName: "EmergencyScanner",
    icon: "Search",
  },
  "sms-bot-simulator": {
    title: "SMS Bot Simulator",
    shortDesc: "Test how our automated system texts back emergency leads in under 2 seconds to win the job.",
    longDesc: "Try our interactive text simulator. Type typical customer emergency messages (like 'help, my kitchen is flooding!') to see how our automated text response system asks for the address, details the job, and locks in the booking before they dial your competitors.",
    componentName: "LeadCommandCenter",
    icon: "Zap",
  },
};

// JSON-LD Generation Helpers
export function generateLocalBusinessSchema(city: CityInfo) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": `Amberly Digital ${city.name}`,
    "image": "https://amberlydigital.com/og-image.png",
    "url": `https://amberlydigital.com/locations/${city.name.toLowerCase()}`,
    "telephone": city.phone,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": city.address.split(",")[0],
      "addressLocality": city.name,
      "addressRegion": city.state,
      "postalCode": city.postcode,
      "addressCountry": "AU"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": city.lat,
      "longitude": city.lng
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "opens": "00:00",
      "closes": "23:59"
    },
    "areaServed": city.suburbs.map(s => ({
      "@type": "AdministrativeArea",
      "name": `${s}, ${city.state}`
    }))
  };
}

export function generateServiceSchema(service: ServiceInfo, city: CityInfo) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": `${service.title} in ${city.name}`,
    "serviceType": service.title,
    "provider": {
      "@type": "LocalBusiness",
      "name": `Amberly Digital ${city.name}`,
      "telephone": city.phone,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": city.name,
        "addressRegion": city.state,
        "addressCountry": "AU"
      }
    },
    "areaServed": {
      "@type": "AdministrativeArea",
      "name": `${city.name}, ${city.state}`
    },
    "description": service.longDesc,
    "offers": {
      "@type": "Offer",
      "priceCurrency": "AUD",
      "price": "0.00",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "priceType": "StartingPrice",
        "price": "0.00",
        "priceCurrency": "AUD"
      }
    }
  };
}

export function generateToolSchema(tool: ToolInfo, city: CityInfo) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": `${tool.title} - ${city.name} Plumbers`,
    "url": `https://amberlydigital.com/tools/${tool.title.toLowerCase().replace(/ /g, "-")}/${city.name.toLowerCase()}`,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "All",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "about": {
      "@type": "Thing",
      "name": tool.title,
      "description": tool.longDesc
    },
    "offers": {
      "@type": "Offer",
      "price": "0.00",
      "priceCurrency": "AUD"
    },
    "publisher": {
      "@type": "LocalBusiness",
      "name": `Amberly Digital ${city.name}`,
      "telephone": city.phone
    }
  };
}

export function generateFAQSchema(faqItems: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.a
      }
    }))
  };
}
