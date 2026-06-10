import React from "react";
import { SERVICES, CITIES } from "@/lib/seo-data";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-white pt-16 pb-8 border-t-2 border-slate-950 mt-auto" id="agency-footer">
      <div className="max-w-8xl mx-auto px-6 lg:px-12 grid grid-cols-1 md:grid-cols-3 gap-12 pb-12 border-b border-slate-800">
        
        {/* Column 1 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <a href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-amber-500 rounded-none border border-slate-950 flex items-center justify-center font-black text-slate-950 text-sm group-hover:bg-white transition-colors">
                A
              </div>
              <span className="text-lg font-black tracking-tighter uppercase font-display text-white">
                Amberly <span className="text-amber-500">Digital</span>
              </span>
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-amber-500 uppercase tracking-wider">
            <span>Websites</span>
            <span className="text-slate-700">•</span>
            <span>AI Tools</span>
            <span className="text-slate-700">•</span>
            <span>Workflow Automation</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mt-2 font-medium">
            Websites and AI systems designed to help local businesses attract customers, automate routine tasks, and grow more efficiently.
          </p>
        </div>

        {/* Column 2 */}
        <div className="flex flex-col gap-6 md:items-center md:translate-x-8">
          <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest font-mono">Services</span>
          <div className="grid grid-cols-2 gap-x-8 gap-y-0 items-start w-fit">
            <ul className="space-y-4.5">
              {Object.entries(SERVICES).slice(0, 3).map(([slug, s]) => (
                <li key={slug}>
                  <a
                    href={`/services/${slug}`}
                    className="text-xs text-slate-350 hover:text-amber-500 transition-colors font-semibold block"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
            <ul className="space-y-4.5">
              {Object.entries(SERVICES).slice(3).map(([slug, s]) => (
                <li key={slug}>
                  <a
                    href={`/services/${slug}`}
                    className="text-xs text-slate-350 hover:text-amber-500 transition-colors font-semibold block"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Column 3 */}
        <div className="flex flex-col gap-4 md:items-end md:text-right">
          <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest font-mono">Contact</span>
          <div className="flex flex-col gap-1 md:items-end">
            <a
              href="mailto:hello@amberlydigital.com"
              className="text-xs text-slate-350 hover:text-amber-500 transition-colors font-mono font-bold"
            >
              hello@amberlydigital.com
            </a>
            <span className="text-[10px] text-slate-500 font-mono mt-1">
              Responses typically within 12 hours
            </span>
          </div>
          <a
            href="/#onboarding-form"
            className="inline-block bg-white hover:bg-slate-100 text-slate-950 font-black py-3 px-6 rounded-none text-xs tracking-widest uppercase transition-all border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)] hover:shadow-[3px_3px_0px_0px_rgba(217,119,6,1)] w-fit"
          >
            Book a Free Strategy Call
          </a>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className="max-w-8xl mx-auto px-6 lg:px-12 py-8 border-b border-slate-800 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
          {Object.values(CITIES).map((city, idx) => (
            <React.Fragment key={city.name}>
              <span>{city.name}</span>
              {idx < Object.values(CITIES).length - 1 && (
                <span className="text-slate-700">•</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Very below: Rights Reserved */}
      <div className="max-w-8xl mx-auto px-6 lg:px-12 pt-8 text-center text-xs font-mono text-slate-500">
        <p>© {new Date().getFullYear()} Amberly Digital. All rights reserved.</p>
      </div>
    </footer>
  );
}
