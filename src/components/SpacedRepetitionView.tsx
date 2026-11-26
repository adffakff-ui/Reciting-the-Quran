import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Calendar, CheckCircle2, AlertCircle, RotateCcw, Clock, Trophy } from 'lucide-react';
import { QURAN_SURAHS } from '../data/quranData';
import confetti from 'canvas-confetti';

interface RevisionCard {
  id: string;
  surahName: string;
  ayahReference: string;
  intervalDays: number;
  nextReviewDate: string; // ISO date string
  status: 'due' | 'reviewing' | 'mastered';
  difficulty: 'hard' | 'medium' | 'easy';
}

export const SpacedRepetitionView: React.FC = () => {
  const [cards, setCards] = useState<RevisionCard[]>(() => {
    try {
      const saved = localStorage.getItem('hifz_spaced_cards');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    // Default initial cards for Spaced Repetition
    const today = new Date().toISOString().split('T')[0];
    return [
      { id: '1', surahName: 'الفاتحة', ayahReference: 'الآيات 1 - 7', intervalDays: 1, nextReviewDate: today, status: 'due', difficulty: 'hard' },
      { id: '2', surahName: 'الملك', ayahReference: 'الآيات 1 - 5', intervalDays: 3, nextReviewDate: today, status: 'due', difficulty: 'medium' },
      { id: '3', surahName: 'يس', ayahReference: 'الآيات 1 - 5', intervalDays: 7, nextReviewDate: today, status: 'due', difficulty: 'easy' },
      { id: '4', surahName: 'الرحمن', ayahReference: 'الآيات 1 - 5', intervalDays: 14, nextReviewDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], status: 'reviewing', difficulty: 'medium' }
    ];
  });

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('hifz_spaced_cards', JSON.stringify(cards));
    } catch (e) {
      console.error(e);
    }
  }, [cards]);

  const todayStr = new Date().toISOString().split('T')[0];
  const dueCards = cards.filter(c => c.nextReviewDate <= todayStr);
  const upcomingCards = cards.filter(c => c.nextReviewDate > todayStr);

  const handleRateCard = (cardId: string, rating: 'hard' | 'medium' | 'easy') => {
    const nextIntervalMap = {
      hard: 1,
      medium: 3,
      easy: 7
    };
    const daysToAdd = nextIntervalMap[rating];
    const nextDate = new Date(Date.now() + 86400000 * daysToAdd).toISOString().split('T')[0];

    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        return {
          ...card,
          intervalDays: daysToAdd,
          nextReviewDate: nextDate,
          difficulty: rating,
          status: rating === 'easy' ? 'mastered' : 'due'
        };
      }
      return card;
    }));

    setActiveCardId(null);
    setShowAnswer(false);
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
  };

  const handleAddNewCard = (surahName: string) => {
    const newCard: RevisionCard = {
      id: Date.now().toString(),
      surahName,
      ayahReference: 'مراجعة شاملة للآيات',
      intervalDays: 1,
      nextReviewDate: todayStr,
      status: 'due',
      difficulty: 'hard'
    };
    setCards([newCard, ...cards]);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 animate-fadeIn w-full overflow-hidden">
      {/* Banner */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 sm:space-y-3 z-10 text-center sm:text-right max-w-xl">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs font-semibold">
            خوارزمية التكرار المتباعد (Spaced Repetition)
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-white font-quran">تثبيت الحفظ والمراجعة الذكية</h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            نظام ذكي يجدول مراجعة الآيات التي تواجه صعوبة فيها على فترات زمنية محسوبة علمياً لضمان ترسخها في الذاكرة طويلة المدى.
          </p>
        </div>
        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl z-10 shrink-0">
          <Brain className="w-8 h-8 sm:w-12 sm:h-12" />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Clock className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-slate-400 font-semibold">مراجعات مستحقة اليوم</p>
            <h3 className="text-xl sm:text-2xl font-bold text-white">{dueCards.length} بطاقات</h3>
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-slate-400 font-semibold">بطاقات تم إتقانها</p>
            <h3 className="text-xl sm:text-2xl font-bold text-white">{cards.filter(c => c.status === 'mastered').length} بطاقات</h3>
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
            <Calendar className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-slate-400 font-semibold">إجمالي بطاقات المتابعة</p>
            <h3 className="text-xl sm:text-2xl font-bold text-white">{cards.length} بطاقات</h3>
          </div>
        </div>
      </div>

      {/* Active Review Session or List */}
      {activeCardId ? (
        (() => {
          const card = cards.find(c => c.id === activeCardId);
          if (!card) return null;
          const surah = QURAN_SURAHS.find(s => s.name === card.surahName);

          return (
            <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900 border border-emerald-500/40 space-y-4 sm:space-y-6 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-emerald-400">جلسة مراجعة تكرار متباعد</span>
                <button
                  onClick={() => { setActiveCardId(null); setShowAnswer(false); }}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer py-1 px-2"
                >
                  إلغاء الجلسة
                </button>
              </div>

              <div className="text-center space-y-4 py-4">
                <h3 className="text-2xl sm:text-3xl font-bold text-white font-quran">سورة {card.surahName}</h3>
                <p className="text-emerald-400 text-xs sm:text-sm font-semibold">{card.ayahReference}</p>

                <div className="p-4 sm:p-6 rounded-2xl bg-slate-850 border border-slate-800 max-w-2xl mx-auto space-y-4">
                  {!showAnswer ? (
                    <div className="space-y-4 py-6">
                      <p className="text-slate-300 text-xs sm:text-sm">استحضر في ذهنك الآيات واقرأها غيباً، ثم اضغط لعرض النص والتحقق.</p>
                      <button
                        onClick={() => setShowAnswer(true)}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors min-h-[44px] cursor-pointer"
                      >
                        إظهار النص للتأكد
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fadeIn">
                      <p className="text-xl sm:text-2xl font-quran text-emerald-200 leading-relaxed">
                        {surah?.ayahs[0]?.text || 'بسم الله الرحمن الرحيم...'}
                      </p>
                      <p className="text-xs text-slate-400 pt-2 border-t border-slate-800">كيف وجدت استحضارك لهذه الآيات؟</p>
                      <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
                        <button
                          onClick={() => handleRateCard(card.id, 'hard')}
                          className="flex-1 py-3 px-3 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 font-bold hover:bg-rose-600/30 transition-colors text-xs sm:text-sm min-h-[44px] cursor-pointer"
                        >
                          صعب (مراجعة غداً)
                        </button>
                        <button
                          onClick={() => handleRateCard(card.id, 'medium')}
                          className="flex-1 py-3 px-3 rounded-xl bg-amber-600/20 border border-amber-500/40 text-amber-300 font-bold hover:bg-amber-600/30 transition-colors text-xs sm:text-sm min-h-[44px] cursor-pointer"
                        >
                          متوسط (مراجعة خلال 3 أيام)
                        </button>
                        <button
                          onClick={() => handleRateCard(card.id, 'easy')}
                          className="flex-1 py-3 px-3 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-bold hover:bg-emerald-600/30 transition-colors text-xs sm:text-sm min-h-[44px] cursor-pointer"
                        >
                          متقن تماماً (أسبوع)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
            <h3 className="text-lg sm:text-xl font-bold text-white font-quran flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-400" />
              <span>البطاقات المستحقة للمراجعة اليوم</span>
            </h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                onChange={(e) => {
                  if (e.target.value) handleAddNewCard(e.target.value);
                  e.target.value = '';
                }}
                className="w-full sm:w-auto bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 min-h-[40px]"
              >
                <option value="">+ إضافة سورة للتكرار المتباعد</option>
                {QURAN_SURAHS.map(s => (
                  <option key={s.number} value={s.name}>سورة {s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {dueCards.map(card => (
              <div key={card.id} className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all shadow-md space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                    مستحقة اليوم
                  </span>
                  <span className="text-[11px] text-slate-400">فترة التكرار: {card.intervalDays} أيام</span>
                </div>
                <div>
                  <h4 className="text-lg sm:text-xl font-bold text-white font-quran">سورة {card.surahName}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{card.ayahReference}</p>
                </div>
                <button
                  onClick={() => { setActiveCardId(card.id); setShowAnswer(false); }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-bold hover:bg-emerald-600/30 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm min-h-[42px] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>بدء جلسة المراجعة</span>
                </button>
              </div>
            ))}
          </div>

          {upcomingCards.length > 0 && (
            <div className="pt-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-400">بطاقات قادمة في المواعيد اللاحقة</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {upcomingCards.map(card => (
                  <div key={card.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>سورة {card.surahName}</span>
                      <span>موعد المراجعة: {card.nextReviewDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
