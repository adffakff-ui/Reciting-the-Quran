import React, { useState, useEffect } from 'react';
import { X, BookOpen, Sparkles, Volume2, CheckCircle2, Bookmark, Share2 } from 'lucide-react';
import { Ayah, Surah } from '../data/quranData';

interface AyahModalProps {
  ayah: Ayah | null;
  surah: Surah | null;
  onClose: () => void;
  onToggleBookmark: (ayahKey: string) => void;
  isBookmarked: boolean;
}

export const AyahModal: React.FC<AyahModalProps> = ({
  ayah,
  surah,
  onClose,
  onToggleBookmark,
  isBookmarked,
}) => {
  const [loading, setLoading] = useState(false);
  const [tafseerData, setTafseerData] = useState<{
    summary: string;
    tajweedRules: string[];
    reflections: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'tafseer' | 'translation'>('tafseer');

  useEffect(() => {
    if (ayah && surah) {
      fetchTafseer();
    }
  }, [ayah]);

  const buildOfflineTafseer = (currentAyah: Ayah, currentSurah: Surah) => {
    const detectedRules: string[] = [];
    const txt = currentAyah.text;
    if (/[قطبجد]ْ/.test(txt)) detectedRules.push('القلقلة');
    if (/[نم]ّ/.test(txt)) detectedRules.push('غنة النون والميم المشددتين');
    if (/ٓ/.test(txt)) detectedRules.push('المد الفرعي (متصل/منفصل)');
    if (/نْ|ً|ٍ|ٌ/.test(txt)) detectedRules.push('أحكام النون الساكنة والتنوين');
    if (/مْ/.test(txt)) detectedRules.push('أحكام الميم الساكنة');
    if (detectedRules.length === 0) detectedRules.push('المد الطبيعي', 'الترقيق والتفخيم', 'الوقف والابتداء');

    const revLabel = currentSurah.revelationType === 'Meccan' ? 'مكية' : 'مدنية';
    return {
      summary: `آية رقم (${currentAyah.number}) من سورة ${currentSurah.name} (${revLabel}، الجزء ${currentSurah.juz}). المعنى الإجمالي في وضع عدم الاتصال: "${currentAyah.translation || 'يرجى تدبر ألفاظ الآية الكريمة ومعانيها المباركة.'}"`,
      tajweedRules: detectedRules,
      reflections: `تدبر هذه الآية الكريمة من سورة ${currentSurah.name} وحافظ على إتمام الحركات ومخارج الحروف والمدود أثناء التلاوة.`,
    };
  };

  const fetchTafseer = async () => {
    if (!ayah || !surah) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setTafseerData(buildOfflineTafseer(ayah, surah));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ai/tafseer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ayahText: ayah.text,
          surahName: surah.name,
          ayahNumber: ayah.number,
        }),
      });
      if (!res.ok) throw new Error('API unavailable');
      const data = await res.json();
      if (!data || !data.summary) throw new Error('Empty response');
      setTafseerData(data);
    } catch {
      setTafseerData(buildOfflineTafseer(ayah, surah));
    } finally {
      setLoading(false);
    }
  };

  if (!ayah || !surah) return null;

  const ayahKey = `${surah.number}:${ayah.number}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 bg-slate-850 border-b border-slate-800 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs sm:text-sm shrink-0">
              {ayah.number}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm sm:text-lg font-quran truncate">سورة {surah.name} - الآية {ayah.number}</h3>
              <p className="text-[11px] text-slate-400 truncate">{surah.englishName} ({surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'})</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onToggleBookmark(ayahKey)}
              className={`p-2 rounded-xl border transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer ${
                isBookmarked 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="حفظ في المفضلة"
            >
              <Bookmark className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          {/* Ayah Card */}
          <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-teal-950/30 border border-emerald-500/20 text-center space-y-4">
            <p className="text-xl sm:text-3xl font-quran text-emerald-100 leading-relaxed font-bold">
              {ayah.text}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2 border-t border-emerald-500/10">
              <button 
                onClick={() => {
                  const utterance = new SpeechSynthesisUtterance(ayah.text);
                  utterance.lang = 'ar-SA';
                  utterance.rate = 0.85;
                  window.speechSynthesis.speak(utterance);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30 transition-colors min-h-[40px] cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>استماع صوتي</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap sm:flex-nowrap gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('tafseer')}
              className={`flex-1 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[42px] cursor-pointer text-center ${
                activeTab === 'tafseer'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              التفسير والتدبر الذكي
            </button>
            <button
              onClick={() => setActiveTab('translation')}
              className={`flex-1 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[42px] cursor-pointer text-center ${
                activeTab === 'translation'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              الترجمة الإنجليزية (English)
            </button>
          </div>

          {activeTab === 'translation' ? (
            <div className="p-5 rounded-2xl bg-slate-850 border border-slate-800 text-slate-200 text-lg leading-relaxed font-sans">
              <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">English Translation</p>
              {ayah.translation}
            </div>
          ) : (
            <div className="space-y-4">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-sm text-slate-400 font-medium">جاري استخلاص التفسير والتدبر بالذكاء الاصطناعي...</p>
                </div>
              ) : tafseerData ? (
                <>
                  <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-2">
                    <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      <span>المعنى الإجمالي والتفسير</span>
                    </h4>
                    <p className="text-slate-300 text-sm leading-relaxed">{tafseerData.summary}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-2">
                    <h4 className="text-sm font-bold text-teal-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>أحكام التجويد البارزة</span>
                    </h4>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {tafseerData.tajweedRules?.map((rule, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                          {rule}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-2">
                    <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>لطائف تدبرية</span>
                    </h4>
                    <p className="text-slate-300 text-sm leading-relaxed">{tafseerData.reflections}</p>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-850 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-750 font-semibold text-xs sm:text-sm transition-colors min-h-[44px] cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
