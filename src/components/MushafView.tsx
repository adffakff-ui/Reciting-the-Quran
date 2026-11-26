import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, BookOpen, Volume2, Bookmark, Sparkles, ChevronRight, 
  Play, Pause, ChevronLeft, Square, SkipForward, SkipBack, 
  Repeat, Gauge, Radio, ListOrdered, HardDriveDownload, CheckCircle2, Loader2, Star
} from 'lucide-react';
import { 
  QURAN_SURAHS, RECITERS, Surah, Ayah, 
  getReciterAyahAudioUrl, getReciterBasmalahAudioUrl, getAyahDisplayText 
} from '../data/quranData';
import { AyahModal } from './AyahModal';
import {
  downloadAudioPackOffline,
  getSurahAyahAudioUrls,
  isSurahCachedOffline,
  prefetchAudioToCache,
  resolvePlayableAudioSrc,
} from '../utils/offlineStorage';
import {
  RECITER_PREFERENCES_EVENT,
  formatSheikhOptionLabel,
  getReciterByIdOrIdentifier,
  getReciterPreferences,
  setSectionDefaultReciter,
  sortWithFavoritesFirst,
  toggleFavoriteReciter,
} from '../utils/reciterPreferences';

interface MushafViewProps {
  bookmarks: string[];
  onToggleBookmark: (ayahKey: string) => void;
  onSelectAyahForCoach: (surahName: string, ayahText: string, ayahNumber?: number) => void;
  targetBookmark?: { surahName: string; ayahKey: string; nonce: number } | null;
}

export const MushafView: React.FC<MushafViewProps> = ({
  bookmarks,
  onToggleBookmark,
  onSelectAyahForCoach,
  targetBookmark,
}) => {
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteReciterIds, setFavoriteReciterIds] = useState<string[]>(() => getReciterPreferences().favoriteReciterIds);
  const [selectedReciter, setSelectedReciter] = useState(() => {
    try {
      const prefs = getReciterPreferences();
      const rec = getReciterByIdOrIdentifier(prefs.defaultSurahReciterId);
      return rec.identifier;
    } catch {
      return RECITERS[0].identifier;
    }
  });
  const [isPlayingFullSurah, setIsPlayingFullSurah] = useState(false);
  const [playingAyahNumber, setPlayingAyahNumber] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [autoContinue, setAutoContinue] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mushaf_auto_continue');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [autoNextSurah, setAutoNextSurah] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mushaf_auto_next_surah');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [playBasmalah, setPlayBasmalah] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mushaf_play_basmalah');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [repeatAyah, setRepeatAyah] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('mushaf_speed');
      const val = saved ? parseFloat(saved) : 1.0;
      return [0.85, 1.0, 1.25].includes(val) ? val : 1.0;
    } catch {
      return 1.0;
    }
  });

  const [activeAyahModal, setActiveAyahModal] = useState<{ ayah: Ayah; surah: Surah } | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'Meccan' | 'Medinan'>('all');
  const [selectedJuz, setSelectedJuz] = useState<number | 'all'>('all');

  // Pagination / Chunking for long Surahs
  const [ayahPage, setAyahPage] = useState(1);
  const pageSize = 30;
  const [jumpAyahNum, setJumpAyahNum] = useState('');
  const [surahOfflineStatus, setSurahOfflineStatus] = useState<{
    cachedCount: number;
    totalCount: number;
    isComplete: boolean;
  } | null>(null);
  const [isDownloadingSurahOffline, setIsDownloadingSurahOffline] = useState(false);
  const [surahDownloadProgress, setSurahDownloadProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 0,
  });

  // Refs to prevent stale closures during sequential callbacks
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedAudioRef = useRef<{ url: string; audio: HTMLAudioElement } | null>(null);
  const activeSpeechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isCancelledRef = useRef(false);
  const selectedReciterRef = useRef(selectedReciter);
  const autoContinueRef = useRef(autoContinue);
  const autoNextSurahRef = useRef(autoNextSurah);
  const playBasmalahRef = useRef(playBasmalah);
  const repeatAyahRef = useRef(repeatAyah);
  const playbackSpeedRef = useRef(playbackSpeed);
  const isPlayingFullSurahRef = useRef(isPlayingFullSurah);
  const selectedSurahRef = useRef(selectedSurah);
  const playingAyahRef = useRef(playingAyahNumber);

  selectedReciterRef.current = selectedReciter;
  autoContinueRef.current = autoContinue;
  autoNextSurahRef.current = autoNextSurah;
  playBasmalahRef.current = playBasmalah;
  repeatAyahRef.current = repeatAyah;
  playbackSpeedRef.current = playbackSpeed;
  isPlayingFullSurahRef.current = isPlayingFullSurah;
  selectedSurahRef.current = selectedSurah;
  playingAyahRef.current = playingAyahNumber;

  useEffect(() => {
    try {
      localStorage.setItem('mushaf_reciter', selectedReciter);
    } catch {}
  }, [selectedReciter]);

  useEffect(() => {
    try {
      localStorage.setItem('mushaf_auto_continue', String(autoContinue));
    } catch {}
  }, [autoContinue]);

  useEffect(() => {
    try {
      localStorage.setItem('mushaf_auto_next_surah', String(autoNextSurah));
    } catch {}
  }, [autoNextSurah]);

  useEffect(() => {
    let active = true;
    if (!selectedSurah) {
      setSurahOfflineStatus(null);
      return;
    }
    isSurahCachedOffline(selectedSurah, selectedReciter).then((res) => {
      if (active) setSurahOfflineStatus(res);
    });
    return () => {
      active = false;
    };
  }, [selectedSurah, selectedReciter]);

  useEffect(() => {
    try {
      localStorage.setItem('mushaf_play_basmalah', String(playBasmalah));
    } catch {}
  }, [playBasmalah]);

  useEffect(() => {
    try {
      localStorage.setItem('mushaf_speed', String(playbackSpeed));
    } catch {}
  }, [playbackSpeed]);

  useEffect(() => {
    const syncPrefs = () => {
      const prefs = getReciterPreferences();
      setFavoriteReciterIds(prefs.favoriteReciterIds);
      const nextIdentifier = getReciterByIdOrIdentifier(prefs.defaultSurahReciterId).identifier;
      setSelectedReciter(nextIdentifier);
      selectedReciterRef.current = nextIdentifier;
    };
    window.addEventListener(RECITER_PREFERENCES_EVENT, syncPrefs);
    window.addEventListener('murtal-backup-restored', syncPrefs);
    return () => {
      window.removeEventListener(RECITER_PREFERENCES_EVENT, syncPrefs);
      window.removeEventListener('murtal-backup-restored', syncPrefs);
      stopAllAudio();
    };
  }, []);

  useEffect(() => {
    if (!targetBookmark) return;
    const [surahNumStr, ayahNumStr] = targetBookmark.ayahKey.split(':');
    const surahNum = Number(surahNumStr);
    const ayahNum = Number(ayahNumStr);
    const foundSurah =
      QURAN_SURAHS.find((s) => s.number === surahNum) ||
      QURAN_SURAHS.find((s) => s.name === targetBookmark.surahName);
    if (!foundSurah) return;

    stopAllAudio();
    setSelectedSurah(foundSurah);
    if (!isNaN(ayahNum) && ayahNum > 0) {
      if (foundSurah.ayahs.length > 50) {
        setAyahPage(Math.ceil(ayahNum / pageSize));
      } else {
        setAyahPage(1);
      }
      setTimeout(() => {
        const el = document.getElementById(`ayah-${ayahNum}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    } else {
      setAyahPage(1);
    }
  }, [targetBookmark]);

  const filteredSurahs = QURAN_SURAHS.filter((surah) => {
    const matchesSearch = surah.name.includes(searchQuery) || 
                          (surah.originalName && surah.originalName.includes(searchQuery)) ||
                          surah.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          surah.englishNameTranslation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || surah.revelationType === filterType;
    const matchesJuz = selectedJuz === 'all' || surah.juz === selectedJuz;
    return matchesSearch && matchesFilter && matchesJuz;
  });

  const currentRevokeRef = useRef<(() => void) | null>(null);

  const getAyahAudioUrl = (surahNumber: number, ayah: Ayah, reciterIdentifier: string): string | null => {
    if (!ayah?.number) return null;
    return getReciterAyahAudioUrl(reciterIdentifier, surahNumber, ayah.number);
  };

  const stopAllAudio = () => {
    isCancelledRef.current = true;
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
    if (activeSpeechUtteranceRef.current) {
      activeSpeechUtteranceRef.current.onend = null;
      activeSpeechUtteranceRef.current.onerror = null;
      activeSpeechUtteranceRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setPlayingAyahNumber(null);
    setIsPlayingFullSurah(false);
    setIsPaused(false);
  };

  const preloadNextAyah = (surah: Surah, currentAyahNumber: number, reciterIdentifier: string) => {
    const currentIndex = surah.ayahs.findIndex(a => a.number === currentAyahNumber);
    let nextAyah: Ayah | undefined;
    let nextSurahNumber = surah.number;

    if (currentIndex >= 0 && currentIndex + 1 < surah.ayahs.length) {
      nextAyah = surah.ayahs[currentIndex + 1];
    } else if (autoNextSurahRef.current && surah.number < 114) {
      const nextSurah = QURAN_SURAHS.find(s => s.number === surah.number + 1);
      if (nextSurah) {
        nextSurahNumber = nextSurah.number;
        nextAyah = nextSurah.ayahs[0];
      }
    }

    if (!nextAyah) return;
    const nextUrl = getAyahAudioUrl(nextSurahNumber, nextAyah, reciterIdentifier);
    if (!nextUrl) return;

    void prefetchAudioToCache(nextUrl);
    if (preloadedAudioRef.current?.url === nextUrl) return;
    const preAudio = new Audio();
    preAudio.preload = 'auto';
    preAudio.src = nextUrl;
    preloadedAudioRef.current = { url: nextUrl, audio: preAudio };
  };

  const updateMediaSession = (surah: Surah, ayahNumber: number, reciterName: string) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const sessionTitle = ayahNumber === 0
        ? `بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ - سورة ${surah.name}`
        : `سورة ${surah.name} - الآية ${ayahNumber}`;
      const sessionAlbum = ayahNumber === 0
        ? 'مُرَتِّل القرآن الذكي • افتتاح السورة بالبسملة'
        : 'مُرَتِّل القرآن الذكي';

      navigator.mediaSession.metadata = new MediaMetadata({
        title: sessionTitle,
        artist: reciterName,
        album: sessionAlbum,
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (currentAudioRef.current && currentAudioRef.current.paused) {
          currentAudioRef.current.play().catch(() => {});
          setIsPaused(false);
        } else if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.resume();
          setIsPaused(false);
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (currentAudioRef.current && !currentAudioRef.current.paused) {
          currentAudioRef.current.pause();
          setIsPaused(true);
        } else if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.pause();
          setIsPaused(true);
        }
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (selectedSurahRef.current && playingAyahRef.current !== null) {
          jumpSequentialByOffset(selectedSurahRef.current, playingAyahRef.current, 1);
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (selectedSurahRef.current && playingAyahRef.current !== null) {
          jumpSequentialByOffset(selectedSurahRef.current, playingAyahRef.current, -1);
        }
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        stopAllAudio();
      });
    } catch {}
  };

  const scrollToAndSyncAyahPage = (surah: Surah, ayahNumber: number) => {
    if (ayahNumber === 0) {
      setAyahPage(1);
      setTimeout(() => {
        const el = document.getElementById('surah-basmalah');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }
    if (surah.ayahs.length > 50) {
      const targetPage = Math.ceil(ayahNumber / pageSize);
      setAyahPage(prev => (prev !== targetPage ? targetPage : prev));
    }
    setTimeout(() => {
      const el = document.getElementById(`ayah-${ayahNumber}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  const playBasmalahSequence = (
    surah: Surah,
    continuousMode: boolean,
    reciterOverride?: string
  ) => {
    isCancelledRef.current = true;
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
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    isCancelledRef.current = false;
    const activeReciterId = reciterOverride || selectedReciterRef.current;
    const reciterObj = RECITERS.find(r => r.identifier === activeReciterId) || RECITERS[0];

    setPlayingAyahNumber(0); // 0 signifies the Basmalah
    setIsPlayingFullSurah(continuousMode);
    setIsPaused(false);
    scrollToAndSyncAyahPage(surah, 0);
    updateMediaSession(surah, 0, reciterObj.name);

    const handleBasmalahCompleted = () => {
      if (isCancelledRef.current) return;

      // Repeat Basmalah if repeatAyah is active
      if (repeatAyahRef.current) {
        setTimeout(() => {
          if (!isCancelledRef.current) {
            playBasmalahSequence(surah, continuousMode, activeReciterId);
          }
        }, 250);
        return;
      }

      // If continuous or autoContinue, continue to Ayah 1 of the Surah
      const shouldContinue = continuousMode || autoContinueRef.current;
      if (shouldContinue && surah.ayahs[0]) {
        setTimeout(() => {
          if (!isCancelledRef.current) {
            playAyahSequence(surah, surah.ayahs[0].number, true);
          }
        }, 220);
      } else {
        setPlayingAyahNumber(null);
        setIsPlayingFullSurah(false);
        setIsPaused(false);
      }
    };

    const audioUrl = getReciterBasmalahAudioUrl(activeReciterId);

    const playSpeechFallback = () => {
      if (isCancelledRef.current || typeof window === 'undefined' || !window.speechSynthesis) {
        stopAllAudio();
        return;
      }
      const u = new SpeechSynthesisUtterance('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
      u.lang = 'ar-SA';
      u.rate = Math.max(0.6, Math.min(1.5, playbackSpeedRef.current * 0.9));
      u.onend = () => {
        activeSpeechUtteranceRef.current = null;
        handleBasmalahCompleted();
      };
      u.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (event?.error === 'canceled' || event?.error === 'interrupted') return;
        activeSpeechUtteranceRef.current = null;
        if (!isCancelledRef.current) stopAllAudio();
      };
      activeSpeechUtteranceRef.current = u;
      window.speechSynthesis.speak(u);
    };

    // Preload Ayah 1 for zero-delay transition after Basmalah
    if (surah.ayahs[0]) {
      const ayah1Url = getAyahAudioUrl(surah.number, surah.ayahs[0], activeReciterId);
      if (ayah1Url) void prefetchAudioToCache(ayah1Url);
    }

    resolvePlayableAudioSrc(audioUrl)
      .then(({ src, fromCache, revoke }) => {
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
          handleBasmalahCompleted();
        };
        audio.onerror = playSpeechFallback;
        audio.play().catch(playSpeechFallback);
      })
      .catch(playSpeechFallback);
  };

  const playAyahSequence = (
    surah: Surah,
    ayahNumber: number,
    continuousMode: boolean,
    reciterOverride?: string
  ) => {
    const ayah = surah.ayahs.find(a => a.number === ayahNumber);
    if (!ayah) {
      stopAllAudio();
      return;
    }

    // Clear previous playback cleanly without resetting continuous state
    isCancelledRef.current = true;
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    isCancelledRef.current = false;
    const activeReciterId = reciterOverride || selectedReciterRef.current;
    const reciterObj = RECITERS.find(r => r.identifier === activeReciterId) || RECITERS[0];

    setPlayingAyahNumber(ayah.number);
    setIsPlayingFullSurah(continuousMode);
    setIsPaused(false);
    scrollToAndSyncAyahPage(surah, ayah.number);
    updateMediaSession(surah, ayah.number, reciterObj.name);

    const handleAyahCompleted = () => {
      if (isCancelledRef.current) return;

      // 1. Repeat single Ayah if Repeat mode is active
      if (repeatAyahRef.current) {
        setTimeout(() => {
          if (!isCancelledRef.current) {
            playAyahSequence(surah, ayah.number, continuousMode, activeReciterId);
          }
        }, 250);
        return;
      }

      // 2. Continue sequentially if enabled
      const shouldContinue = continuousMode || autoContinueRef.current;
      if (!shouldContinue) {
        setPlayingAyahNumber(null);
        setIsPlayingFullSurah(false);
        setIsPaused(false);
        return;
      }

      const currentIdx = surah.ayahs.findIndex(a => a.number === ayah.number);
      if (currentIdx >= 0 && currentIdx + 1 < surah.ayahs.length) {
        const nextAyah = surah.ayahs[currentIdx + 1];
        setTimeout(() => {
          if (!isCancelledRef.current) {
            playAyahSequence(surah, nextAyah.number, true);
          }
        }, 180);
      } else if (autoNextSurahRef.current && surah.number < 114) {
        const nextSurah = QURAN_SURAHS.find(s => s.number === surah.number + 1);
        if (nextSurah && nextSurah.ayahs[0]) {
          setSelectedSurah(nextSurah);
          setAyahPage(1);
          setTimeout(() => {
            if (!isCancelledRef.current) {
              if (nextSurah.number !== 9 && playBasmalahRef.current) {
                playBasmalahSequence(nextSurah, true);
              } else {
                playAyahSequence(nextSurah, nextSurah.ayahs[0].number, true);
              }
            }
          }, 500);
          return;
        }
        stopAllAudio();
      } else {
        stopAllAudio();
      }
    };

    const audioUrl = getAyahAudioUrl(surah.number, ayah, activeReciterId);

    const playSpeechFallback = () => {
      if (isCancelledRef.current || typeof window === 'undefined' || !window.speechSynthesis) {
        stopAllAudio();
        return;
      }
      const u = new SpeechSynthesisUtterance(ayah.text);
      u.lang = 'ar-SA';
      u.rate = Math.max(0.6, Math.min(1.5, playbackSpeedRef.current * 0.9));
      u.onend = () => {
        activeSpeechUtteranceRef.current = null;
        handleAyahCompleted();
      };
      u.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (event?.error === 'canceled' || event?.error === 'interrupted') return;
        activeSpeechUtteranceRef.current = null;
        if (!isCancelledRef.current) stopAllAudio();
      };
      activeSpeechUtteranceRef.current = u;
      window.speechSynthesis.speak(u);
    };

    if (audioUrl) {
      // Preload next ayah for zero-gap transitions
      if (continuousMode || autoContinueRef.current) {
        preloadNextAyah(surah, ayah.number, activeReciterId);
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
            handleAyahCompleted();
          };
          audio.onerror = playSpeechFallback;
          audio.play().catch(playSpeechFallback);
        })
        .catch(playSpeechFallback);
    } else {
      playSpeechFallback();
    }
  };

  const handlePlaySingleAyah = (ayah: Ayah) => {
    if (!selectedSurah) return;
    if (playingAyahNumber === ayah.number && !isPaused) {
      stopAllAudio();
      return;
    }
    playAyahSequence(selectedSurah, ayah.number, autoContinue);
  };

  const handlePlaySurahAudio = (surah: Surah) => {
    if (isPlayingFullSurah || playingAyahNumber !== null) {
      stopAllAudio();
      return;
    }

    if (surah.number !== 1 && surah.number !== 9 && playBasmalahRef.current) {
      playBasmalahSequence(surah, true);
    } else if (surah.ayahs[0]) {
      playAyahSequence(surah, surah.ayahs[0].number, true);
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

  const jumpSequentialByOffset = (surah: Surah, currentAyahNum: number, delta: number) => {
    if (currentAyahNum === 0) {
      if (delta > 0 && surah.ayahs[0]) {
        playAyahSequence(surah, surah.ayahs[0].number, isPlayingFullSurahRef.current || autoContinueRef.current);
      } else if (delta < 0 && surah.number > 1) {
        const prevSurah = QURAN_SURAHS.find(s => s.number === surah.number - 1);
        if (prevSurah && prevSurah.ayahs.length > 0) {
          const lastAyah = prevSurah.ayahs[prevSurah.ayahs.length - 1];
          setSelectedSurah(prevSurah);
          setAyahPage(Math.ceil(lastAyah.number / pageSize));
          playAyahSequence(prevSurah, lastAyah.number, true);
        }
      }
      return;
    }

    const idx = surah.ayahs.findIndex(a => a.number === currentAyahNum);
    const targetIdx = idx + delta;
    if (targetIdx >= 0 && targetIdx < surah.ayahs.length) {
      playAyahSequence(surah, surah.ayahs[targetIdx].number, isPlayingFullSurahRef.current || autoContinueRef.current);
    } else if (targetIdx < 0) {
      if (surah.number !== 1 && surah.number !== 9 && playBasmalahRef.current) {
        playBasmalahSequence(surah, isPlayingFullSurahRef.current || autoContinueRef.current);
      } else if (surah.number > 1) {
        const prevSurah = QURAN_SURAHS.find(s => s.number === surah.number - 1);
        if (prevSurah && prevSurah.ayahs.length > 0) {
          const lastAyah = prevSurah.ayahs[prevSurah.ayahs.length - 1];
          setSelectedSurah(prevSurah);
          setAyahPage(Math.ceil(lastAyah.number / pageSize));
          playAyahSequence(prevSurah, lastAyah.number, true);
        }
      }
    } else if (delta > 0 && autoNextSurahRef.current && surah.number < 114) {
      const nextSurah = QURAN_SURAHS.find(s => s.number === surah.number + 1);
      if (nextSurah && nextSurah.ayahs[0]) {
        setSelectedSurah(nextSurah);
        setAyahPage(1);
        if (nextSurah.number !== 9 && playBasmalahRef.current) {
          playBasmalahSequence(nextSurah, true);
        } else {
          playAyahSequence(nextSurah, nextSurah.ayahs[0].number, true);
        }
      }
    }
  };

  const handleCycleSpeed = () => {
    const speeds = [0.85, 1.0, 1.25];
    const currentIdx = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIdx === -1 ? 1 : currentIdx + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    playbackSpeedRef.current = nextSpeed;
    if (currentAudioRef.current) {
      currentAudioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleReciterChange = (newReciterId: string) => {
    setSelectedReciter(newReciterId);
    selectedReciterRef.current = newReciterId;
    const matched = getReciterByIdOrIdentifier(newReciterId);
    const updated = setSectionDefaultReciter('surah', matched.id);
    setFavoriteReciterIds(updated.favoriteReciterIds);
    if (selectedSurah && playingAyahNumber !== null) {
      playAyahSequence(selectedSurah, playingAyahNumber, isPlayingFullSurah || autoContinue, newReciterId);
    }
  };

  const handleDownloadCurrentSurahOffline = async () => {
    if (!selectedSurah || isDownloadingSurahOffline) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const reciter = RECITERS.find(r => r.identifier === selectedReciter) || RECITERS[0];
    const urls = getSurahAyahAudioUrls(selectedSurah, reciter.identifier);
    setIsDownloadingSurahOffline(true);
    setSurahDownloadProgress({ completed: 0, total: urls.length });
    try {
      await downloadAudioPackOffline(
        {
          id: `surah_${selectedSurah.number}_${reciter.id}`,
          type: 'surah',
          title: `سورة ${selectedSurah.name}`,
          subtitle: `${selectedSurah.numberOfAyahs} آية • ${selectedSurah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}`,
          reciterName: reciter.name,
          urls,
          ayahCount: urls.length,
        },
        (completed, total) => {
          setSurahDownloadProgress({ completed, total });
        }
      );
      const updated = await isSurahCachedOffline(selectedSurah, reciter.identifier);
      setSurahOfflineStatus(updated);
    } catch {
      const updated = await isSurahCachedOffline(selectedSurah, reciter.identifier);
      setSurahOfflineStatus(updated);
    } finally {
      setIsDownloadingSurahOffline(false);
    }
  };

  const totalPages = selectedSurah ? Math.ceil(selectedSurah.ayahs.length / pageSize) : 1;
  const displayedAyahs = selectedSurah
    ? (selectedSurah.ayahs.length > 50
        ? selectedSurah.ayahs.slice((ayahPage - 1) * pageSize, ayahPage * pageSize)
        : selectedSurah.ayahs)
    : [];

  const handleJumpToAyah = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSurah) return;
    const num = parseInt(jumpAyahNum, 10);
    if (!isNaN(num) && num >= 1 && num <= selectedSurah.numberOfAyahs) {
      const targetPage = Math.ceil(num / pageSize);
      setAyahPage(targetPage);
      setTimeout(() => {
        const el = document.getElementById(`ayah-${num}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setJumpAyahNum('');
    }
  };

  const activeReciterObj = RECITERS.find(r => r.identifier === selectedReciter) || RECITERS[0];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 animate-fadeIn w-full overflow-hidden">
      {selectedSurah ? (
        /* Surah Reader View */
        <div className="space-y-4 sm:space-y-6">
          {/* Surah Header Banner */}
          <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden flex flex-col gap-4 sm:gap-6">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 z-10">
              <div className="space-y-2 text-center md:text-right">
                <button
                  onClick={() => {
                    stopAllAudio();
                    setSelectedSurah(null);
                    setAyahPage(1);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 mb-1 transition-colors cursor-pointer py-1"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>العودة لفهرس السور</span>
                </button>
                <div className="flex items-center justify-center md:justify-start gap-2.5 sm:gap-3">
                  <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-base sm:text-lg shrink-0">
                    {selectedSurah.number}
                  </span>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white font-quran">سورة {selectedSurah.name}</h2>
                    <p className="text-xs sm:text-sm text-emerald-400/80">
                      {selectedSurah.englishName} • {selectedSurah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} • الجزء {selectedSurah.juz}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reciter and Listen Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto min-w-0">
                <div className="flex items-center gap-1.5 w-full sm:w-auto sm:max-w-xs min-w-0">
                  <select
                    value={selectedReciter}
                    onChange={(e) => handleReciterChange(e.target.value)}
                    className="w-full min-w-0 flex-1 bg-slate-800 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[42px] cursor-pointer truncate"
                  >
                    {sortWithFavoritesFirst(RECITERS, favoriteReciterIds).map((r) => (
                      <option key={r.id} value={r.identifier}>
                        {formatSheikhOptionLabel(r.name, r.style, favoriteReciterIds.includes(r.id))}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const updated = toggleFavoriteReciter(activeReciterObj.id);
                      setFavoriteReciterIds(updated.favoriteReciterIds);
                    }}
                    className={`p-2.5 rounded-xl border min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                      favoriteReciterIds.includes(activeReciterObj.id)
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-300'
                    }`}
                    title={favoriteReciterIds.includes(activeReciterObj.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                  >
                    <Star className={`w-4 h-4 ${favoriteReciterIds.includes(activeReciterObj.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <button
                  onClick={() => handlePlaySurahAudio(selectedSurah)}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs sm:text-sm shadow-lg transition-all cursor-pointer min-h-[42px] ${
                    isPlayingFullSurah || playingAyahNumber !== null
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/40'
                  }`}
                >
                  {isPlayingFullSurah || playingAyahNumber !== null ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span>إيقاف التلاوة</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>تلاوة السورة كاملة</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Autoplay Sequential Integration Options Strip */}
            <div className="flex flex-wrap items-center justify-center md:justify-between gap-2 pt-3 border-t border-emerald-500/20 z-10">
              <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setAutoContinue(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                    autoContinue
                      ? 'bg-emerald-600/25 border-emerald-400/60 text-emerald-200'
                      : 'bg-slate-900/70 border-slate-700 text-slate-400'
                  }`}
                  title="الانتقال التلقائي للآية التالية عند انتهاء الآية الحالية"
                >
                  <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
                  <span>التتابع التلقائي للآيات: {autoContinue ? 'مفعل' : 'معطل'}</span>
                </button>

                <button
                  onClick={() => setAutoNextSurah(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                    autoNextSurah
                      ? 'bg-teal-600/25 border-teal-400/60 text-teal-200'
                      : 'bg-slate-900/70 border-slate-700 text-slate-400'
                  }`}
                  title="الانتقال تلقائياً إلى السورة التالية عند ختم السورة الحالية"
                >
                  <Radio className={`w-3.5 h-3.5 ${autoNextSurah ? 'text-teal-400 animate-pulse' : 'text-slate-500'}`} />
                  <span>السورة التالية تلقائياً: {autoNextSurah ? 'مفعل' : 'معطل'}</span>
                </button>

                <button
                  onClick={() => setPlayBasmalah(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                    playBasmalah
                      ? 'bg-emerald-600/25 border-emerald-400/60 text-emerald-200'
                      : 'bg-slate-900/70 border-slate-700 text-slate-400'
                  }`}
                  title="قراءة البسملة افتتاحاً عند بدء السورة (ما عدا سورة التوبة)"
                >
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>قراءة البسملة بداية السورة: {playBasmalah ? 'مفعل' : 'معطل'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRepeatAyah(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                    repeatAyah
                      ? 'bg-amber-600/25 border-amber-400/60 text-amber-200'
                      : 'bg-slate-900/70 border-slate-700 text-slate-400'
                  }`}
                  title="تكرار الآية الحالية باستمرار للحفظ"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>تكرار الآية: {repeatAyah ? 'مفعل' : 'معطل'}</span>
                </button>

                <button
                  onClick={handleCycleSpeed}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-300 hover:text-white text-[11px] sm:text-xs font-semibold min-h-[36px] cursor-pointer"
                  title="سرعة التلاوة"
                >
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{playbackSpeed}x</span>
                </button>

                {surahOfflineStatus?.isComplete ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs font-bold min-h-[36px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>متاح أوفلاين</span>
                  </span>
                ) : (
                  <button
                    onClick={handleDownloadCurrentSurahOffline}
                    disabled={isDownloadingSurahOffline}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600/25 hover:bg-teal-600/40 border border-teal-400/50 text-teal-200 text-[11px] sm:text-xs font-bold min-h-[36px] cursor-pointer disabled:opacity-60"
                    title="حفظ السورة بصوت هذا الشيخ للاستماع بدون إنترنت"
                  >
                    {isDownloadingSurahOffline ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{surahDownloadProgress.completed}/{surahDownloadProgress.total}</span>
                      </>
                    ) : (
                      <>
                        <HardDriveDownload className="w-3.5 h-3.5" />
                        <span>حفظ أوفلاين</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Sequential Player Sticky Bar (When playing) */}
          {playingAyahNumber !== null && (
            <div className="sticky top-[104px] lg:top-[84px] z-30 p-3 sm:p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 shadow-2xl space-y-2.5 animate-fadeIn">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-950/50">
                    <Volume2 className={`w-4 h-4 ${!isPaused ? 'animate-bounce' : ''}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-white font-quran">
                        {playingAyahNumber === 0 
                          ? `سورة ${selectedSurah.name} • افتتاح السورة بالبسملة` 
                          : `سورة ${selectedSurah.name} • الآية ${playingAyahNumber} / ${selectedSurah.numberOfAyahs}`}
                      </span>
                      {(isPlayingFullSurah || autoContinue) && !repeatAyah && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          تتابع تلقائي
                        </span>
                      )}
                      {repeatAyah && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          تكرار الآية
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{activeReciterObj.name}</p>
                  </div>
                </div>

                {/* Transport Controls */}
                <div className="flex items-center justify-center sm:justify-end gap-1.5 shrink-0">
                  <button
                    onClick={() => jumpSequentialByOffset(selectedSurah, playingAyahNumber, -1)}
                    className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                    title="الآية أو المفتتح السابق"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleTogglePause}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                    <span>{isPaused ? 'استئناف' : 'إيقاف مؤقت'}</span>
                  </button>
                  <button
                    onClick={() => jumpSequentialByOffset(selectedSurah, playingAyahNumber, 1)}
                    className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                    title="الآية التالية"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={stopAllAudio}
                    className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:text-white min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                    title="إنهاء التلاوة"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>

              {/* Surah Sequential Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                  style={{ width: `${playingAyahNumber === 0 ? 5 : Math.round((playingAyahNumber / Math.max(1, selectedSurah.numberOfAyahs)) * 100)}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Jump to Ayah & Page Selector for Long Surahs */}
          {selectedSurah.ayahs.length > 50 && (
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <form onSubmit={handleJumpToAyah} className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-400 shrink-0">انتقال:</span>
                <input
                  type="number"
                  min="1"
                  max={selectedSurah.numberOfAyahs}
                  placeholder={`الآية (1-${selectedSurah.numberOfAyahs})`}
                  value={jumpAyahNum}
                  onChange={(e) => setJumpAyahNum(e.target.value)}
                  className="w-full sm:w-32 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[38px]"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/50 min-h-[38px] shrink-0"
                >
                  انتقال
                </button>
              </form>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <span className="text-xs text-slate-400 shrink-0">صفحة:</span>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setAyahPage(p)}
                      className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                        ayahPage === p
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Majestic Interactive Basmalah Card */}
          {selectedSurah.number !== 9 && (
            <div
              id="surah-basmalah"
              className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl border transition-all duration-300 shadow-xl p-4 sm:p-7 text-center space-y-4 ${
                playingAyahNumber === 0
                  ? 'bg-gradient-to-r from-emerald-950/85 via-slate-900 to-teal-950/85 border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-900/30'
                  : 'bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-emerald-500/25 hover:border-emerald-500/40'
              }`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-[11px] font-bold text-emerald-400/90 tracking-widest uppercase">
                    {selectedSurah.number === 1 ? 'فاتحة الكتاب • الآية الأولى' : 'مفتتح السورة المباركة'}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                </div>

                <p className="text-2xl sm:text-4xl lg:text-5xl font-quran text-emerald-200 tracking-wide font-bold leading-relaxed sm:leading-loose drop-shadow-md select-none">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </p>

                {/* Recitation Buttons on the Basmalah */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      if (playingAyahNumber === 0 && !isPaused) {
                        stopAllAudio();
                      } else {
                        playBasmalahSequence(selectedSurah, false);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] shadow-md active:scale-95 ${
                      playingAyahNumber === 0 && !isPaused
                        ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                    }`}
                    title="تلاوة البسملة بصوت الشيخ المختار"
                  >
                    {playingAyahNumber === 0 && !isPaused ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>إيقاف تلاوة البسملة</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>تلاوة البسملة</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      playBasmalahSequence(selectedSurah, true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-semibold transition-all cursor-pointer min-h-[38px] active:scale-95"
                    title="قراءة البسملة ثم مواصلة تلاوة السورة كاملة"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>تلاوة البسملة ثم مواصلة السورة</span>
                  </button>

                  <button
                    onClick={() => onSelectAyahForCoach(selectedSurah.name, 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', 0)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/30 text-teal-300 text-xs font-semibold transition-all cursor-pointer min-h-[38px] active:scale-95"
                    title="تدرب على قراءة البسملة ومخارج حروفها وأحكامها"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    <span>تدريب التجويد على البسملة</span>
                  </button>
                </div>

                {/* Sound waves animation while reciting Basmalah */}
                {playingAyahNumber === 0 && (
                  <div className="flex items-center justify-center gap-1.5 pt-1 text-emerald-400">
                    <span className="w-1 h-3.5 bg-emerald-400 rounded-full animate-bounce"></span>
                    <span className="w-1 h-5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                    <span className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                    <span className="w-1 h-6 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                    <span className="w-1 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.25s]"></span>
                    <span className="text-xs font-bold text-emerald-300 px-2">جاري ترتيل البسملة...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ayahs Container */}
          <div className="space-y-3 sm:space-y-4">
            {displayedAyahs.map((ayah) => {
              const ayahKey = `${selectedSurah.number}:${ayah.number}`;
              const isBookmarked = bookmarks.includes(ayahKey);
              const isPlayingThisAyah = playingAyahNumber === ayah.number;

              return (
                <div
                  id={`ayah-${ayah.number}`}
                  key={ayah.number}
                  className={`group p-4 sm:p-6 rounded-2xl bg-slate-900/90 border transition-all duration-300 shadow-md space-y-4 ${
                    isPlayingThisAyah ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-950/20' : 'border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  {/* Ayah Header with responsive buttons */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                        {ayah.number}
                      </span>
                      <span className="text-xs text-slate-400 sm:hidden">آية {ayah.number}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 justify-end">
                      {/* Play single or sequential from this ayah */}
                      <button
                        onClick={() => handlePlaySingleAyah(ayah)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                          isPlayingThisAyah
                            ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                        }`}
                        title={autoContinue ? 'تشغيل متتابع بدءاً من هذه الآية' : 'استمع لتلاوة هذه الآية'}
                      >
                        {isPlayingThisAyah ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        <span>{isPlayingThisAyah ? 'إيقاف' : 'استماع'}</span>
                      </button>

                      <button
                        onClick={() => onToggleBookmark(ayahKey)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
                          isBookmarked 
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                        title="حفظ في المفضلة"
                      >
                        <Bookmark className="w-4 h-4 fill-current" />
                      </button>

                      {/* Direct Test & Coach Button */}
                      <button
                        onClick={() => onSelectAyahForCoach(selectedSurah.name, ayah.text, ayah.number)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600/20 border border-teal-500/30 text-teal-300 text-xs font-semibold hover:bg-teal-600/30 transition-colors cursor-pointer min-h-[36px]"
                        title="تدرب على هذه الآية مع اختبار القراءة والتنبيه اللحظي بالأخطاء"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                        <span>اختبار القراءة</span>
                      </button>

                      <button
                        onClick={() => setActiveAyahModal({ ayah, surah: selectedSurah })}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30 transition-colors cursor-pointer min-h-[36px]"
                      >
                        التفسير
                      </button>
                    </div>
                  </div>

                  {/* Ayah Arabic Text */}
                  <div className="text-right py-1">
                    <p className="text-xl sm:text-3xl font-quran text-slate-100 leading-[2.2] sm:leading-[2.4] font-bold">
                      {getAyahDisplayText(selectedSurah.number, ayah.number, ayah.text)} <span className="text-emerald-400 text-base sm:text-lg font-sans">﴿{ayah.number}﴾</span>
                    </p>
                  </div>

                  {/* English Translation */}
                  {ayah.translation && (
                    <div className="text-left pt-2 border-t border-slate-800/80">
                      <p className="text-[10px] font-semibold text-emerald-400/80 mb-0.5 uppercase tracking-wider">Translation</p>
                      <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">{ayah.translation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Pagination for Long Surahs */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => { setAyahPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={ayahPage <= 1}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 disabled:opacity-40 min-h-[40px]"
              >
                السابقة
              </button>
              <span className="text-xs text-slate-400 px-2">
                {ayahPage} / {totalPages}
              </span>
              <button
                onClick={() => { setAyahPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={ayahPage >= totalPages}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 disabled:opacity-40 min-h-[40px]"
              >
                التالية
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Surahs Directory View */
        <div className="space-y-6">
          {/* Banner */}
          <div className="p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden text-center sm:text-right flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="space-y-2.5 z-10 max-w-2xl">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs font-semibold">
                المصحف الشريف الكامل • 114 سورة
              </span>
              <h2 className="text-2xl sm:text-4xl font-bold text-white font-quran">المصحف الشريف بالرسم العثماني</h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                تصفح جميع سور القرآن الكريم كاملة مع الاستماع والتفسير واختبار القراءة اللحظي.
              </p>
            </div>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl z-10 shrink-0">
              <BookOpen className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col gap-3 w-full">
            <div className="flex flex-col sm:flex-row gap-2.5 w-full">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث عن اسم السورة (مثل: الفاتحة، البقرة، يس)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-3 py-2.5 text-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-[44px]"
                />
              </div>

              <select
                value={selectedJuz}
                onChange={(e) => setSelectedJuz(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full sm:w-auto bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
              >
                <option value="all">جميع الأجزاء (1 - 30)</option>
                {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                  <option key={j} value={j}>الجزء {j}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 w-full">
              <button
                onClick={() => setFilterType('all')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] cursor-pointer ${
                  filterType === 'all' 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30' 
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                الكل ({filteredSurahs.length})
              </button>
              <button
                onClick={() => setFilterType('Meccan')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] cursor-pointer ${
                  filterType === 'Meccan' 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30' 
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                مكية
              </button>
              <button
                onClick={() => setFilterType('Medinan')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] cursor-pointer ${
                  filterType === 'Medinan' 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30' 
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                مدنية
              </button>
            </div>
          </div>

          {/* Surahs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredSurahs.map((surah) => (
              <div
                key={surah.number}
                onClick={() => {
                  setSelectedSurah(surah);
                  setAyahPage(1);
                }}
                className="group p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-all duration-200 shadow-md hover:shadow-xl cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-xs group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    {surah.number}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                      الجزء {surah.juz}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      surah.revelationType === 'Meccan' 
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' 
                        : 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                    }`}>
                      {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white font-quran group-hover:text-emerald-400 transition-colors">
                    سورة {surah.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{surah.englishName} • {surah.englishNameTranslation}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px] text-slate-400 font-medium">
                  <span>{surah.numberOfAyahs} آيات</span>
                  <span className="flex items-center gap-1 text-emerald-400 group-hover:translate-x-[-4px] transition-transform font-semibold">
                    <span>قراءة</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for Tafseer */}
      {activeAyahModal && (
        <AyahModal
          ayah={activeAyahModal.ayah}
          surah={activeAyahModal.surah}
          onClose={() => setActiveAyahModal(null)}
          onToggleBookmark={onToggleBookmark}
          isBookmarked={bookmarks.includes(`${activeAyahModal.surah.number}:${activeAyahModal.ayah.number}`)}
        />
      )}
    </div>
  );
};
