import type { APIRoute } from "astro";

interface ConsultationBooking {
  id?: string;
  businessName: string;
  suburb: string;
  phone?: string;
  email: string;
  contactName: string;
  tradeType: string;
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
    suburb: "Bondi NSW",
    phone: "0412 345 678",
    email: "mark@bondiplumbing.com.au",
    contactName: "Mark Harrison",
    tradeType: "Plumber",
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
    const { businessName, suburb, phone, email, contactName, tradeType, bookingDate, bookingTime } = await request.json();

    if (!businessName || !email || !contactName || !tradeType) {
      return new Response(
        JSON.stringify({ error: "Missing required booking details (Business Name, Email, Contact Name, Trade Type)." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const newBooking: ConsultationBooking = {
      id: `book-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      businessName,
      suburb: suburb || "Australia Wide",
      phone,
      email,
      contactName,
      tradeType,
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
