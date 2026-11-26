import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Search,
  Heart,
  RotateCcw,
  CheckCircle2,
  Volume2,
  Square,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Gauge,
  ListOrdered,
  HardDriveDownload,
  Download,
  Loader2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { HISN_CATEGORIES, HisnDhikr } from '../data/hisnAlMuslimData';
import { AdhkarSheikh } from '../data/adhkarData';
import { getReciterAyahAudioUrl } from '../data/quranData';
import { SectionReciterBar } from './SectionReciterBar';
import {
  downloadAudioPackOffline,
  exportStandaloneOfflineBookHtml,
  getHisnSheikhAudioUrls,
  resolvePlayableAudioSrc,
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

const HISN_COUNTERS_KEY = 'hisn_counters';
const HISN_FAVORITES_KEY = 'hisn_favorites';

function normalizeArabicSearch(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}

export const HisnAlMuslimView: React.FC = () => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAutoplayingAll, setIsAutoplayingAll] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoContinue, setAutoContinue] = useState(true);
  const [autoIncrementCounter, setAutoIncrementCounter] = useState(true);
  const [skipCompletedInSequence, setSkipCompletedInSequence] = useState(false);
  const [currentRepetition, setCurrentRepetition] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [offlineStatusNotice, setOfflineStatusNotice] = useState<string | null>(null);
  const [isCachingOfflineAudio, setIsCachingOfflineAudio] = useState(false);
  const [favoriteReciterIds, setFavoriteReciterIds] = useState<string[]>(() => getReciterPreferences().favoriteReciterIds);
  const [selectedSheikh, setSelectedSheikh] = useState<AdhkarSheikh>(() =>
    getSheikhById(getReciterPreferences().defaultHisnSheikhId)
  );

  const [counters, setCounters] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(HISN_COUNTERS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(HISN_FAVORITES_KEY);
      return raw ? JSON.parse(raw) : ['hw_4', 'ka_1', 'it_1'];
    } catch {
      return ['hw_4', 'ka_1', 'it_1'];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISN_COUNTERS_KEY, JSON.stringify(counters));
    } catch {}
  }, [counters]);

  useEffect(() => {
    try {
      localStorage.setItem(HISN_FAVORITES_KEY, JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    const syncBackup = () => {
      try {
        const c = localStorage.getItem(HISN_COUNTERS_KEY);
        if (c) setCounters(JSON.parse(c));
        const f = localStorage.getItem(HISN_FAVORITES_KEY);
        if (f) setFavorites(JSON.parse(f));
      } catch {}
    };
    const syncPrefs = () => {
      const prefs = getReciterPreferences();
      setFavoriteReciterIds(prefs.favoriteReciterIds);
      setSelectedSheikh(getSheikhById(prefs.defaultHisnSheikhId));
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

  const totalItemsCount = useMemo(
    () => HISN_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0),
    []
  );

  const completedItemsCount = useMemo(() => {
    let done = 0;
    for (const cat of HISN_CATEGORIES) {
      for (const item of cat.items) {
        if ((counters[item.id] || 0) >= item.count) {
          done += 1;
        }
      }
    }
    return done;
  }, [counters]);

  const handleIncrement = (item: HisnDhikr) => {
    const current = counters[item.id] || 0;
    if (current >= item.count) return;
    const next = current + 1;
    setCounters((prev) => ({ ...prev, [item.id]: next }));
    if (next === item.count) {
      confetti({ particleCount: 25, spread: 45, origin: { y: 0.7 } });
    }
  };

  const handleResetItem = (id: string) => {
    setCounters((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleResetAll = () => {
    setCounters({});
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCopy = async (item: HisnDhikr) => {
    try {
      await navigator.clipboard.writeText(`${item.title}\n${item.text}\n(${item.reference})`);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 2000);
    } catch {}
  };

  const filteredCategories = useMemo(() => {
    const q = normalizeArabicSearch(searchQuery);
    return HISN_CATEGORIES.filter(
      (cat) => selectedCategoryId === 'all' || cat.id === selectedCategoryId
    )
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => {
          if (showFavoritesOnly && !favorites.includes(item.id)) return false;
          if (!q) return true;
          return normalizeArabicSearch(
            `${item.title} ${item.text} ${item.reference} ${item.virtue || ''} ${cat.title}`
          ).includes(q);
        }),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [selectedCategoryId, showFavoritesOnly, searchQuery, favorites]);

  const flattenedItems = useMemo(() => {
    const list: Array<{ categoryTitle: string; item: HisnDhikr }> = [];
    for (const cat of filteredCategories) {
      for (const item of cat.items) {
        list.push({ categoryTitle: cat.title, item });
      }
    }
    return list;
  }, [filteredCategories]);

  const isCancelledRef = React.useRef(false);
  const nextTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const currentRevokeRef = React.useRef<(() => void) | null>(null);
  const selectedSheikhRef = React.useRef(selectedSheikh);
  const autoContinueRef = React.useRef(autoContinue);
  const autoIncrementRef = React.useRef(autoIncrementCounter);
  const skipCompletedRef = React.useRef(skipCompletedInSequence);
  const playbackSpeedRef = React.useRef(playbackSpeed);
  const isAutoplayingAllRef = React.useRef(isAutoplayingAll);
  const speakingIdRef = React.useRef(speakingId);
  const countersRef = React.useRef(counters);
  const flattenedItemsRef = React.useRef(flattenedItems);
  const currentRepRef = React.useRef(currentRepetition);

  selectedSheikhRef.current = selectedSheikh;
  autoContinueRef.current = autoContinue;
  autoIncrementRef.current = autoIncrementCounter;
  skipCompletedRef.current = skipCompletedInSequence;
  playbackSpeedRef.current = playbackSpeed;
  isAutoplayingAllRef.current = isAutoplayingAll;
  speakingIdRef.current = speakingId;
  countersRef.current = counters;
  flattenedItemsRef.current = flattenedItems;
  currentRepRef.current = currentRepetition;

  const clearMedia = () => {
    if (nextTimerRef.current !== null) {
      clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (currentRevokeRef.current) {
      currentRevokeRef.current();
      currentRevokeRef.current = null;
    }
    stopArabicSpeech();
  };

  const stopSequentialPlayback = () => {
    isCancelledRef.current = true;
    clearMedia();
    setSpeakingId(null);
    setIsAutoplayingAll(false);
    setIsPaused(false);
    setCurrentRepetition(1);
  };

  const updateHisnMediaSession = (
    item: HisnDhikr,
    categoryTitle: string,
    sheikhName: string
  ) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.title,
        artist: sheikhName,
        album: `حصن المسلم • ${categoryTitle}`,
      });
      navigator.mediaSession.setActionHandler('play', () => {
        if (isPaused) handleTogglePause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (!isPaused) handleTogglePause();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (speakingIdRef.current) jumpByOffset(1);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (speakingIdRef.current) jumpByOffset(-1);
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        stopSequentialPlayback();
      });
    } catch {}
  };

  const playHisnItem = (
    item: HisnDhikr,
    rep = 1,
    autoplaySeq = false,
    sheikhOverride?: AdhkarSheikh
  ) => {
    clearMedia();
    isCancelledRef.current = false;

    const activeSheikh = sheikhOverride || selectedSheikhRef.current;
    const maxReps = Math.min(item.count, 3);
    const list = flattenedItemsRef.current;
    const entry = list.find((e) => e.item.id === item.id);

    setSpeakingId(item.id);
    setIsAutoplayingAll(autoplaySeq);
    setIsPaused(false);
    setCurrentRepetition(rep);
    updateHisnMediaSession(item, entry?.categoryTitle || 'حصن المسلم', activeSheikh.name);

    const el = document.getElementById(`hisn-item-${item.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const handleFinishedRepetition = () => {
      if (isCancelledRef.current) return;
      if (autoIncrementRef.current) {
        handleIncrement(item);
      }

      if (rep < maxReps) {
        nextTimerRef.current = setTimeout(() => {
          if (!isCancelledRef.current) {
            playHisnItem(item, rep + 1, autoplaySeq, activeSheikh);
          }
        }, 450);
        return;
      }

      const shouldContinue = autoplaySeq || autoContinueRef.current;
      if (!shouldContinue) {
        setSpeakingId(null);
        setIsAutoplayingAll(false);
        setIsPaused(false);
        setCurrentRepetition(1);
        return;
      }

      const currentList = flattenedItemsRef.current;
      const curIdx = currentList.findIndex((e) => e.item.id === item.id);
      let nextIdx = curIdx + 1;
      if (skipCompletedRef.current) {
        while (
          nextIdx < currentList.length &&
          (countersRef.current[currentList[nextIdx].item.id] || 0) >=
            currentList[nextIdx].item.count
        ) {
          nextIdx += 1;
        }
      }

      if (curIdx >= 0 && nextIdx < currentList.length) {
        const nextItem = currentList[nextIdx].item;
        nextTimerRef.current = setTimeout(() => {
          if (!isCancelledRef.current) {
            playHisnItem(nextItem, 1, true, activeSheikh);
          }
        }, 550);
      } else {
        setSpeakingId(null);
        setIsAutoplayingAll(false);
        setIsPaused(false);
        setCurrentRepetition(1);
        confetti({ particleCount: 55, spread: 60, origin: { y: 0.7 } });
      }
    };

    const runSpeech = () => {
      if (isCancelledRef.current) return;
      speakArabicWithSheikh(`${item.title}. ${item.text}`, activeSheikh, {
        speedMultiplier: playbackSpeedRef.current,
        onFallbackNotice: (msg) => setAudioNotice(msg),
        onEnd: handleFinishedRepetition,
        onError: () => {
          if (!isCancelledRef.current) stopSequentialPlayback();
        },
      });
    };

    // Authentic Sheikh MP3 audio when item is Ayat Al-Kursi (hw_4 -> Surah 2 Ayah 255)
    if (item.id === 'hw_4') {
      const ayahUrl = activeSheikh.everyayahFolder
        ? getReciterAyahAudioUrl(activeSheikh.everyayahFolder, 2, 255)
        : `https://cdn.islamic.network/quran/audio/${activeSheikh.bitrate || 128}/${activeSheikh.subfolder}/262.mp3`;
      resolvePlayableAudioSrc(ayahUrl)
        .then(({ src, revoke }) => {
          if (isCancelledRef.current) {
            revoke?.();
            return;
          }
          if (revoke) currentRevokeRef.current = revoke;
          const audio = new Audio(src);
          audio.playbackRate = playbackSpeedRef.current;
          currentAudioRef.current = audio;
          audio.onended = () => {
            if (currentRevokeRef.current) {
              currentRevokeRef.current();
              currentRevokeRef.current = null;
            }
            handleFinishedRepetition();
          };
          audio.onerror = runSpeech;
          audio.play().catch(runSpeech);
        })
        .catch(runSpeech);
      return;
    }

    runSpeech();
  };

  const handleSpeak = (item: HisnDhikr) => {
    if (speakingId === item.id) {
      stopSequentialPlayback();
      return;
    }
    playHisnItem(item, 1, autoContinueRef.current);
  };

  const handleStartAutoplayAll = () => {
    if (isAutoplayingAll || speakingId !== null) {
      stopSequentialPlayback();
      return;
    }
    const list = flattenedItemsRef.current;
    if (list.length === 0) return;
    const firstCandidate =
      (skipCompletedRef.current
        ? list.find((e) => (countersRef.current[e.item.id] || 0) < e.item.count)
        : list[0]) || list[0];
    playHisnItem(firstCandidate.item, 1, true);
  };

  const jumpByOffset = (delta: number) => {
    const list = flattenedItemsRef.current;
    if (list.length === 0) return;
    const curIdx = list.findIndex((e) => e.item.id === speakingIdRef.current);
    const nextIdx = curIdx < 0 ? 0 : curIdx + delta;
    if (nextIdx >= 0 && nextIdx < list.length) {
      playHisnItem(
        list[nextIdx].item,
        1,
        isAutoplayingAllRef.current || autoContinueRef.current
      );
    } else if (nextIdx >= list.length) {
      stopSequentialPlayback();
    }
  };

  const handleTogglePause = () => {
    if (currentAudioRef.current) {
      if (isPaused) {
        currentAudioRef.current.play().catch(() => {});
        setIsPaused(false);
      } else {
        currentAudioRef.current.pause();
        setIsPaused(true);
      }
      return;
    }
    if (speakingId === null) return;
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
    if (currentAudioRef.current) {
      currentAudioRef.current.playbackRate = next;
    } else if (speakingIdRef.current) {
      const entry = flattenedItemsRef.current.find(
        (e) => e.item.id === speakingIdRef.current
      );
      if (entry) {
        playHisnItem(
          entry.item,
          currentRepRef.current,
          isAutoplayingAllRef.current || autoContinueRef.current
        );
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-7 animate-fadeIn w-full max-w-full overflow-x-hidden">
      {/* Banner */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2 text-right max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>من أذكار الكتاب والسنة الصحيحة</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white font-quran">
              حصن المسلم — الأذكار والأدعية اليومية
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              موسوعة شاملة لأدعية وأذكار اليوم والليلة مصحوبة بالتخريج النبوي، مع عداد تسبيح تفاعلي، وقراءة صوتية، وقائمة مفضلة تعمل بالكامل بدون إنترنت.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 shrink-0">
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[82px]">
              <span className="text-lg sm:text-xl font-bold text-emerald-400 block">
                {HISN_CATEGORIES.length}
              </span>
              <span className="text-[11px] text-slate-400">أبواب رئيسية</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[82px]">
              <span className="text-lg sm:text-xl font-bold text-amber-400 block">
                {completedItemsCount}/{totalItemsCount}
              </span>
              <span className="text-[11px] text-slate-400">أذكار منجزة</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[82px]">
              <span className="text-lg sm:text-xl font-bold text-rose-400 block">
                {favorites.length}
              </span>
              <span className="text-[11px] text-slate-400">في المفضلة</span>
            </div>
          </div>
        </div>
      </div>

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
            <p className="text-xs sm:text-sm font-bold text-white">نسخة حصن المسلم للعمل بدون إنترنت</p>
            <p className="text-[11px] text-slate-400">
              جميع الأبواب والأدعية والعداد التفاعلي محفوظة للعمل بدون إنترنت، ويمكنك حفظ الصوتيات والكتاب كاملاً محلياً.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            disabled={isCachingOfflineAudio}
            onClick={async () => {
              setIsCachingOfflineAudio(true);
              try {
                await saveKnowledgeBookOfflineSnapshot('hisn');
                if (typeof navigator === 'undefined' || navigator.onLine) {
                  const urls = getHisnSheikhAudioUrls(selectedSheikh);
                  await downloadAudioPackOffline(
                    {
                      id: `hisn_audio_${selectedSheikh.id}`,
                      type: 'hisn',
                      title: `صوتيات حصن المسلم — ${selectedSheikh.name}`,
                      subtitle: 'آية الكرسي والمعوذات بصوت الشيخ للعمل بدون إنترنت',
                      reciterName: selectedSheikh.name,
                      urls,
                      ayahCount: urls.length,
                    },
                    () => {}
                  );
                }
                setOfflineStatusNotice(`تم حفظ نسخة حصن المسلم وتلاوات ${selectedSheikh.name} للعمل 100% بدون إنترنت.`);
              } catch {
                setOfflineStatusNotice('تم حفظ نصوص حصن المسلم للعمل بدون إنترنت.');
              } finally {
                setIsCachingOfflineAudio(false);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer min-h-[38px] disabled:opacity-60"
          >
            {isCachingOfflineAudio ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <HardDriveDownload className="w-3.5 h-3.5" />
            )}
            <span>{isCachingOfflineAudio ? 'جاري الحفظ...' : 'حفظ أوفلاين + الصوتيات'}</span>
          </button>
          <button
            onClick={() => {
              const fname = exportStandaloneOfflineBookHtml('hisn');
              setOfflineStatusNotice(`تم تنزيل كتاب حصن المسلم الأوفلاين المستقل (${fname}) مع مشغل استماع مدمج.`);
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
        sectionKey="hisn"
        sectionTitle="القارئ الافتراضي لقراءة حصن المسلم"
        selectedSheikh={selectedSheikh}
        favoriteReciterIds={favoriteReciterIds}
        accent="teal"
        onPreferencesChange={(updated) => setFavoriteReciterIds(updated.favoriteReciterIds)}
        onSelectSheikh={(next) => {
          setSelectedSheikh(next);
          selectedSheikhRef.current = next;
          const updated = setSectionDefaultReciter('hisn', next.id);
          setFavoriteReciterIds(updated.favoriteReciterIds);
          if (speakingIdRef.current) {
            const entry = flattenedItemsRef.current.find(
              (it) => it.item.id === speakingIdRef.current
            );
            if (entry) {
              playHisnItem(
                entry.item,
                currentRepRef.current,
                isAutoplayingAllRef.current || autoContinueRef.current,
                next
              );
            }
          }
        }}
      />

      {/* Sequential Master Playback Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-emerald-500/25 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleStartAutoplayAll}
            disabled={flattenedItems.length === 0}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[42px] disabled:opacity-50 ${
              isAutoplayingAll || speakingId !== null
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
            }`}
          >
            {isAutoplayingAll || speakingId !== null ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>إيقاف التشغيل المتتتابع</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span className="truncate">تشغيل كافة أذكار حصن المسلم ({flattenedItems.length}) · {selectedSheikh.name}</span>
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
            onClick={() => setAutoIncrementCounter((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer min-h-[40px] ${
              autoIncrementCounter
                ? 'bg-teal-600/20 border-teal-500/40 text-teal-300'
                : 'bg-slate-950 border-slate-700 text-slate-400'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>احتساب العداد: {autoIncrementCounter ? 'تلقائي' : 'يدوي'}</span>
          </button>

          <button
            onClick={() => setSkipCompletedInSequence((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer min-h-[40px] ${
              skipCompletedInSequence
                ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-950 border-slate-700 text-slate-400'
            }`}
          >
            <span>تخطي المنجزة: {skipCompletedInSequence ? 'نعم' : 'لا'}</span>
          </button>
        </div>

        <button
          onClick={handleCycleSpeed}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 hover:border-emerald-500/40 text-xs font-bold cursor-pointer min-h-[40px] shrink-0"
        >
          <Gauge className="w-4 h-4 text-emerald-400" />
          <span>السرعة: {playbackSpeed}x</span>
        </button>
      </div>

      {/* Sticky Active Sequential Player */}
      {speakingId !== null && (() => {
        const activeIdx = flattenedItems.findIndex((e) => e.item.id === speakingId);
        const activeEntry = activeIdx >= 0 ? flattenedItems[activeIdx] : null;
        if (!activeEntry) return null;
        const maxReps = Math.min(activeEntry.item.count, 3);
        const pct = Math.round(((activeIdx + 1) / Math.max(1, flattenedItems.length)) * 100);
        return (
          <div className="sticky top-[104px] lg:top-[84px] z-30 p-3.5 sm:p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-amber-400/50 shadow-2xl space-y-2.5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                  <Volume2 className={`w-4 h-4 ${!isPaused ? 'animate-bounce' : ''}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-white truncate">
                    {activeEntry.item.title} • ({activeIdx + 1} / {flattenedItems.length})
                  </p>
                  <p className="text-[11px] text-amber-300 truncate">
                    {selectedSheikh.name} • التكرار {currentRepetition} من {maxReps}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-1.5 shrink-0">
                <button
                  onClick={() => jumpByOffset(-1)}
                  disabled={activeIdx <= 0}
                  className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white disabled:opacity-40 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                  title="الذكر السابق"
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
                  disabled={activeIdx + 1 >= flattenedItems.length}
                  className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white disabled:opacity-40 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                  title="الذكر التالي"
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

      {/* Search & Category Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في حصن المسلم (مثل: الاستغفار، الكرب، النوم، السفر، المسجد)..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer min-h-[42px] shrink-0 ${
              showFavoritesOnly
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : 'bg-slate-950 border-slate-700 text-slate-300'
            }`}
          >
            <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            <span>المفضلة ({favorites.length})</span>
          </button>

          {completedItemsCount > 0 && (
            <button
              onClick={handleResetAll}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold cursor-pointer min-h-[42px] shrink-0"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>تصفير العدادات</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              selectedCategoryId === 'all'
                ? 'bg-emerald-600/25 border border-emerald-400/60 text-emerald-300'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            جميع الأبواب ({HISN_CATEGORIES.length})
          </button>
          {HISN_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                selectedCategoryId === cat.id
                  ? 'bg-emerald-600/25 border border-emerald-400/60 text-emerald-300'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>
      </div>

      {/* Categories & Adhkar Cards */}
      {filteredCategories.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
          لا توجد أذكار مطابقة للبحث الحالي.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4"
            >
              <div className="border-b border-slate-800 pb-3.5 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg sm:text-2xl font-bold text-white font-quran flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{cat.title}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{cat.subtitle}</p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-emerald-300 shrink-0">
                  {cat.items.length} أذكار
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {cat.items.map((item) => {
                  const countVal = counters[item.id] || 0;
                  const isDone = countVal >= item.count;
                  const isFav = favorites.includes(item.id);
                  const isSpeaking = speakingId === item.id;
                  const pct = Math.min(100, Math.round((countVal / item.count) * 100));

                  return (
                    <div
                      key={item.id}
                      id={`hisn-item-${item.id}`}
                      className={`p-4 sm:p-6 rounded-2xl border transition-all space-y-3.5 ${
                        isSpeaking
                          ? 'bg-emerald-950/50 border-amber-400/70 ring-2 ring-amber-400/30 shadow-lg shadow-amber-950/20'
                          : isDone
                          ? 'bg-emerald-950/25 border-emerald-500/40'
                          : 'bg-slate-950/75 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm sm:text-base font-bold text-emerald-300">
                              {item.title}
                            </h4>
                            <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-400">
                              {item.reference}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block truncate">
                            {item.id === 'hw_4' ? 'تلاوة قرآنية' : 'قراءة مأثورة'} · {selectedSheikh.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleSpeak(item)}
                            className={`px-2.5 py-2 rounded-xl border cursor-pointer min-h-[36px] flex items-center justify-center gap-1.5 text-xs font-bold ${
                              isSpeaking
                                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                            }`}
                            title={isSpeaking ? 'إيقاف القراءة' : `استماع بصوت ${selectedSheikh.name}`}
                          >
                            {isSpeaking ? (
                              <>
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>إيقاف</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>استماع</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleCopy(item)}
                            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                            title="نسخ الذكر"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => toggleFavorite(item.id)}
                            className={`p-2 rounded-xl border cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center ${
                              isFav
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-rose-300'
                            }`}
                            title="إضافة للمفضلة"
                          >
                            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>

                      <p className="font-quran text-xl sm:text-2xl text-white leading-loose bg-slate-900/70 p-4 rounded-xl border border-slate-800/80">
                        {item.text}
                      </p>

                      {item.virtue && (
                        <p className="text-xs text-amber-300/90 flex items-start gap-1.5 leading-relaxed">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{item.virtue}</span>
                        </p>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="flex-1 space-y-1">
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-200 ${
                                isDone ? 'bg-emerald-400' : 'bg-teal-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 block">
                            التكرار: {countVal} من {item.count}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {countVal > 0 && (
                            <button
                              onClick={() => handleResetItem(item.id)}
                              className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
                              title="تصفير هذا الذكر"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleIncrement(item)}
                            disabled={isDone}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[42px] active:scale-95 ${
                              isDone
                                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 cursor-default'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {isDone
                                ? 'اكتمل بحمد الله'
                                : `تسبيح (${item.count - countVal} متبقٍ)`}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
