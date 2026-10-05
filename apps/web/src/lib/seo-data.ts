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
  path?: string;
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
  "ai-automation-integration": {
    title: "AI Automation",
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

  "ai-receptionist": {
    title: "Voice Agents",
    shortDesc: "Automates phone calls, qualifies leads, schedules bookings, and answers FAQs 24/7.",
    longDesc: "Never miss a lead or support inquiry again. Our custom Voice Agents and AI Receptionists handle incoming phone calls, WhatsApp messages, and website chats 24/7. They qualify leads, schedule jobs directly into your CRM, and answer common questions just like a human operator.",
    benefits: [
      "Instantly replies to phone calls and web inquiries 24/7",
      "Seamlessly schedules appointments directly to calendar/CRM",
      "Qualifies high-value leads before booking",
      "Reduces office admin costs while capturing more sales"
    ],
    features: [
      "Natural-sounding Voice Agents with custom prompts",
      "Integration with ServiceM8, CRM, and calendar apps",
      "Missed-call automated text-back triggers",
      "24/7 lead qualification and customer FAQ handling"
    ],
    icon: "Phone",
  },

  "ai-image-gen": {
    title: "AI Image Gen.",
    shortDesc: "Create stunning marketing and brand assets instantly.",
    longDesc: "Generate high-quality, realistic images for marketing, branding, and socials in seconds using our advanced AI studio tools.",
    benefits: [
      "Save costs on commercial stock photography",
      "Instantly visualize creative concepts",
      "Perfect aspect ratios for every platform",
      "Zero prompt expertise required to start"
    ],
    features: [
      "High-fidelity image generation",
      "Multiple format aspect ratios",
      "Direct downloads and history tracking",
      "Intuitive web controls"
    ],
    icon: "Image",
    path: "/free-image-generation"
  },

  "ai-video-gen": {
    title: "AI Video Gen.",
    shortDesc: "Generate promotional videos from simple text prompts.",
    longDesc: "Turn simple text descriptions or static images into cinematic, high-impact videos with custom durations and motion parameters.",
    benefits: [
      "Create high-converting video ads in minutes",
      "Animate static brand images seamlessly",
      "Scale up your content production budget-free",
      "Modern keyframe motion controls"
    ],
    features: [
      "Text-to-Video generation",
      "Image-to-Video animation",
      "Custom resolution aspect ratios",
      "Selectable duration outputs"
    ],
    icon: "Play",
    path: "/free-video-generation"
  },

  "mvp-development": {
    title: "Startup MVPs",
    shortDesc: "Prototyping and core-feature development to validate your startup idea.",
    longDesc: "Launch your product in weeks, not months. We specialize in building Minimum Viable Products (MVPs) that focus strictly on your core value proposition, allowing you to get to market, test with real users, and secure funding faster.",
    benefits: [
      "Drastically reduced time-to-market for new product launches",
      "Cost-effective development focused entirely on core features",
      "Scalable codebase that won't need to be rewritten later",
      "Real-world user validation and feedback collection"
    ],
    features: [
      "Rapid agile development sprints",
      "Core feature architecture and prioritization",
      "Responsive, conversion-focused user interfaces",
      "Essential third-party API integrations"
    ],
    icon: "Rocket",
  },

  "saas-product-development": {
    title: "SaaS Product",
    shortDesc: "Scalable, multi-tenant web applications and complex software platforms.",
    longDesc: "We architect and develop robust Software-as-a-Service (SaaS) platforms built for scale. From complex data dashboards to subscription management and secure multi-tenant architectures, we build software that drives recurring revenue.",
    benefits: [
      "High-performance architecture built for thousands of concurrent users",
      "Seamless payment gateway and subscription billing integration",
      "Secure, scalable databases with automated backup protocols",
      "Custom analytics and administrative control dashboards"
    ],
    features: [
      "React / Next.js / Node.js full-stack development",
      "Stripe integration and tier-based access control",
      "AWS / Cloudflare enterprise infrastructure deployment",
      "Automated testing and CI/CD deployment pipelines"
    ],
    icon: "Cloud",
  },

  "ai-development": {
    title: "AI Development",
    shortDesc: "Custom AI Agents, RAG systems, and tailored LLM integrations for your business workflows.",
    longDesc: "We build tailored AI agents and RAG (Retrieval-Augmented Generation) systems that understand your unique business data. Stop relying on generic chat wrappers and deploy intelligent, context-aware AI tools that act as a secure extension of your workforce.",
    benefits: [
      "Proprietary AI agents trained on your business data",
      "Seamless integration with your existing CRM and software",
      "Secure, private LLM deployments with complete data ownership",
      "Automate complex data analysis and customer service tasks"
    ],
    features: [
      "Custom LLM fine-tuning and prompt engineering",
      "RAG architecture with vector database integration",
      "Secure API development and deployment",
      "Ongoing maintenance and model optimization"
    ],
    icon: "Cpu",
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
};

// JSON-LD Generation Helpers

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
