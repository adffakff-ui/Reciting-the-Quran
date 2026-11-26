import React from 'react';
import { ShieldCheck, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import { TAJWEED_RULES_EXPLAINED } from '../data/quranData';

export const TajweedGuideView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 animate-fadeIn w-full overflow-hidden">
      {/* Banner */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 sm:space-y-3 z-10 text-center sm:text-right max-w-xl">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs font-semibold">
            الدليل الميسر لأحكام التجويد
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-white font-quran">أتقن تلاوة كتاب الله بأحكام التجويد</h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            مرجع مبسط لأهم أحكام التجويد وقواعد النطق السليم لحروف القرآن الكريم برواية حفص عن عاصم.
          </p>
        </div>
        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl z-10 hidden sm:flex shrink-0">
          <ShieldCheck className="w-8 h-8 sm:w-12 sm:h-12" />
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TAJWEED_RULES_EXPLAINED.map((rule, idx) => (
          <div
            key={idx}
            className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 shadow-md space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${rule.color}`}>
                  حكم تجويدي
                </span>
                <span className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 font-bold text-sm">
                  {idx + 1}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white font-quran">{rule.name}</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{rule.description}</p>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>تطبق هذه القاعدة لتحسين خشوع التلاوة وصحتها</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
