import React, { useState, useEffect, useRef } from 'react';
import { 
  Sun, Moon, CheckCircle2, RotateCcw, Volume2, 
  Pause, Play, Square, SkipForward, SkipBack, Gauge, 
  Headphones, UserCheck, Check, Radio, Star
} from 'lucide-react';
import { ADHKAR_LIST, ADHKAR_SHEIKHS, DhikrItem, AdhkarSheikh } from '../data/adhkarData';
import { prefetchAudioToCache, resolvePlayableAudioSrc } from '../utils/offlineStorage';
import {
  RECITER_PREFERENCES_EVENT,
  formatSheikhOptionLabel,
  getReciterPreferences,
  getSheikhById,
  setSectionDefaultReciter,
  sortWithFavoritesFirst,
  toggleFavoriteReciter,
} from '../utils/reciterPreferences';
import confetti from 'canvas-confetti';

export const AdhkarView: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'morning' | 'evening'>('morning');
  const [favoriteReciterIds, setFavoriteReciterIds] = useState<string[]>(() => getReciterPreferences().favoriteReciterIds);
  const [selectedSheikh, setSelectedSheikh] = useState<AdhkarSheikh>(() => {
    try {
      const prefs = getReciterPreferences();
      return getSheikhById(prefs.defaultAdhkarSheikhId);
    } catch {
      return ADHKAR_SHEIKHS[0];
    }
  });
  const [counters, setCounters] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('adhkar_counters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Audio Playback States
  const [playingDhikrId, setPlayingDhikrId] = useState<string | null>(null);
  const [isAutoplayingAll, setIsAutoplayingAll] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('adhkar_playback_speed');
      const parsed = saved ? parseFloat(saved) : 0.9;
      return [0.85, 0.9, 1.0, 1.2].includes(parsed) ? parsed : 0.9;
    } catch {
      return 0.9;
    }
  });
  const [currentRepetition, setCurrentRepetition] = useState<number>(1);
  const [autoIncrementCounter, setAutoIncrementCounter] = useState(true);
  const [skipCompletedInSequence, setSkipCompletedInSequence] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);

  // References to avoid stale closures inside audio callbacks
  const isCancelledRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentRevokeRef = useRef<(() => void) | null>(null);
  const preloadedAudioRef = useRef<{ url: string; audio: HTMLAudioElement } | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechPendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechSessionTokenRef = useRef(0);
  const selectedSheikhRef = useRef(selectedSheikh);
  const playbackSpeedRef = useRef(playbackSpeed);
  const autoIncrementRef = useRef(autoIncrementCounter);
  const isAutoplayingAllRef = useRef(isAutoplayingAll);
  const skipCompletedRef = useRef(skipCompletedInSequence);
  const countersRef = useRef(counters);
  const playingDhikrIdRef = useRef(playingDhikrId);

  selectedSheikhRef.current = selectedSheikh;
  playbackSpeedRef.current = playbackSpeed;
  autoIncrementRef.current = autoIncrementCounter;
  isAutoplayingAllRef.current = isAutoplayingAll;
  skipCompletedRef.current = skipCompletedInSequence;
  countersRef.current = counters;
  playingDhikrIdRef.current = playingDhikrId;

  const filteredAdhkar = ADHKAR_LIST.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'morning') return item.category === 'morning' || item.category === 'both';
    return item.category === 'evening' || item.category === 'both';
  });

  // Save preferences & counters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('adhkar_counters', JSON.stringify(counters));
    } catch (e) {
      console.error(e);
    }
  }, [counters]);

  useEffect(() => {
    try {
      localStorage.setItem('adhkar_sheikh_id', selectedSheikh.id);
    } catch (e) {
      console.error(e);
    }
  }, [selectedSheikh]);

  useEffect(() => {
    try {
      localStorage.setItem('adhkar_playback_speed', String(playbackSpeed));
    } catch (e) {
      console.error(e);
    }
  }, [playbackSpeed]);

  // Sync with global favorite & default reciter settings + clean up audio on unmount
  useEffect(() => {
    const syncPrefs = () => {
      const prefs = getReciterPreferences();
      setFavoriteReciterIds(prefs.favoriteReciterIds);
      const nextSheikh = getSheikhById(prefs.defaultAdhkarSheikhId);
      setSelectedSheikh(nextSheikh);
      selectedSheikhRef.current = nextSheikh;
    };
    window.addEventListener(RECITER_PREFERENCES_EVENT, syncPrefs);
    window.addEventListener('murtal-backup-restored', syncPrefs);
    return () => {
      window.removeEventListener(RECITER_PREFERENCES_EVENT, syncPrefs);
      window.removeEventListener('murtal-backup-restored', syncPrefs);
      stopAudio();
    };
  }, []);

  const handleIncrement = (id: string, targetCount: number) => {
    setCounters(prev => {
      const current = prev[id] || 0;
      if (current < targetCount) {
        const next = current + 1;
        if (next === targetCount) {
          confetti({ particleCount: 30, spread: 45, origin: { y: 0.8 } });
        }
        return { ...prev, [id]: next };
      }
      return prev;
    });
  };

  const handleReset = (id: string) => {
    setCounters(prev => ({ ...prev, [id]: 0 }));
  };

  // Helper to clean Arabic text for Speech Synthesis
  const sanitizeForSpeech = (text: string) => {
    return text
      .replace(/[۝۞۩]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Find best Arabic voice
  const getArabicVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find(v => v.lang.startsWith('ar') && (v.name.includes('Arabic') || v.name.includes('Natural') || v.name.includes('Maged') || v.name.includes('Tarık'))) ||
      voices.find(v => v.lang.startsWith('ar')) ||
      null
    );
  };

  // Stop Audio Completely
  const stopAudio = () => {
    isCancelledRef.current = true;
    speechSessionTokenRef.current += 1;
    if (speechPendingTimerRef.current !== null) {
      clearTimeout(speechPendingTimerRef.current);
      speechPendingTimerRef.current = null;
    }
    if (speechUtteranceRef.current) {
      speechUtteranceRef.current.onend = null;
      speechUtteranceRef.current.onerror = null;
      speechUtteranceRef.current = null;
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
    if (preloadedAudioRef.current) {
      preloadedAudioRef.current.audio.src = '';
      preloadedAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setPlayingDhikrId(null);
    setIsAutoplayingAll(false);
    setIsPaused(false);
    setCurrentRepetition(1);
  };

  // Resolve authentic audio URL for Quranic adhkar based on Sheikh configuration (prefers CORS EveryAyah CDN)
  const getSheikhAyahUrl = (sheikh: AdhkarSheikh, item: DhikrItem, ayahIdx: number): string | null => {
    if (sheikh.everyayahFolder && item.quranVerseRefs && item.quranVerseRefs[ayahIdx]) {
      return `https://everyayah.com/data/${sheikh.everyayahFolder}/${item.quranVerseRefs[ayahIdx]}.mp3`;
    }
    if (sheikh.bitrate && item.quranAyahNumbers && item.quranAyahNumbers[ayahIdx]) {
      return `https://cdn.islamic.network/quran/audio/${sheikh.bitrate}/${sheikh.subfolder}/${item.quranAyahNumbers[ayahIdx]}.mp3`;
    }
    return null;
  };

  const preloadNextDhikrAudio = (currentId: string, sheikh: AdhkarSheikh) => {
    const idx = filteredAdhkar.findIndex(d => d.id === currentId);
    if (idx < 0 || idx + 1 >= filteredAdhkar.length) return;
    const nextItem = filteredAdhkar[idx + 1];
    const nextUrl = getSheikhAyahUrl(sheikh, nextItem, 0);
    if (!nextUrl) return;
    void prefetchAudioToCache(nextUrl);
    if (preloadedAudioRef.current?.url === nextUrl) return;
    const pre = new Audio();
    pre.preload = 'auto';
    pre.src = nextUrl;
    preloadedAudioRef.current = { url: nextUrl, audio: pre };
  };

  const updateAdhkarMediaSession = (item: DhikrItem, sheikhName: string) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.title,
        artist: sheikhName,
        album: 'أذكار الصباح والمساء • مرتل القرآن الذكي',
      });
      navigator.mediaSession.setActionHandler('play', () => {
        handleTogglePause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        handleTogglePause();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (playingDhikrIdRef.current) {
          moveToNextSequentialDhikr(playingDhikrIdRef.current, selectedSheikhRef.current);
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (playingDhikrIdRef.current) {
          moveToPrevSequentialDhikr(playingDhikrIdRef.current);
        }
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        stopAudio();
      });
    } catch {}
  };

  // Play Single Dhikr (supports authentic Sheikh audio for Quranic verses & customized speech synthesis for Duas)
  const playDhikr = async (
    item: DhikrItem,
    startRepetition = 1,
    autoplaySequence = false,
    sheikhOverride?: AdhkarSheikh
  ) => {
    // If already playing this item manually, toggle stop
    if (playingDhikrId === item.id && !autoplaySequence && !sheikhOverride) {
      stopAudio();
      return;
    }

    // Cancel previous audio without losing autoplay state when requested
    isCancelledRef.current = true;
    speechSessionTokenRef.current += 1;
    if (speechPendingTimerRef.current !== null) {
      clearTimeout(speechPendingTimerRef.current);
      speechPendingTimerRef.current = null;
    }
    if (speechUtteranceRef.current) {
      speechUtteranceRef.current.onend = null;
      speechUtteranceRef.current.onerror = null;
      speechUtteranceRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    const activeSheikh = sheikhOverride || selectedSheikhRef.current;
    isCancelledRef.current = false;
    setAudioNotice(null);
    setPlayingDhikrId(item.id);
    setIsAutoplayingAll(autoplaySequence);
    setIsPaused(false);
    setCurrentRepetition(startRepetition);
    updateAdhkarMediaSession(item, activeSheikh.name);

    if (autoplaySequence) {
      preloadNextDhikrAudio(item.id, activeSheikh);
    }

    const maxReps = Math.min(item.count, 3);

    // Case 1: Quranic Verse with Sheikh authentic MP3 recording
    if (item.quranAyahNumbers && item.quranAyahNumbers.length > 0) {
      playSheikhQuranAudio(item, startRepetition, maxReps, autoplaySequence, activeSheikh);
      return;
    }

    // Case 2: Prophetic Du'a with customized Sheikh-style Speech Synthesis
    playSheikhSpeechAudio(item, startRepetition, maxReps, autoplaySequence, activeSheikh);
  };

  // Authentic Sheikh Audio player for Quranic Ayahs
  const playSheikhQuranAudio = (
    item: DhikrItem,
    currentRep: number,
    maxReps: number,
    autoplaySequence: boolean,
    sheikh: AdhkarSheikh
  ) => {
    if (isCancelledRef.current) return;
    const totalAyahs = item.quranAyahNumbers?.length || 0;
    let currentAyahIndex = 0;

    const playNextAyah = () => {
      if (isCancelledRef.current) return;

      if (currentAyahIndex >= totalAyahs) {
        if (autoIncrementRef.current) {
          handleIncrement(item.id, item.count);
        }

        if (currentRep < maxReps && !isCancelledRef.current) {
          setTimeout(() => {
            if (!isCancelledRef.current) {
              setCurrentRepetition(currentRep + 1);
              playSheikhQuranAudio(item, currentRep + 1, maxReps, autoplaySequence, sheikh);
            }
          }, 600);
        } else {
          if (autoplaySequence) {
            setTimeout(() => {
              if (!isCancelledRef.current) {
                moveToNextSequentialDhikr(item.id, sheikh);
              }
            }, 1000);
          } else {
            setPlayingDhikrId(null);
            setIsAutoplayingAll(false);
            setCurrentRepetition(1);
          }
        }
        return;
      }

      const audioUrl = getSheikhAyahUrl(sheikh, item, currentAyahIndex);
      if (!audioUrl) {
        playSheikhSpeechAudio(item, currentRep, maxReps, autoplaySequence, sheikh);
        return;
      }

      if (currentRevokeRef.current) {
        currentRevokeRef.current();
        currentRevokeRef.current = null;
      }

      resolvePlayableAudioSrc(audioUrl)
        .then(({ src, fromCache, revoke }) => {
          if (isCancelledRef.current) {
            revoke?.();
            return;
          }
          if (revoke) {
            currentRevokeRef.current = revoke;
          }

          let audio: HTMLAudioElement;
          if (!fromCache && preloadedAudioRef.current && preloadedAudioRef.current.url === audioUrl) {
            audio = preloadedAudioRef.current.audio;
            preloadedAudioRef.current = null;
          } else {
            audio = new Audio(src);
          }
          audio.playbackRate = playbackSpeedRef.current;
          currentAudioRef.current = audio;

          audio.onended = () => {
            if (currentRevokeRef.current) {
              currentRevokeRef.current();
              currentRevokeRef.current = null;
            }
            currentAyahIndex++;
            playNextAyah();
          };

          audio.onerror = () => {
            console.warn('Sheikh audio stream fallback to speech');
            playSheikhSpeechAudio(item, currentRep, maxReps, autoplaySequence, sheikh);
          };

          audio.play().catch(() => {
            playSheikhSpeechAudio(item, currentRep, maxReps, autoplaySequence, sheikh);
          });
        })
        .catch(() => {
          playSheikhSpeechAudio(item, currentRep, maxReps, autoplaySequence, sheikh);
        });
    };

    playNextAyah();
  };

  // Sheikh Speech Audio player for Duas
  const playSheikhSpeechAudio = (
    item: DhikrItem,
    rep: number,
    maxReps: number,
    autoplaySequence: boolean,
    sheikh: AdhkarSheikh
  ) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setAudioNotice('متصفحك الحالي لا يدعم تشغيل القراءة الصوتية المباشرة للأدعية.');
      setPlayingDhikrId(null);
      setIsAutoplayingAll(false);
      return;
    }
    if (isCancelledRef.current) return;

    setCurrentRepetition(rep);
    const cleanText = sanitizeForSpeech(item.text);
    const myToken = ++speechSessionTokenRef.current;
    const wasActive =
      window.speechSynthesis.speaking || window.speechSynthesis.pending;
    if (wasActive) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    const startSpeech = () => {
      if (isCancelledRef.current || myToken !== speechSessionTokenRef.current) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ar-SA';
      utterance.rate = Math.max(0.5, Math.min(1.6, playbackSpeedRef.current * (sheikh.speechRate || 1.0)));
      utterance.pitch = sheikh.speechPitch || 1.0;

      const voice = getArabicVoice();
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        if (isCancelledRef.current || myToken !== speechSessionTokenRef.current) return;
        speechUtteranceRef.current = null;

        if (autoIncrementRef.current) {
          handleIncrement(item.id, item.count);
        }

        if (rep < maxReps && !isCancelledRef.current) {
          setTimeout(() => {
            if (!isCancelledRef.current && myToken === speechSessionTokenRef.current) {
              playSheikhSpeechAudio(item, rep + 1, maxReps, autoplaySequence, sheikh);
            }
          }, 600);
        } else {
          if (autoplaySequence) {
            setTimeout(() => {
              if (!isCancelledRef.current && myToken === speechSessionTokenRef.current) {
                moveToNextSequentialDhikr(item.id, sheikh);
              }
            }, 1000);
          } else {
            setPlayingDhikrId(null);
            setIsAutoplayingAll(false);
            setCurrentRepetition(1);
          }
        }
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (myToken !== speechSessionTokenRef.current) return;
        if (event?.error === 'canceled' || event?.error === 'interrupted') {
          return;
        }
        speechUtteranceRef.current = null;
        if (!isCancelledRef.current) {
          setPlayingDhikrId(null);
          setIsAutoplayingAll(false);
        }
      };

      speechUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    if (wasActive) {
      speechPendingTimerRef.current = setTimeout(() => {
        speechPendingTimerRef.current = null;
        startSpeech();
      }, 45);
    } else {
      startSpeech();
    }
  };

  // Move to Next Dhikr during Autoplay Sequence
  const moveToNextSequentialDhikr = (currentId: string, sheikhOverride?: AdhkarSheikh) => {
    const currentIndex = filteredAdhkar.findIndex(d => d.id === currentId);
    let nextIndex = currentIndex + 1;

    while (
      nextIndex < filteredAdhkar.length &&
      skipCompletedRef.current &&
      (countersRef.current[filteredAdhkar[nextIndex].id] || 0) >= filteredAdhkar[nextIndex].count
    ) {
      nextIndex++;
    }

    if (currentIndex >= 0 && nextIndex < filteredAdhkar.length) {
      const nextDhikr = filteredAdhkar[nextIndex];
      const el = document.getElementById(`dhikr-${nextDhikr.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      playDhikr(nextDhikr, 1, true, sheikhOverride);
    } else {
      stopAudio();
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
    }
  };

  // Move to Previous Dhikr during Autoplay
  const moveToPrevSequentialDhikr = (currentId: string) => {
    const currentIndex = filteredAdhkar.findIndex(d => d.id === currentId);
    if (currentIndex > 0) {
      const prevDhikr = filteredAdhkar[currentIndex - 1];
      const el = document.getElementById(`dhikr-${prevDhikr.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      playDhikr(prevDhikr, 1, isAutoplayingAllRef.current);
    }
  };

  // Start Autoplay of All Adhkar
  const handleStartAutoplayAll = () => {
    if (isAutoplayingAll) {
      stopAudio();
      return;
    }

    if (filteredAdhkar.length === 0) return;
    const firstCandidate =
      (skipCompletedRef.current
        ? filteredAdhkar.find(d => (countersRef.current[d.id] || 0) < d.count)
        : filteredAdhkar[0]) || filteredAdhkar[0];

    const el = document.getElementById(`dhikr-${firstCandidate.id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    playDhikr(firstCandidate, 1, true);
  };

  // Switch Sheikh cleanly even during active playback
  const handleSelectSheikh = (newSheikh: AdhkarSheikh) => {
    setSelectedSheikh(newSheikh);
    selectedSheikhRef.current = newSheikh;
    const updated = setSectionDefaultReciter('adhkar', newSheikh.id);
    setFavoriteReciterIds(updated.favoriteReciterIds);

    if (playingDhikrId) {
      const current = filteredAdhkar.find(d => d.id === playingDhikrId);
      const wasAutoplaying = isAutoplayingAllRef.current;
      if (current) {
        playDhikr(current, currentRepetition, wasAutoplaying, newSheikh);
      }
    }
  };

  // Toggle Pause/Resume
  const handleTogglePause = () => {
    if (currentAudioRef.current) {
      if (isPaused) {
        currentAudioRef.current.play();
        setIsPaused(false);
      } else {
        currentAudioRef.current.pause();
        setIsPaused(true);
      }
      return;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    }
  };

  // Speed selection toggle
  const cycleSpeed = () => {
    const speeds = [0.85, 1.0, 1.2];
    const currentIdx = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIdx === -1 ? 1 : currentIdx + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setPlaybackSpeed(nextSpeed);
    playbackSpeedRef.current = nextSpeed;

    if (currentAudioRef.current) {
      currentAudioRef.current.playbackRate = nextSpeed;
    } else if (playingDhikrId) {
      const currentItem = filteredAdhkar.find(d => d.id === playingDhikrId);
      const wasAutoplaying = isAutoplayingAllRef.current;
      if (currentItem) {
        playDhikr(currentItem, currentRepetition, wasAutoplaying);
      }
    }
  };

  // Find active playing item
  const activePlayingItem = filteredAdhkar.find(d => d.id === playingDhikrId);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 animate-fadeIn w-full overflow-hidden">
      {/* Banner */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 sm:space-y-3 z-10 text-center sm:text-right max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs font-semibold">
            <Headphones className="w-3.5 h-3.5 text-emerald-400" />
            <span>حصن المسلم بأصوات كبار القراء والمشايخ</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-white font-quran">أذكار الصباح والمساء والورد اليومي</h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            استمع للأذكار بصوت الشيخ المفضل لديك (مشاري العفاسي، سعد الغامدي، ماهر المعيقلي، المنشاوي، السديس، والحصري) مع التشغيل التلقائي المتتابع وتكرار الذكر.
          </p>
        </div>
        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl z-10 hidden sm:flex shrink-0">
          <Sun className="w-8 h-8 sm:w-12 sm:h-12" />
        </div>
      </div>

      {/* Browser Notice Banner */}
      {audioNotice && (
        <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2">
          <span>{audioNotice}</span>
          <button onClick={() => setAudioNotice(null)} className="text-amber-300 font-bold px-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* Sheikh Reciter Selection Box */}
      <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">اختر الشيخ والقارئ للاستماع للأذكار:</h3>
              <p className="text-[11px] text-slate-400">{selectedSheikh.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedSheikh.id}
              onChange={(e) => {
                const found = ADHKAR_SHEIKHS.find(s => s.id === e.target.value);
                if (found) handleSelectSheikh(found);
              }}
              className="flex-1 sm:w-auto bg-slate-800 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs sm:text-sm text-emerald-300 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[42px] cursor-pointer"
            >
              {sortWithFavoritesFirst(ADHKAR_SHEIKHS, favoriteReciterIds).map((s) => (
                <option key={s.id} value={s.id}>
                  {formatSheikhOptionLabel(s.name, s.style, favoriteReciterIds.includes(s.id))}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const updated = toggleFavoriteReciter(selectedSheikh.id);
                setFavoriteReciterIds(updated.favoriteReciterIds);
              }}
              className={`p-2.5 rounded-xl border min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                favoriteReciterIds.includes(selectedSheikh.id)
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-300'
              }`}
              title={favoriteReciterIds.includes(selectedSheikh.id) ? 'إزالة من القراء المفضلين' : 'إضافة إلى القراء المفضلين'}
            >
              <Star className={`w-4 h-4 ${favoriteReciterIds.includes(selectedSheikh.id) ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Sheikh chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {sortWithFavoritesFirst(ADHKAR_SHEIKHS, favoriteReciterIds).map((s) => {
            const isSelected = selectedSheikh.id === s.id;
            const isFav = favoriteReciterIds.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => handleSelectSheikh(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer min-h-[36px] ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60'
                    : isFav
                    ? 'bg-amber-950/30 border border-amber-500/35 text-amber-200 hover:text-white'
                    : 'bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white'
                }`}
              >
                {isFav && <Star className="w-3 h-3 text-amber-400 fill-current shrink-0" />}
                <span>{s.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Master Audio Controls Bar */}
      <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        {/* Play All Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handleStartAutoplayAll}
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shadow-lg transition-all min-h-[44px] cursor-pointer active:scale-95 ${
              isAutoplayingAll
                ? 'bg-rose-600 text-white shadow-rose-950/60 animate-pulse'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-950/50 hover:from-emerald-500 hover:to-teal-500'
            }`}
          >
            {isAutoplayingAll ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>إيقاف التشغيل المتتابع</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>استماع للورد كاملاً بصوت {selectedSheikh.name}</span>
              </>
            )}
          </button>

          {playingDhikrId && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePause}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-750 min-h-[42px] cursor-pointer"
                title={isPaused ? 'استئناف' : 'إيقاف مؤقت'}
              >
                {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                <span>{isPaused ? 'استئناف' : 'إيقاف مؤقت'}</span>
              </button>

              <button
                onClick={stopAudio}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-rose-300 text-xs font-semibold hover:bg-slate-750 min-h-[42px] cursor-pointer"
                title="إيقاف الصوت"
              >
                <Square className="w-4 h-4" />
                <span className="hidden xs:inline">إنهاء</span>
              </button>
            </div>
          )}
        </div>

        {/* Audio Preferences: Speed, Skip Completed & Auto-counter Sync */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
          {/* Speed Toggle */}
          <button
            onClick={cycleSpeed}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-850 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold min-h-[40px] cursor-pointer transition-colors"
            title="سرعة القراءة الصوتية"
          >
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span>السرعة: {playbackSpeed}x</span>
          </button>

          {/* Skip completed toggle */}
          <button
            onClick={() => setSkipCompletedInSequence(!skipCompletedInSequence)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all min-h-[40px] cursor-pointer ${
              skipCompletedInSequence
                ? 'bg-teal-950/60 border-teal-500/40 text-teal-300'
                : 'bg-slate-850 border-slate-700 text-slate-400'
            }`}
            title="تخطي الأذكار المكتملة تلقائياً عند التشغيل المتتابع"
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${skipCompletedInSequence ? 'text-teal-400' : 'text-slate-500'}`} />
            <span>تخطي المكتمل: {skipCompletedInSequence ? 'نعم' : 'لا'}</span>
          </button>

          {/* Auto increment toggle */}
          <button
            onClick={() => setAutoIncrementCounter(!autoIncrementCounter)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all min-h-[40px] cursor-pointer ${
              autoIncrementCounter
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-850 border-slate-700 text-slate-400'
            }`}
            title="تحديث العداد الرقمي تلقائياً مع كل تكرار صوتي"
          >
            <Radio className={`w-3.5 h-3.5 ${autoIncrementCounter ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span>العداد التلقائي: {autoIncrementCounter ? 'مفعل' : 'معطل'}</span>
          </button>
        </div>
      </div>

      {/* Sticky Floating Active Player Pill (When playing) */}
      {playingDhikrId && activePlayingItem && (() => {
        const activeIdx = filteredAdhkar.findIndex(d => d.id === activePlayingItem.id);
        const progressRatio = activeIdx >= 0 ? Math.round(((activeIdx + 1) / Math.max(1, filteredAdhkar.length)) * 100) : 0;
        return (
          <div className="sticky top-[104px] lg:top-[84px] z-30 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-teal-950/95 backdrop-blur-md border border-emerald-500/50 shadow-2xl space-y-2.5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Audio Wave Icon */}
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/50">
                  <Volume2 className={`w-5 h-5 ${!isPaused ? 'animate-bounce' : ''}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {selectedSheikh.name}
                    </span>
                    <span className="text-xs text-amber-300 font-bold">
                      تكرار {currentRepetition} / {Math.min(activePlayingItem.count, 3)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      ({activeIdx + 1} من {filteredAdhkar.length})
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white truncate font-quran mt-0.5">
                    {activePlayingItem.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 shrink-0">
                <button
                  onClick={() => moveToPrevSequentialDhikr(activePlayingItem.id)}
                  className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  title="الذكر السابق"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  onClick={handleTogglePause}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPaused ? 'استئناف' : 'إيقاف مؤقت'}</span>
                </button>
                <button
                  onClick={() => moveToNextSequentialDhikr(activePlayingItem.id)}
                  className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  title="الذكر التالي"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={stopAudio}
                  className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:text-white min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  title="إنهاء التشغيل"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </div>

            {/* Sequential Adhkar Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${progressRatio}%` }}
              ></div>
            </div>
          </div>
        );
      })()}

      {/* Filter Tabs */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 sm:gap-3 w-full">
        <button
          onClick={() => {
            setFilter('morning');
            if (isAutoplayingAll) stopAudio();
          }}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all min-h-[44px] cursor-pointer active:scale-95 ${
            filter === 'morning'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
          <span>أذكار الصباح</span>
        </button>
        <button
          onClick={() => {
            setFilter('evening');
            if (isAutoplayingAll) stopAudio();
          }}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all min-h-[44px] cursor-pointer active:scale-95 ${
            filter === 'evening'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-300" />
          <span>أذكار المساء</span>
        </button>
        <button
          onClick={() => {
            setFilter('all');
            if (isAutoplayingAll) stopAudio();
          }}
          className={`flex-1 sm:flex-initial flex items-center justify-center px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all min-h-[44px] cursor-pointer active:scale-95 ${
            filter === 'all'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <span>جميع الأذكار ({ADHKAR_LIST.length})</span>
        </button>
      </div>

      {/* Adhkar List */}
      <div className="space-y-4 sm:space-y-6">
        {filteredAdhkar.map((item) => {
          const currentProgress = counters[item.id] || 0;
          const isCompleted = currentProgress >= item.count;
          const isPlayingThis = playingDhikrId === item.id;

          return (
            <div
              id={`dhikr-${item.id}`}
              key={item.id}
              className={`p-4 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-900 border transition-all duration-300 shadow-xl relative flex flex-col gap-4 sm:gap-6 ${
                isPlayingThis
                  ? 'border-emerald-400 ring-2 ring-emerald-500/40 bg-emerald-950/20'
                  : isCompleted
                  ? 'border-emerald-500/60 bg-emerald-950/10'
                  : 'border-slate-800 hover:border-emerald-500/30'
              }`}
            >
              {/* Header with Title and Listen Button */}
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-xs sm:text-sm shrink-0">
                    {item.count}×
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white font-quran truncate">{item.title}</h3>
                    <span className="text-[10px] text-slate-400 block">
                      {item.quranAyahNumbers ? 'آيات من القرآن الكريم' : 'دعاء نبوي مأثور'} • {item.category === 'morning' ? 'خاص بالصباح' : item.category === 'evening' ? 'خاص بالمساء' : 'الصباح والمساء'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Single Dhikr Listen Button */}
                  <button
                    onClick={() => playDhikr(item, 1, false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
                      isPlayingThis
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60 animate-pulse'
                        : 'bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750'
                    }`}
                    title={`الاستماع الصوتي لهذا الذكر بصوت ${selectedSheikh.name}`}
                  >
                    {isPlayingThis ? (
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

                  {isCompleted && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">مكتمل</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Dhikr text */}
              <div className="text-right">
                <p className="text-lg sm:text-2xl font-quran text-slate-100 leading-[2.1] sm:leading-[2.3] font-bold">
                  {item.text}
                </p>
              </div>

              {/* Virtue & Reward */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-850 border border-slate-800 text-slate-300 text-xs sm:text-sm leading-relaxed">
                <span className="text-emerald-400 font-bold block mb-0.5">الفضل والجزاء:</span>
                {item.virtue}
              </div>

              {/* Counter Action Footer */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
                <button
                  onClick={() => handleReset(item.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors min-h-[42px] cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة العداد</span>
                </button>

                <button
                  onClick={() => handleIncrement(item.id, item.count)}
                  disabled={isCompleted}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all min-h-[46px] cursor-pointer ${
                    isCompleted
                      ? 'bg-emerald-600 text-white shadow-lg cursor-default'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/40 hover:from-emerald-500 hover:to-teal-500 active:scale-95'
                  }`}
                >
                  <span>{isCompleted ? 'اكتمل الذكر المبارك ✓' : `اضغط للذكر (${currentProgress} / ${item.count})`}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
