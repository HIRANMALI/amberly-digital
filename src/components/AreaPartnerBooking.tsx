"use client";

import React, { useState, useRef, useEffect } from "react";
import { Building, User, Mail, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ConsultationBooking } from "@/types/index";

export function AreaPartnerBooking() {
  const [bookingForm, setBookingForm] = useState<ConsultationBooking>({
    businessName: "",
    email: "",
    contactName: "",
    interestedService: "",
    message: "",
    bookingDate: "",
    bookingTime: "",
  });

  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [bookingLoading, setBookingLoading] = useState(false);
  const [showTradeDropdown, setShowTradeDropdown] = useState(false);

  const tradeDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-close notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

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
    if (!bookingForm.businessName || !bookingForm.email || !bookingForm.contactName || !bookingForm.interestedService) {
      setNotification({
        message: "Please fill in all fields and select a Service to book your call.",
        type: "error"
      });
      return;
    }

    setBookingLoading(true);
    setNotification(null);

    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingForm)
      });

      if (response.ok) {
        setNotification({
          message: "Thank you! We have received your inquiry. A representative will contact you shortly.",
          type: "success"
        });
        
        // Reset form
        setBookingForm({
          businessName: "",
          email: "",
          contactName: "",
          interestedService: "",
          message: "",
          bookingDate: "",
          bookingTime: "",
        });
      } else {
        const errData = await response.json();
        setNotification({
          message: errData.error || "Submission failed. Please check details.",
          type: "error"
        });
      }
    } catch (err) {
      console.error(err);
      setNotification({
        message: "Connection timeout submitting form.",
        type: "error"
      });
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

            {/* Row 2: Business Name & Services Interested In */}
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
                <div className="relative" ref={tradeDropdownRef}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Services Interested In</label>
                  <button
                    type="button"
                    onClick={() => setShowTradeDropdown(!showTradeDropdown)}
                    className="w-full bg-white border-2 border-slate-950 p-3 pl-3.5 rounded-none text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-bold flex items-center justify-between cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                  >
                    {bookingForm.interestedService ? (
                      <span className="text-slate-900 font-bold">{bookingForm.interestedService}</span>
                    ) : (
                      <span className="text-slate-400 font-semibold">Select Service...</span>
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
                        {[
                          "Custom Websites",
                          "AI Receptionist",
                          "AI SMS Follow-Up",
                          "AI Email Automation",
                          "Workflow Automation",
                          "Advanced SEO",
                          "Other"
                        ].map((service) => (
                          <button
                            key={service}
                            type="button"
                            onClick={() => {
                              setBookingForm({ ...bookingForm, interestedService: service });
                              setShowTradeDropdown(false);
                            }}
                            className={`w-full text-left p-3.5 text-sm font-bold transition-all rounded-none cursor-pointer border-b border-slate-100 last:border-0
                              ${bookingForm.interestedService === service
                                ? "bg-amber-500 text-slate-950 font-black"
                                : "bg-white text-slate-800 hover:bg-amber-50 hover:text-slate-950"
                              }
                            `}
                          >
                            {service}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Row 3: Message */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Message (Optional)</label>
              <textarea
                placeholder="Tell us about your project, goals, or any questions you have..."
                value={bookingForm.message}
                onChange={(e) => setBookingForm({ ...bookingForm, message: e.target.value })}
                className="w-full bg-white border-2 border-slate-950 p-3 rounded-none text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-medium min-h-[120px] resize-y"
              />
            </div>

            <button
              type="submit"
              disabled={bookingLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 px-6 rounded-none text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] disabled:opacity-50 !mt-10"
            >
              {bookingLoading ? "BOOKING CALL..." : "BOOK A CALL"}
            </button>
          </form>
        </div>
      </div>

      {/* Floating Popup Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 p-5 border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] rounded-none flex items-start gap-4 max-w-sm sm:max-w-md bg-white"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">
                  {notification.type === "success" ? "🎉" : "⚠️"}
                </span>
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-900">
                  {notification.type === "success" ? "Success" : "Error"}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-700 mt-2 leading-relaxed">
                {notification.message}
              </p>
              
              {/* Animated Progress Bar */}
              <div className="h-1 bg-slate-100 border border-slate-900 mt-3 overflow-hidden rounded-none">
                <motion.div 
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 5, ease: "linear" }}
                  className={`h-full ${notification.type === "success" ? "bg-amber-500" : "bg-red-500"}`}
                />
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-500 hover:text-slate-950 font-mono font-black text-[10px] shrink-0 cursor-pointer p-1 border-2 border-slate-950 bg-white hover:bg-slate-50 flex items-center justify-center w-6 h-6 transition-all shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-none translate-y-[-2px] active:translate-y-0"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
