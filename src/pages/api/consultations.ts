import type { APIRoute } from "astro";

interface ConsultationBooking {
  id?: string;
  businessName: string;
  phone?: string;
  email: string;
  contactName: string;
  interestedService: string;
  message?: string;
  bookingDate?: string;
  bookingTime?: string;
  createdAt?: string;
  status?: string;
}

// In-memory store (persists for lifecycle of server process)
const consultations: ConsultationBooking[] = [
  {
    id: "demo-1",
    businessName: "Bondi Emergency Plumbing",
    phone: "0412 345 678",
    email: "mark@bondiplumbing.com.au",
    contactName: "Mark Harrison",
    interestedService: "AI Receptionist",
    message: "Interested in setting up 24/7 call answering.",
    bookingDate: "2026-06-06",
    bookingTime: "10:30 AM",
    createdAt: new Date().toLocaleDateString("en-AU"),
    status: "Confirmed"
  }
];

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(consultations), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { businessName, phone, email, contactName, interestedService, message, bookingDate, bookingTime } = await request.json();

    if (!businessName || !email || !contactName || !interestedService) {
      return new Response(
        JSON.stringify({ error: "Missing required booking details (Business Name, Email, Contact Name, Interested Service)." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Send notification to Slack
    const webhookUrl = import.meta.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      const slackPayload = {
        text: `🚨 *New Strategy Call Booking!* 🚨\n\n` +
              `• *Contact Name:* ${contactName}\n` +
              `• *Email:* ${email}\n` +
              `• *Business Name:* ${businessName}\n` +
              `• *Service Interested In:* ${interestedService}\n` +
              `• *Message:* ${message || "N/A"}\n` +
              `• *Preferred Date/Time:* ${bookingDate || "N/A"} at ${bookingTime || "N/A"}`
      };

      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackPayload)
        });
      } catch (slackErr) {
        console.error("Failed to send notification to Slack:", slackErr);
      }
    } else {
      console.warn("WARNING: SLACK_WEBHOOK_URL is not defined in environment variables!");
    }

    const newBooking: ConsultationBooking = {
      id: `book-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      businessName,
      phone,
      email,
      contactName,
      interestedService,
      message: message || "",
      bookingDate: bookingDate || "",
      bookingTime: bookingTime || "",
      createdAt: new Date().toLocaleDateString("en-AU"),
      status: "Confirmed"
    };

    consultations.unshift(newBooking);
    return new Response(JSON.stringify(newBooking), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error creating consultation booking:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error occurred." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
