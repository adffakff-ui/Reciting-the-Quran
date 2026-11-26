import React, { useState } from 'react';
import { Brain, Sparkles, CheckCircle2, XCircle, Award, RefreshCw, ChevronRight } from 'lucide-react';
import { QURAN_SURAHS } from '../data/quranData';
import confetti from 'canvas-confetti';

interface QuizQuestion {
  question: string;
  type: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export const HifzQuizView: React.FC = () => {
  const [selectedSurah, setSelectedSurah] = useState('الفاتحة');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const buildOfflineSurahQuiz = (surahName: string): QuizQuestion[] => {
    const surahObj = QURAN_SURAHS.find(s => s.name === surahName) || QURAN_SURAHS[0];
    const candidateAyahs = surahObj.ayahs.filter(a => a.text.trim().split(/\s+/).length >= 3);
    const pool = candidateAyahs.length > 0 ? candidateAyahs : surahObj.ayahs;
    const allWords = Array.from(
      new Set(
        surahObj.ayahs
          .flatMap(a => a.text.split(/\s+/))
          .map(w => w.replace(/[۝۞۩]/g, '').trim())
          .filter(w => w.length >= 3)
      )
    );
    const fallbackDistractors = ['ٱللَّهِ', 'ٱلرَّحْمَٰنِ', 'ٱلْحَكِيمِ', 'مُّبِينٌ', 'عَلِيمٌ', 'قَدِيرٌ'];

    const selectedAyahs = pool.slice(0, Math.min(3, pool.length));
    return selectedAyahs.map((ayah) => {
      const words = ayah.text.split(/\s+/).filter(Boolean);
      const targetIdx = Math.min(words.length - 1, Math.max(1, Math.floor(words.length / 2)));
      const targetWord = words[targetIdx];
      const maskedText = words.map((w, i) => (i === targetIdx ? '........' : w)).join(' ');

      const distractors: string[] = [];
      for (const candidate of [...allWords, ...fallbackDistractors]) {
        if (candidate !== targetWord && !distractors.includes(candidate)) {
          distractors.push(candidate);
        }
        if (distractors.length === 3) break;
      }
      const options = [targetWord, ...distractors].sort((a, b) => a.localeCompare(b, 'ar'));

      return {
        question: `أكمل الآية (${ayah.number}) من سورة ${surahObj.name}:\n(${maskedText})`,
        type: 'complete',
        options,
        correctAnswer: targetWord,
        explanation: `سورة ${surahObj.name} - الآية (${ayah.number}): ${ayah.text}`,
      };
    });
  };

  const generateQuiz = async () => {
    setLoading(true);
    setQuizFinished(false);
    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setQuestions(buildOfflineSurahQuiz(selectedSurah));
      setLoading(false);
      return;
    }

    try {
      const surahObj = QURAN_SURAHS.find(s => s.name === selectedSurah);
      const sampleAyahs = surahObj?.ayahs.slice(0, 12).map(a => `الآية (${a.number}): ${a.text}`) || [];

      const res = await fetch('/api/ai/hifz-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surahName: selectedSurah, ayahs: sampleAyahs }),
      });
      if (!res.ok) throw new Error('Quiz API error');
      const data = await res.json();
      if (data && data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
      } else {
        setQuestions(buildOfflineSurahQuiz(selectedSurah));
      }
    } catch {
      setQuestions(buildOfflineSurahQuiz(selectedSurah));
    } finally {
      setLoading(false);
    }
  };

  const handleOptionClick = (option: string) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(option);
  };

  const handleVerify = () => {
    if (!selectedOption) return;
    setIsAnswerSubmitted(true);
    const currentQ = questions[currentIndex];
    if (selectedOption === currentQ.correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setQuizFinished(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 animate-fadeIn w-full overflow-hidden">
      {/* Banner */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 sm:space-y-3 z-10 text-center sm:text-right max-w-xl">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs font-semibold">
            اختبارات الحفظ والتدبر الذكية
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-white font-quran">اختبر حفظك وثبّت آيات القرآن</h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            أسئلة ذكية مصممة خصيصاً لاختبار إتقانك للآيات، إكمال الفراغات، واختبار الربط بين الآيات.
          </p>
        </div>
        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl z-10 shrink-0">
          <Brain className="w-8 h-8 sm:w-12 sm:h-12" />
        </div>
      </div>

      {questions.length === 0 && !loading ? (
        <div className="p-5 sm:p-10 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6">
          <div className="max-w-md mx-auto space-y-4">
            <h3 className="text-lg sm:text-xl font-bold text-white font-quran">اختر السورة لبدء اختبار الحفظ</h3>
            <select
              value={selectedSurah}
              onChange={(e) => setSelectedSurah(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
            >
              {QURAN_SURAHS.map((s) => (
                <option key={s.number} value={s.name}>سورة {s.name}</option>
              ))}
            </select>
            <button
              onClick={generateQuiz}
              className="w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-900/40 hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
            >
              <Sparkles className="w-5 h-5" />
              <span>إنشاء اختبار الحفظ الذكي</span>
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
          <Sparkles className="w-10 h-10 text-emerald-400 animate-spin" />
          <p className="text-slate-300 font-bold">جاري تحضير أسئلة اختبار الحفظ الذكية...</p>
        </div>
      ) : quizFinished ? (
        <div className="p-6 sm:p-10 rounded-2xl sm:rounded-3xl bg-slate-900 border border-emerald-500/30 text-center space-y-6 animate-fadeIn">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
            <Award className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-bold text-white font-quran">أحسنت! أتممت الاختبار بنجاح</h3>
            <p className="text-slate-300 text-sm">لقد أجبت بشكل صحيح على <span className="text-emerald-400 font-bold text-lg">{score}</span> من <span className="text-white font-bold">{questions.length}</span> أسئلة.</p>
          </div>
          <button
            onClick={() => setQuestions([])}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-lg shadow-emerald-900/40 hover:from-emerald-500 hover:to-teal-500 transition-all inline-flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>اختبار جديد</span>
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-6 animate-fadeIn">
          {/* Progress Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-emerald-400">سورة {selectedSurah}</span>
            <span className="text-xs text-slate-400">السؤال {currentIndex + 1} من {questions.length}</span>
          </div>

          {/* Question */}
          <div className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-bold text-white font-quran leading-relaxed">
              {questions[currentIndex].question}
            </h3>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 pt-1">
              {questions[currentIndex].options.map((opt, idx) => {
                let btnStyle = 'bg-slate-800 border-slate-700 text-slate-200 hover:border-emerald-500/50';
                if (selectedOption === opt) {
                  btnStyle = 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md';
                }
                if (isAnswerSubmitted) {
                  if (opt === questions[currentIndex].correctAnswer) {
                    btnStyle = 'bg-emerald-600 text-white border-emerald-500 shadow-lg';
                  } else if (selectedOption === opt && opt !== questions[currentIndex].correctAnswer) {
                    btnStyle = 'bg-rose-600/20 border-rose-500 text-rose-300';
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(opt)}
                    className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border text-right font-quran text-base sm:text-lg transition-all flex items-center justify-between min-h-[48px] cursor-pointer ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {isAnswerSubmitted && opt === questions[currentIndex].correctAnswer && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    )}
                    {isAnswerSubmitted && selectedOption === opt && opt !== questions[currentIndex].correctAnswer && (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Explanation if submitted */}
          {isAnswerSubmitted && (
            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-850 border border-slate-800 space-y-1.5 animate-fadeIn">
              <p className="text-xs font-bold text-emerald-400">التوضيح والتصحيح:</p>
              <p className="text-xs sm:text-sm text-slate-300">{questions[currentIndex].explanation}</p>
            </div>
          )}

          {/* Action button */}
          <div className="flex justify-end pt-3 border-t border-slate-800">
            {!isAnswerSubmitted ? (
              <button
                onClick={handleVerify}
                disabled={!selectedOption}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-xl sm:rounded-2xl font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer ${
                  selectedOption 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500' 
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>تحقق من الإجابة</span>
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-lg shadow-emerald-900/40 hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
              >
                <span>{currentIndex + 1 < questions.length ? 'السؤال التالي' : 'عرض النتيجة النهائية'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
