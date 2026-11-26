import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollText,
  BookOpen,
  Search,
  Bookmark,
  CheckCircle2,
  Sparkles,
  Brain,
  Award,
  RefreshCw,
  Eye,
  EyeOff,
  Compass,
  Users,
  Hash,
  XCircle,
  Volume2,
  Square,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Gauge,
  ListOrdered,
  BookMarked,
  HardDriveDownload,
  Download,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AdhkarSheikh } from '../data/adhkarData';
import { SectionReciterBar } from './SectionReciterBar';
import {
  exportStandaloneOfflineBookHtml,
  saveKnowledgeBookOfflineSnapshot,
} from '../utils/offlineStorage';
import {
  RECITER_PREFERENCES_EVENT,
  getReciterPreferences,
  getSheikhById,
  pauseArabicSpeech,
  resumeArabicSpeech,
  setSectionDefaultReciter,
  speakArabicWithSheikh,
  stopArabicSpeech,
} from '../utils/reciterPreferences';
import {
  SEVEN_QURRA,
  SHATIBIYYAH_SYMBOLS,
  SHATIBIYYAH_CHAPTERS,
  SHATIBIYYAH_QUIZ_QUESTIONS,
  ShatibiyyahBayt,
  ShatibiyyahSymbol,
} from '../data/shatibiyyahData';

const SAVED_ABYAT_KEY = 'shatibiyyah_saved_abyat';
const MEMORIZED_ABYAT_KEY = 'shatibiyyah_memorized_abyat';

function normalizeSearch(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}

export const ShatibiyyahView: React.FC = () => {
  const [subTab, setSubTab] = useState<'chapters' | 'symbols' | 'quiz' | 'saved'>('chapters');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [symbolFilter, setSymbolFilter] = useState<'all' | 'individual' | 'group_letter' | 'group_word'>('all');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [decodedSymbol, setDecodedSymbol] = useState<ShatibiyyahSymbol | null>(null);
  const [expandedExplanations, setExpandedExplanations] = useState<Record<string, boolean>>({});
  const [showAllExplanations, setShowAllExplanations] = useState(true);
  const [speakingBaytId, setSpeakingBaytId] = useState<string | null>(null);
  const [isAutoplayingAll, setIsAutoplayingAll] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoContinue, setAutoContinue] = useState(true);
  const [readExplanation, setReadExplanation] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [offlineStatusNotice, setOfflineStatusNotice] = useState<string | null>(null);
  const [favoriteReciterIds, setFavoriteReciterIds] = useState<string[]>(() => getReciterPreferences().favoriteReciterIds);
  const [selectedSheikh, setSelectedSheikh] = useState<AdhkarSheikh>(() =>
    getSheikhById(getReciterPreferences().defaultShatibiyyahSheikhId)
  );

  const isCancelledRef = React.useRef(false);
  const nextTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedSheikhRef = React.useRef(selectedSheikh);
  const autoContinueRef = React.useRef(autoContinue);
  const readExplanationRef = React.useRef(readExplanation);
  const playbackSpeedRef = React.useRef(playbackSpeed);
  const isAutoplayingAllRef = React.useRef(isAutoplayingAll);
  const speakingBaytIdRef = React.useRef(speakingBaytId);

  selectedSheikhRef.current = selectedSheikh;
  autoContinueRef.current = autoContinue;
  readExplanationRef.current = readExplanation;
  playbackSpeedRef.current = playbackSpeed;
  isAutoplayingAllRef.current = isAutoplayingAll;
  speakingBaytIdRef.current = speakingBaytId;

  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_ABYAT_KEY);
      return raw ? JSON.parse(raw) : ['muq_1', 'muq_55', 'ist_95'];
    } catch {
      return ['muq_1', 'muq_55', 'ist_95'];
    }
  });

  const [memorizedIds, setMemorizedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(MEMORIZED_ABYAT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_ABYAT_KEY, JSON.stringify(savedIds));
    } catch {}
  }, [savedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(MEMORIZED_ABYAT_KEY, JSON.stringify(memorizedIds));
    } catch {}
  }, [memorizedIds]);

  useEffect(() => {
    const syncBackup = () => {
      try {
        const s = localStorage.getItem(SAVED_ABYAT_KEY);
        if (s) setSavedIds(JSON.parse(s));
        const m = localStorage.getItem(MEMORIZED_ABYAT_KEY);
        if (m) setMemorizedIds(JSON.parse(m));
      } catch {}
    };
    const syncPrefs = () => {
      const prefs = getReciterPreferences();
      setFavoriteReciterIds(prefs.favoriteReciterIds);
      setSelectedSheikh(getSheikhById(prefs.defaultShatibiyyahSheikhId));
    };
    window.addEventListener('murtal-backup-restored', syncBackup);
    window.addEventListener('murtal-backup-restored', syncPrefs);
    window.addEventListener(RECITER_PREFERENCES_EVENT, syncPrefs);
    return () => {
      window.removeEventListener('murtal-backup-restored', syncBackup);
      window.removeEventListener('murtal-backup-restored', syncPrefs);
      window.removeEventListener(RECITER_PREFERENCES_EVENT, syncPrefs);
      stopSequentialPlayback();
    };
  }, []);

  const totalAbyat = useMemo(
    () => SHATIBIYYAH_CHAPTERS.reduce((acc, ch) => acc + ch.abyat.length, 0),
    []
  );

  const toggleSaveBayt = (id: string) => {
    setSavedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleMemorizedBayt = (id: string) => {
    setMemorizedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleExplanation = (id: string) => {
    setExpandedExplanations((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? showAllExplanations),
    }));
  };

  const handleDecodeSymbolClick = (code: string) => {
    const normCode = normalizeSearch(code);
    const found = SHATIBIYYAH_SYMBOLS.find(
      (s) => normalizeSearch(s.code) === normCode || s.code === code
    );
    if (found) {
      setDecodedSymbol(found);
    }
  };

  const filteredChapters = useMemo(() => {
    const normQ = normalizeSearch(searchQuery);
    return SHATIBIYYAH_CHAPTERS.filter(
      (ch) => selectedChapterId === 'all' || ch.id === selectedChapterId
    )
      .map((ch) => ({
        ...ch,
        abyat: ch.abyat.filter((b) => {
          if (!normQ) return true;
          const haystack = normalizeSearch(
            `${b.sadr} ${b.ajuz} ${b.explanation} ${b.ruleSummary} ${b.number} ${(b.symbols || []).join(' ')}`
          );
          return haystack.includes(normQ);
        }),
      }))
      .filter((ch) => ch.abyat.length > 0);
  }, [selectedChapterId, searchQuery]);

  const savedAbyatList = useMemo(() => {
    const list: Array<{ chapterTitle: string; bayt: ShatibiyyahBayt }> = [];
    for (const ch of SHATIBIYYAH_CHAPTERS) {
      for (const b of ch.abyat) {
        if (savedIds.includes(b.id)) {
          list.push({ chapterTitle: ch.title, bayt: b });
        }
      }
    }
    return list;
  }, [savedIds]);

  const flattenedChapterAbyat = useMemo(() => {
    const list: Array<{ chapterTitle: string; bayt: ShatibiyyahBayt }> = [];
    for (const ch of filteredChapters) {
      for (const b of ch.abyat) {
        list.push({ chapterTitle: ch.title, bayt: b });
      }
    }
    return list;
  }, [filteredChapters]);

  const activePlayableList = subTab === 'saved' ? savedAbyatList : flattenedChapterAbyat;
  const activePlayableListRef = React.useRef(activePlayableList);
  activePlayableListRef.current = activePlayableList;

  const stopSequentialPlayback = () => {
    isCancelledRef.current = true;
    if (nextTimerRef.current !== null) {
      clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
    stopArabicSpeech();
    setSpeakingBaytId(null);
    setIsAutoplayingAll(false);
    setIsPaused(false);
  };

  const updateShatibiyyahMediaSession = (
    bayt: ShatibiyyahBayt,
    chapterTitle: string,
    sheikhName: string
  ) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `متن الشاطبية • بيت ${bayt.number}`,
        artist: sheikhName,
        album: chapterTitle,
      });
      navigator.mediaSession.setActionHandler('play', () => {
        if (isPaused) {
          resumeArabicSpeech();
          setIsPaused(false);
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        pauseArabicSpeech();
        setIsPaused(true);
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (speakingBaytIdRef.current) jumpByOffset(1);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (speakingBaytIdRef.current) jumpByOffset(-1);
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        stopSequentialPlayback();
      });
    } catch {}
  };

  const playBaytSequence = (
    bayt: ShatibiyyahBayt,
    continuousMode: boolean,
    sheikhOverride?: AdhkarSheikh
  ) => {
    if (nextTimerRef.current !== null) {
      clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
    isCancelledRef.current = false;
    const list = activePlayableListRef.current;
    const entry = list.find((item) => item.bayt.id === bayt.id);
    const chapterTitle = entry?.chapterTitle || 'متن الشاطبية';
    const activeSheikh = sheikhOverride || selectedSheikhRef.current;

    setSpeakingBaytId(bayt.id);
    setIsAutoplayingAll(continuousMode);
    setIsPaused(false);
    updateShatibiyyahMediaSession(bayt, chapterTitle, activeSheikh.name);

    const el = document.getElementById(`shatibiyyah-bayt-${bayt.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const spokenText = readExplanationRef.current
      ? `${bayt.sadr}، ${bayt.ajuz}. القاعدة: ${bayt.ruleSummary}. ${bayt.explanation}`
      : `${bayt.sadr}، ${bayt.ajuz}`;

    speakArabicWithSheikh(spokenText, activeSheikh, {
      speedMultiplier: playbackSpeedRef.current,
      onFallbackNotice: (msg) => setAudioNotice(msg),
      onEnd: () => {
        if (isCancelledRef.current) return;
        const shouldContinue = continuousMode || autoContinueRef.current;
        if (!shouldContinue) {
          setSpeakingBaytId(null);
          setIsAutoplayingAll(false);
          setIsPaused(false);
          return;
        }
        const currentList = activePlayableListRef.current;
        const idx = currentList.findIndex((item) => item.bayt.id === bayt.id);
        if (idx >= 0 && idx + 1 < currentList.length) {
          const nextItem = currentList[idx + 1];
          nextTimerRef.current = setTimeout(() => {
            if (!isCancelledRef.current) {
              playBaytSequence(nextItem.bayt, true, activeSheikh);
            }
          }, 350);
        } else {
          setSpeakingBaytId(null);
          setIsAutoplayingAll(false);
          setIsPaused(false);
          confetti({ particleCount: 45, spread: 55, origin: { y: 0.7 } });
        }
      },
      onError: () => {
        if (!isCancelledRef.current) {
          stopSequentialPlayback();
        }
      },
    });
  };

  const handleSpeakBayt = (bayt: ShatibiyyahBayt) => {
    if (speakingBaytId === bayt.id) {
      stopSequentialPlayback();
      return;
    }
    playBaytSequence(bayt, autoContinueRef.current);
  };

  const handleStartAutoplayAll = () => {
    if (isAutoplayingAll || speakingBaytId !== null) {
      stopSequentialPlayback();
      return;
    }
    const list = activePlayableListRef.current;
    if (list.length === 0) return;
    playBaytSequence(list[0].bayt, true);
  };

  const jumpByOffset = (delta: number) => {
    const list = activePlayableListRef.current;
    if (list.length === 0) return;
    const currentIdx = list.findIndex((item) => item.bayt.id === speakingBaytIdRef.current);
    const nextIdx = currentIdx < 0 ? 0 : currentIdx + delta;
    if (nextIdx >= 0 && nextIdx < list.length) {
      playBaytSequence(
        list[nextIdx].bayt,
        isAutoplayingAllRef.current || autoContinueRef.current
      );
    } else if (nextIdx >= list.length) {
      stopSequentialPlayback();
    }
  };

  const handleTogglePause = () => {
    if (speakingBaytId === null) return;
    if (isPaused) {
      resumeArabicSpeech();
      setIsPaused(false);
    } else {
      pauseArabicSpeech();
      setIsPaused(true);
    }
  };

  const handleCycleSpeed = () => {
    const speeds = [0.85, 1.0, 1.15];
    const idx = speeds.indexOf(playbackSpeed);
    const next = speeds[(idx === -1 ? 1 : idx + 1) % speeds.length];
    setPlaybackSpeed(next);
    playbackSpeedRef.current = next;
    if (speakingBaytIdRef.current) {
      const currentEntry = activePlayableListRef.current.find(
        (item) => item.bayt.id === speakingBaytIdRef.current
      );
      if (currentEntry) {
        playBaytSequence(
          currentEntry.bayt,
          isAutoplayingAllRef.current || autoContinueRef.current
        );
      }
    }
  };

  const filteredSymbols = useMemo(() => {
    const normQ = normalizeSearch(symbolSearch);
    return SHATIBIYYAH_SYMBOLS.filter((s) => {
      if (symbolFilter !== 'all' && s.type !== symbolFilter) return false;
      if (!normQ) return true;
      return normalizeSearch(`${s.code} ${s.standsFor} ${s.details}`).includes(normQ);
    });
  }, [symbolFilter, symbolSearch]);

  const handleSelectQuizAnswer = (idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    const currentQ = SHATIBIYYAH_QUIZ_QUESTIONS[quizIndex];
    if (idx === currentQ.correctIndex) {
      setQuizScore((prev) => prev + 1);
    }
  };

  const handleNextQuizQuestion = () => {
    if (quizIndex + 1 < SHATIBIYYAH_QUIZ_QUESTIONS.length) {
      setQuizIndex((prev) => prev + 1);
      setSelectedAnswer(null);
    } else {
      setQuizFinished(true);
      if (quizScore >= Math.ceil(SHATIBIYYAH_QUIZ_QUESTIONS.length / 2)) {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      }
    }
  };

  const handleRestartQuiz = () => {
    setQuizIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizFinished(false);
  };

  const renderBaytCard = (bayt: ShatibiyyahBayt, chapterLabel?: string) => {
    const isSaved = savedIds.includes(bayt.id);
    const isMemorized = memorizedIds.includes(bayt.id);
    const isExpanded = expandedExplanations[bayt.id] ?? showAllExplanations;
    const isSpeaking = speakingBaytId === bayt.id;

    return (
      <div
        key={bayt.id}
        id={`shatibiyyah-bayt-${bayt.id}`}
        className={`p-4 sm:p-6 rounded-2xl border transition-all space-y-3.5 ${
          isSpeaking
            ? 'bg-emerald-950/50 border-amber-400/70 ring-2 ring-amber-400/30 shadow-lg shadow-amber-950/20'
            : isMemorized
            ? 'bg-emerald-950/25 border-emerald-500/40'
            : 'bg-slate-950/75 border-slate-800 hover:border-emerald-500/30'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
              بيت {bayt.number}
            </span>
            {chapterLabel && (
              <span className="text-[11px] text-slate-400 font-semibold">{chapterLabel}</span>
            )}
            {bayt.symbols && bayt.symbols.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-500">الرموز:</span>
                {bayt.symbols.map((sym) => (
                  <button
                    key={sym}
                    onClick={() => handleDecodeSymbolClick(sym)}
                    className="px-2 py-0.5 rounded-md bg-teal-500/15 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 text-xs font-bold cursor-pointer transition-colors"
                    title="اضغط لمعرفة القراء المقصودين بهذا الرمز"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleSpeakBayt(bayt)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer min-h-[34px] transition-colors ${
                speakingBaytId === bayt.id
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-emerald-300 hover:text-white hover:border-emerald-500/40'
              }`}
              title={speakingBaytId === bayt.id ? 'إيقاف القراءة' : 'استماع للبيت'}
            >
              {speakingBaytId === bayt.id ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>إيقاف</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>استماع</span>
                </>
              )}
            </button>

            <button
              onClick={() => toggleExplanation(bayt.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer min-h-[34px]"
            >
              {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isExpanded ? 'إخفاء الشرح' : 'عرض الشرح'}</span>
            </button>

            <button
              onClick={() => toggleMemorizedBayt(bayt.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer min-h-[34px] transition-all ${
                isMemorized
                  ? 'bg-emerald-600/25 border-emerald-400/60 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="تحديد كمحفوظ"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isMemorized ? 'محفوظ' : 'حفظتُه'}</span>
            </button>

            <button
              onClick={() => toggleSaveBayt(bayt.id)}
              className={`p-2 rounded-xl border cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center transition-all ${
                isSaved
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-amber-300'
              }`}
              title="حفظ في المفضلة للمراجعة"
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Classic Two-Hemistich Poetry Layout */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 text-center items-center">
          <p className="font-quran text-xl sm:text-2xl text-white leading-loose tracking-wide">
            {bayt.sadr}
          </p>
          <p className="font-quran text-xl sm:text-2xl text-emerald-200 leading-loose tracking-wide md:border-r md:border-slate-800 md:pr-6">
            {bayt.ajuz}
          </p>
        </div>

        {isExpanded && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-emerald-500/20 space-y-1.5 text-xs sm:text-sm">
            <p className="text-emerald-300 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>القاعدة المستخلصة: {bayt.ruleSummary}</span>
            </p>
            <p className="text-slate-300 leading-relaxed">{bayt.explanation}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-7 animate-fadeIn w-full max-w-full overflow-x-hidden">
      {/* Header Banner */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-amber-950/30 border border-emerald-500/30 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2 text-right max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <ScrollText className="w-3.5 h-3.5" />
              <span>حرز الأماني ووجه التهاني في القراءات السبع</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white font-quran">
              متن الشاطبية للإمام القاسم الشاطبي
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              تصفح أهم أبواب منظومة الشاطبية بالشرح الميسر، وافهم رموز القراء السبعة ورواتهم الـ 14، وتابع حفظك للأبيات واختبر إتقانك لها بالكامل بدون إنترنت.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 shrink-0">
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[82px]">
              <span className="text-lg sm:text-xl font-bold text-emerald-400 block">7</span>
              <span className="text-[11px] text-slate-400">قراء و14 راوياً</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[82px]">
              <span className="text-lg sm:text-xl font-bold text-amber-400 block">
                {memorizedIds.length}/{totalAbyat}
              </span>
              <span className="text-[11px] text-slate-400">أبيات محفوظة</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[82px]">
              <span className="text-lg sm:text-xl font-bold text-teal-400 block">
                {savedIds.length}
              </span>
              <span className="text-[11px] text-slate-400">للمراجعة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decoded Symbol Toast / Modal Banner */}
      {decodedSymbol && (
        <div className="p-4 rounded-2xl bg-teal-950/80 border border-teal-400/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="px-3 py-1.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-sm shrink-0">
              {decodedSymbol.code}
            </span>
            <div className="space-y-0.5 text-xs sm:text-sm">
              <p className="font-bold text-white">يرمز إلى: {decodedSymbol.standsFor}</p>
              <p className="text-teal-200/80 text-xs">{decodedSymbol.details}</p>
            </div>
          </div>
          <button
            onClick={() => setDecodedSymbol(null)}
            className="self-end sm:self-center px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Audio / Offline Status Notices */}
      {audioNotice && (
        <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2">
          <span>{audioNotice}</span>
          <button onClick={() => setAudioNotice(null)} className="text-amber-300 font-bold px-2 cursor-pointer">✕</button>
        </div>
      )}
      {offlineStatusNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-2">
          <span>{offlineStatusNotice}</span>
          <button onClick={() => setOfflineStatusNotice(null)} className="text-emerald-300 font-bold px-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* Offline Version Strip */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-white">نسخة متن الشاطبية للعمل بدون إنترنت</p>
            <p className="text-[11px] text-slate-400">
              النصوص والشرح والرموز والاستماع الصوتي متاحة محلياً بدون إنترنت، مع إمكانية حفظ نسخة مستقلة على جهازك.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={async () => {
              await saveKnowledgeBookOfflineSnapshot('shatibiyyah');
              setOfflineStatusNotice('تم تثبيت وحفظ نسخة متن الشاطبية في ذاكرة الجهاز للعمل 100% بدون إنترنت.');
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer min-h-[38px]"
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            <span>حفظ نسخة أوفلاين</span>
          </button>
          <button
            onClick={() => {
              const fname = exportStandaloneOfflineBookHtml('shatibiyyah');
              setOfflineStatusNotice(`تم تنزيل كتاب الشاطبية الأوفلاين المستقل (${fname}) مع مشغل استماع مدمج.`);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold cursor-pointer min-h-[38px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تحميل نسخة مستقلة (HTML)</span>
          </button>
        </div>
      </div>

      {/* Preferred Sheikh Selector */}
      <SectionReciterBar
        sectionKey="shatibiyyah"
        sectionTitle="القارئ الافتراضي لقراءة أبيات الشاطبية"
        selectedSheikh={selectedSheikh}
        favoriteReciterIds={favoriteReciterIds}
        accent="amber"
        onPreferencesChange={(updated) => setFavoriteReciterIds(updated.favoriteReciterIds)}
        onSelectSheikh={(next) => {
          setSelectedSheikh(next);
          selectedSheikhRef.current = next;
          const updated = setSectionDefaultReciter('shatibiyyah', next.id);
          setFavoriteReciterIds(updated.favoriteReciterIds);
          if (speakingBaytIdRef.current) {
            const cur = activePlayableListRef.current.find(
              (item) => item.bayt.id === speakingBaytIdRef.current
            );
            if (cur) {
              playBaytSequence(
                cur.bayt,
                isAutoplayingAllRef.current || autoContinueRef.current,
                next
              );
            }
          }
        }}
      />

      {/* Sequential Master Playback Bar */}
      {(subTab === 'chapters' || subTab === 'saved') && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-emerald-500/25 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleStartAutoplayAll}
              disabled={activePlayableList.length === 0}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[42px] disabled:opacity-50 ${
                isAutoplayingAll || speakingBaytId !== null
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
              }`}
            >
              {isAutoplayingAll || speakingBaytId !== null ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>إيقاف التشغيل المتتتابع</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>تشغيل الشاطبية متتابعاً ({activePlayableList.length} بيتاً)</span>
                </>
              )}
            </button>

            <button
              onClick={() => setAutoContinue((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer min-h-[40px] ${
                autoContinue
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>التتابع التلقائي: {autoContinue ? 'مفعل' : 'معطل'}</span>
            </button>

            <button
              onClick={() => setReadExplanation((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer min-h-[40px] ${
                readExplanation
                  ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>قراءة الشرح بعد البيت: {readExplanation ? 'نعم' : 'لا'}</span>
            </button>
          </div>

          <button
            onClick={handleCycleSpeed}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 hover:border-emerald-500/40 text-xs font-bold cursor-pointer min-h-[40px] shrink-0"
          >
            <Gauge className="w-4 h-4 text-emerald-400" />
            <span>سرعة القراءة: {playbackSpeed}x</span>
          </button>
        </div>
      )}

      {/* Sticky Active Sequential Player */}
      {speakingBaytId !== null && (() => {
        const activeIdx = activePlayableList.findIndex((item) => item.bayt.id === speakingBaytId);
        const activeEntry = activeIdx >= 0 ? activePlayableList[activeIdx] : null;
        if (!activeEntry) return null;
        const pct = Math.round(((activeIdx + 1) / Math.max(1, activePlayableList.length)) * 100);
        return (
          <div className="sticky top-[104px] lg:top-[84px] z-30 p-3.5 sm:p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-amber-400/50 shadow-2xl space-y-2.5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                  <Volume2 className={`w-4 h-4 ${!isPaused ? 'animate-bounce' : ''}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-white truncate">
                    بيت {activeEntry.bayt.number} • {activeEntry.chapterTitle} ({activeIdx + 1} / {activePlayableList.length})
                  </p>
                  <p className="text-[11px] text-amber-300 truncate">{selectedSheikh.name}</p>
                </div>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-1.5 shrink-0">
                <button
                  onClick={() => jumpByOffset(-1)}
                  disabled={activeIdx <= 0}
                  className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white disabled:opacity-40 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                  title="البيت السابق"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  onClick={handleTogglePause}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer min-h-[38px]"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPaused ? 'استئناف' : 'إيقاف مؤقت'}</span>
                </button>
                <button
                  onClick={() => jumpByOffset(1)}
                  disabled={activeIdx + 1 >= activePlayableList.length}
                  className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white disabled:opacity-40 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                  title="البيت التالي"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={stopSequentialPlayback}
                  className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:text-white cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                  title="إنهاء التلاوة"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-amber-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'chapters' as const, label: 'أبواب الشاطبية والشرح', icon: BookOpen },
          { id: 'symbols' as const, label: 'دليل الرموز والقراء السبعة', icon: Compass },
          { id: 'quiz' as const, label: 'اختبار الرموز والأصول', icon: Brain },
          { id: 'saved' as const, label: `أبياتي المحفوظة (${savedAbyatList.length})`, icon: Bookmark },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[42px] ${
                active
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-emerald-500/40'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Chapters & Abyat */}
      {subTab === 'chapters' && (
        <div className="space-y-5">
          {/* Search & Filter Controls */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في الأبيات أو الشرح أو الرموز (مثل: ورش، البسملة، المد، الأضداد)..."
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={() => {
                  const nextVal = !showAllExplanations;
                  setShowAllExplanations(nextVal);
                  setExpandedExplanations({});
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 hover:border-emerald-500/40 text-xs font-bold cursor-pointer shrink-0 min-h-[42px]"
              >
                {showAllExplanations ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-emerald-400" />}
                <span>{showAllExplanations ? 'إخفاء جميع الشروح (وضع التسميع)' : 'إظهار جميع الشروح'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedChapterId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  selectedChapterId === 'all'
                    ? 'bg-emerald-600/25 border border-emerald-400/60 text-emerald-300'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                جميع الأبواب ({SHATIBIYYAH_CHAPTERS.length})
              </button>
              {SHATIBIYYAH_CHAPTERS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChapterId(ch.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    selectedChapterId === ch.id
                      ? 'bg-emerald-600/25 border border-emerald-400/60 text-emerald-300'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {ch.title}
                </button>
              ))}
            </div>
          </div>

          {/* Chapters List */}
          {filteredChapters.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
              لم يتم العثور على أبيات مطابقة لعبارة البحث.
            </div>
          ) : (
            <div className="space-y-6">
              {filteredChapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4"
                >
                  <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg sm:text-2xl font-bold text-white font-quran">
                          {chapter.title}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                          {chapter.range}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{chapter.description}</p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {chapter.abyat.map((bayt) => renderBaytCard(bayt))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Symbols & Seven Qaris */}
      {subTab === 'symbols' && (
        <div className="space-y-6">
          {/* Interactive Symbol Decoder */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-emerald-500/25 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white font-quran flex items-center gap-2">
                  <Hash className="w-5 h-5 text-teal-400" />
                  <span>فاحص ومفاتيح رموز الشاطبية (أبج دهز حطي كلم نصع فضق رست • ثخذ ظغش)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  ابحث عن أي رمز حرفي أو كلمي لمعرفة الإمام أو الراوي المقصود به في أبيات المنظومة.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={symbolSearch}
                  onChange={(e) => setSymbolSearch(e.target.value)}
                  placeholder="ابحث برمز أو اسم قارئ (مثل: ن، ث، سما، حرمي، ورش، حفص)..."
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all' as const, label: 'الكل' },
                  { id: 'individual' as const, label: 'الرموز الفردية (21)' },
                  { id: 'group_letter' as const, label: 'حروف الجمع (6)' },
                  { id: 'group_word' as const, label: 'الرموز الكلمية (8)' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSymbolFilter(f.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      symbolFilter === f.id
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSymbols.map((sym) => (
                <div
                  key={sym.code}
                  className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-teal-500/40 transition-all flex items-start gap-3"
                >
                  <div
                    className={`min-w-[44px] h-11 px-2.5 rounded-xl flex items-center justify-center font-bold text-base shrink-0 border ${
                      sym.type === 'group_word'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 text-sm'
                        : sym.type === 'group_letter'
                        ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                        : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    {sym.code}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs sm:text-sm font-bold text-white">{sym.standsFor}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{sym.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seven Qaris & 14 Rawis Cards */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg sm:text-xl font-bold text-white font-quran">
                الأئمة القراء السبعة ورواتهم الأربعة عشر
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SEVEN_QURRA.map((qari, idx) => (
                <div
                  key={qari.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] text-emerald-400 font-bold">
                        الإمام {idx + 1} • {qari.city}
                      </span>
                      <h4 className="text-base sm:text-lg font-bold text-white font-quran">
                        {qari.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">{qari.imamDescription}</p>
                    </div>
                    <span className="w-10 h-10 rounded-xl bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 font-bold text-lg flex items-center justify-center shrink-0">
                      {qari.imamSymbol}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-300">{qari.rawi1.name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                          {qari.rawi1.symbol}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{qari.rawi1.note}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-teal-300">{qari.rawi2.name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-bold">
                          {qari.rawi2.symbol}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{qari.rawi2.note}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Shatibiyyah Quiz */}
      {subTab === 'quiz' && (
        <div className="max-w-3xl mx-auto p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
          {!quizFinished ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-emerald-400">
                    السؤال {quizIndex + 1} من {SHATIBIYYAH_QUIZ_QUESTIONS.length}
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-white font-quran">
                    اختبار رموز وأصول متن الشاطبية
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  النتيجة: {quizScore}
                </span>
              </div>

              <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
                {SHATIBIYYAH_QUIZ_QUESTIONS[quizIndex].question}
              </p>

              <div className="space-y-2.5">
                {SHATIBIYYAH_QUIZ_QUESTIONS[quizIndex].options.map((opt, idx) => {
                  const isCorrect = idx === SHATIBIYYAH_QUIZ_QUESTIONS[quizIndex].correctIndex;
                  const isSelected = selectedAnswer === idx;
                  let btnClass =
                    'bg-slate-950 border-slate-800 text-slate-200 hover:border-emerald-500/50';
                  if (selectedAnswer !== null) {
                    if (isCorrect) {
                      btnClass = 'bg-emerald-950/60 border-emerald-500 text-emerald-200';
                    } else if (isSelected) {
                      btnClass = 'bg-rose-950/60 border-rose-500 text-rose-200';
                    } else {
                      btnClass = 'bg-slate-950/50 border-slate-800 text-slate-500';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectQuizAnswer(idx)}
                      disabled={selectedAnswer !== null}
                      className={`w-full p-4 rounded-2xl border text-right text-xs sm:text-sm font-bold flex items-center justify-between gap-3 transition-all cursor-pointer ${btnClass}`}
                    >
                      <span>{opt}</span>
                      {selectedAnswer !== null && isCorrect && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {selectedAnswer !== null && isSelected && !isCorrect && (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedAnswer !== null && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3">
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    <strong className="text-emerald-300">التوضيح: </strong>
                    {SHATIBIYYAH_QUIZ_QUESTIONS[quizIndex].explanation}
                  </p>
                  <button
                    onClick={handleNextQuizQuestion}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold cursor-pointer"
                  >
                    {quizIndex + 1 < SHATIBIYYAH_QUIZ_QUESTIONS.length
                      ? 'السؤال التالي'
                      : 'عرض النتيجة النهائية'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center mx-auto">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white font-quran">
                أحسنت! أتممت اختبار الشاطبية
              </h3>
              <p className="text-sm text-slate-300">
                نتيجتك: <strong className="text-emerald-400">{quizScore}</strong> من{' '}
                <strong>{SHATIBIYYAH_QUIZ_QUESTIONS.length}</strong>
              </p>
              <button
                onClick={handleRestartQuiz}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة الاختبار</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Saved Abyat */}
      {subTab === 'saved' && (
        <div className="space-y-4">
          {savedAbyatList.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
              <Bookmark className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm font-bold text-slate-300">لا توجد أبيات محفوظة للمراجعة بعد</p>
              <p className="text-xs text-slate-500">
                اضغط على أيقونة الحفظ بجانب أي بيت في أبواب الشاطبية لتثبيته هنا ومراجعته لاحقاً.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {savedAbyatList.map(({ chapterTitle, bayt }) => renderBaytCard(bayt, chapterTitle))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
