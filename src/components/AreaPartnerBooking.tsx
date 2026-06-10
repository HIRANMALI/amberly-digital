"use client";

import React, { useState, useRef, useEffect } from "react";
import { Building, User, Mail, MapPin, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ConsultationBooking } from "@/types/index";

export function AreaPartnerBooking() {
  const [bookingForm, setBookingForm] = useState<ConsultationBooking>({
    businessName: "",
    suburb: "",
    email: "",
    contactName: "",
    tradeType: "",
    bookingDate: "",
    bookingTime: "",
  });

  const [bookingResponse, setBookingResponse] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showTradeDropdown, setShowTradeDropdown] = useState(false);

  const tradeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tradeDropdownRef.current && !tradeDropdownRef.current.contains(event.target as Node)) {
        setShowTradeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingForm.businessName || !bookingForm.email || !bookingForm.contactName || !bookingForm.tradeType || !bookingForm.suburb) {
      alert("Please select a Trade Type to book your call.");
      return;
    }

    setBookingLoading(true);
    setBookingResponse(null);

    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingForm)
      });

      if (response.ok) {
        setBookingResponse(`Thank you! We have received your inquiry for "${bookingForm.suburb}". A representative will contact you shortly.`);
        
        // Reset form
        setBookingForm({
          businessName: "",
          suburb: "",
          email: "",
          contactName: "",
          tradeType: "",
          bookingDate: "",
          bookingTime: "",
        });
      } else {
        const errData = await response.json();
        alert(errData.error || "Submission failed. Please check details.");
      }
    } catch (err) {
      console.error(err);
      alert("Connection timeout submitting form.");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <section className="py-20 bg-slate-50 border-b-2 border-slate-950" id="onboarding-form">
      <div className="max-w-4xl mx-auto px-6 lg:px-12">
        <div className="bg-white border-2 border-slate-950 p-8 sm:p-12 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] rounded-none relative">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-mono font-bold text-amber-600 uppercase tracking-widest block mb-3">
              ⚡ SEE WHERE YOU'RE LOSING JOBS
            </span>
            <h3 className="text-3xl sm:text-4xl font-display font-black text-slate-950 uppercase tracking-tight">
              BOOK A STRATEGY CALL
            </h3>
            <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed font-semibold">
              Let's discuss your website, online presence, and how AI tools could support your business.
            </p>
          </div>

          <form onSubmit={handleBookingSubmit} className="space-y-6">
            {/* Row 1: Your Name & Email Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Your Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Glenn Henderson"
                    value={bookingForm.contactName}
                    onChange={(e) => setBookingForm({ ...bookingForm, contactName: e.target.value })}
                    className="w-full bg-white border-2 border-slate-950 p-3 pl-10 rounded-none text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                  <input
                    type="email"
                    placeholder="glenn@hendersonplumbing.com.au"
                    value={bookingForm.email}
                    onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                    className="w-full bg-white border-2 border-slate-950 p-3 pl-10 rounded-none text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Business Name & Primary Service Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Business Name</label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Henderson Plumbing"
                    value={bookingForm.businessName}
                    onChange={(e) => setBookingForm({ ...bookingForm, businessName: e.target.value })}
                    className="w-full bg-white border-2 border-slate-950 p-3 pl-10 rounded-none text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Primary Service Area</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="e.g. Richmond VIC"
                    value={bookingForm.suburb}
                    onChange={(e) => setBookingForm({ ...bookingForm, suburb: e.target.value })}
                    className="w-full bg-white border-2 border-slate-950 p-3 pl-10 rounded-none text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Trade Type */}
            <div>
              <div className="relative" ref={tradeDropdownRef}>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Trade Type</label>
                <button
                  type="button"
                  onClick={() => setShowTradeDropdown(!showTradeDropdown)}
                  className="w-full bg-white border-2 border-slate-950 p-3.5 rounded-none text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-bold flex items-center justify-between cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  {bookingForm.tradeType ? (
                    <span className="text-slate-900 font-bold">{bookingForm.tradeType}</span>
                  ) : (
                    <span className="text-slate-400 font-semibold">Select Trade Type...</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showTradeDropdown ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {showTradeDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 mt-1.5 bg-white border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-40 rounded-none overflow-hidden max-h-[240px] overflow-y-auto"
                    >
                      {["Plumber", "Electrician", "Builder", "Landscaper", "Roofer", "HVAC", "Painter", "Other"].map((trade) => (
                        <button
                          key={trade}
                          type="button"
                          onClick={() => {
                            setBookingForm({ ...bookingForm, tradeType: trade });
                            setShowTradeDropdown(false);
                          }}
                          className={`w-full text-left p-3.5 text-sm font-bold transition-all rounded-none cursor-pointer border-b border-slate-100 last:border-0
                            ${bookingForm.tradeType === trade
                              ? "bg-amber-500 text-slate-950 font-black"
                              : "bg-white text-slate-800 hover:bg-amber-50 hover:text-slate-950"
                            }
                          `}
                        >
                          {trade}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <button
              type="submit"
              disabled={bookingLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 px-6 rounded-none text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] disabled:opacity-50 !mt-10"
            >
              {bookingLoading ? "BOOKING CALL..." : "BOOK A CALL"}
            </button>
          </form>

          <AnimatePresence>
            {bookingResponse && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 p-5 bg-amber-50 border-2 border-amber-300 text-slate-900 text-xs font-bold font-mono text-center rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase"
              >
                🎉 {bookingResponse}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
