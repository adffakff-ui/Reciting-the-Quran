import { RECITERS, Reciter } from '../data/quranData';
import { ADHKAR_SHEIKHS, AdhkarSheikh } from '../data/adhkarData';

export const RECITER_PREFERENCES_KEY = 'murtal_reciter_preferences';
export const RECITER_PREFERENCES_EVENT = 'murtal-reciter-preferences-changed';

export type ReciterSectionKey =
  | 'surah'
  | 'adhkar'
  | 'hisn'
  | 'shatibiyyah'
  | 'jazariyyah';

export interface ReciterPreferences {
  favoriteReciterIds: string[];
  defaultSurahReciterId: string;
  defaultAdhkarSheikhId: string;
  defaultHisnSheikhId: string;
  defaultShatibiyyahSheikhId: string;
  defaultJazariyyahSheikhId: string;
}

const VALID_RECITER_IDS = new Set(RECITERS.map((r) => r.id));
const VALID_SHEIKH_IDS = new Set(ADHKAR_SHEIKHS.map((s) => s.id));

function normalizeReciterId(id?: string | null): string {
  if (!id) return RECITERS[0].id;
  if (VALID_RECITER_IDS.has(id)) return id;
  const byIdentifier = RECITERS.find((r) => r.identifier === id);
  return byIdentifier ? byIdentifier.id : RECITERS[0].id;
}

function normalizeSheikhId(id?: string | null): string {
  if (!id) return ADHKAR_SHEIKHS[0].id;
  if (VALID_SHEIKH_IDS.has(id)) return id;
  const byFolder = ADHKAR_SHEIKHS.find((s) => s.everyayahFolder === id);
  return byFolder ? byFolder.id : ADHKAR_SHEIKHS[0].id;
}

export function getReciterByIdOrIdentifier(idOrIdentifier?: string | null): Reciter {
  if (!idOrIdentifier) return RECITERS[0];
  return (
    RECITERS.find((r) => r.id === idOrIdentifier || r.identifier === idOrIdentifier) ||
    RECITERS[0]
  );
}

export function getSheikhById(id?: string | null): AdhkarSheikh {
  if (!id) return ADHKAR_SHEIKHS[0];
  return (
    ADHKAR_SHEIKHS.find((s) => s.id === id || s.everyayahFolder === id) ||
    ADHKAR_SHEIKHS[0]
  );
}

export function getReciterPreferences(): ReciterPreferences {
  let legacySurahId = RECITERS[0].id;
  let legacyAdhkarId = ADHKAR_SHEIKHS[0].id;

  try {
    const legacyMushaf = localStorage.getItem('mushaf_reciter');
    if (legacyMushaf) legacySurahId = normalizeReciterId(legacyMushaf);
    const legacyAdhkar = localStorage.getItem('adhkar_sheikh_id');
    if (legacyAdhkar) legacyAdhkarId = normalizeSheikhId(legacyAdhkar);

    const raw = localStorage.getItem(RECITER_PREFERENCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReciterPreferences>;
      const favs = Array.isArray(parsed.favoriteReciterIds)
        ? Array.from(
            new Set(
              parsed.favoriteReciterIds
                .map((x) => normalizeReciterId(x))
                .filter((x) => VALID_RECITER_IDS.has(x))
            )
          )
        : ['afasy', 'minshawi', 'husary'];

      return {
        favoriteReciterIds: favs,
        defaultSurahReciterId: normalizeReciterId(parsed.defaultSurahReciterId || legacySurahId),
        defaultAdhkarSheikhId: normalizeSheikhId(parsed.defaultAdhkarSheikhId || legacyAdhkarId),
        defaultHisnSheikhId: normalizeSheikhId(parsed.defaultHisnSheikhId || legacyAdhkarId),
        defaultShatibiyyahSheikhId: normalizeSheikhId(parsed.defaultShatibiyyahSheikhId || 'husary'),
        defaultJazariyyahSheikhId: normalizeSheikhId(parsed.defaultJazariyyahSheikhId || 'husary'),
      };
    }
  } catch {}

  return {
    favoriteReciterIds: ['afasy', 'minshawi', 'husary'],
    defaultSurahReciterId: legacySurahId,
    defaultAdhkarSheikhId: legacyAdhkarId,
    defaultHisnSheikhId: legacyAdhkarId,
    defaultShatibiyyahSheikhId: 'husary',
    defaultJazariyyahSheikhId: 'husary',
  };
}

export function saveReciterPreferences(prefs: ReciterPreferences): ReciterPreferences {
  const normalized: ReciterPreferences = {
    favoriteReciterIds: Array.from(
      new Set(prefs.favoriteReciterIds.map((x) => normalizeReciterId(x)))
    ),
    defaultSurahReciterId: normalizeReciterId(prefs.defaultSurahReciterId),
    defaultAdhkarSheikhId: normalizeSheikhId(prefs.defaultAdhkarSheikhId),
    defaultHisnSheikhId: normalizeSheikhId(prefs.defaultHisnSheikhId),
    defaultShatibiyyahSheikhId: normalizeSheikhId(prefs.defaultShatibiyyahSheikhId),
    defaultJazariyyahSheikhId: normalizeSheikhId(prefs.defaultJazariyyahSheikhId),
  };

  try {
    localStorage.setItem(RECITER_PREFERENCES_KEY, JSON.stringify(normalized));
    const surahReciter = getReciterByIdOrIdentifier(normalized.defaultSurahReciterId);
    localStorage.setItem('mushaf_reciter', surahReciter.identifier);
    localStorage.setItem('adhkar_sheikh_id', normalized.defaultAdhkarSheikhId);
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RECITER_PREFERENCES_EVENT, { detail: normalized }));
  }

  return normalized;
}

export function toggleFavoriteReciter(reciterId: string): ReciterPreferences {
  const current = getReciterPreferences();
  const normId = normalizeReciterId(reciterId);
  const exists = current.favoriteReciterIds.includes(normId);
  const nextFavorites = exists
    ? current.favoriteReciterIds.filter((id) => id !== normId)
    : [...current.favoriteReciterIds, normId];

  return saveReciterPreferences({
    ...current,
    favoriteReciterIds: nextFavorites,
  });
}

export function setSectionDefaultReciter(
  section: ReciterSectionKey,
  reciterId: string
): ReciterPreferences {
  const current = getReciterPreferences();
  const next = { ...current };
  if (section === 'surah') next.defaultSurahReciterId = normalizeReciterId(reciterId);
  else if (section === 'adhkar') next.defaultAdhkarSheikhId = normalizeSheikhId(reciterId);
  else if (section === 'hisn') next.defaultHisnSheikhId = normalizeSheikhId(reciterId);
  else if (section === 'shatibiyyah') next.defaultShatibiyyahSheikhId = normalizeSheikhId(reciterId);
  else if (section === 'jazariyyah') next.defaultJazariyyahSheikhId = normalizeSheikhId(reciterId);

  return saveReciterPreferences(next);
}

export function setAllDefaultsToReciter(reciterId: string): ReciterPreferences {
  const current = getReciterPreferences();
  const normSurah = normalizeReciterId(reciterId);
  const normSheikh = normalizeSheikhId(reciterId);
  const favs = current.favoriteReciterIds.includes(normSurah)
    ? current.favoriteReciterIds
    : [...current.favoriteReciterIds, normSurah];

  return saveReciterPreferences({
    favoriteReciterIds: favs,
    defaultSurahReciterId: normSurah,
    defaultAdhkarSheikhId: normSheikh,
    defaultHisnSheikhId: normSheikh,
    defaultShatibiyyahSheikhId: normSheikh,
    defaultJazariyyahSheikhId: normSheikh,
  });
}

export function sortWithFavoritesFirst<T extends { id: string }>(
  items: T[],
  favoriteIds: string[]
): T[] {
  const favSet = new Set(favoriteIds);
  const favs = items.filter((item) => favSet.has(item.id));
  const others = items.filter((item) => !favSet.has(item.id));
  return [...favs, ...others];
}

export function formatSheikhOptionLabel(
  name: string,
  style: string,
  isFav: boolean,
  isDefault = false
): string {
  const prefix = isFav ? '★ ' : '';
  const suffix = isDefault ? ' — افتراضي' : '';
  return `${prefix}${name} (${style})${suffix}`;
}

interface AndroidTTSInterface {
  isAvailable?: () => boolean;
  speak: (text: string, rate: number, pitch: number, token: string) => void;
  stop: () => void;
}

declare global {
  interface Window {
    AndroidTTS?: AndroidTTSInterface;
    __onAndroidTTSEnd?: (token: string) => void;
    __onAndroidTTSError?: (token: string) => void;
  }
}

let activeUtteranceRef: SpeechSynthesisUtterance | null = null;
let speechSessionToken = 0;
let pendingSpeakTimer: ReturnType<typeof setTimeout> | null = null;
let timedFallbackTimer: ReturnType<typeof setTimeout> | null = null;
let timedFallbackRemainingMs = 0;
let timedFallbackStartedAt = 0;
let timedFallbackCallback: (() => void) | null = null;
let androidTtsCallbacks: Map<string, { onEnd: () => void; onError: () => void }> = new Map();

if (typeof window !== 'undefined') {
  window.__onAndroidTTSEnd = (token: string) => {
    const cb = androidTtsCallbacks.get(token);
    if (cb) {
      androidTtsCallbacks.delete(token);
      cb.onEnd();
    }
  };
  window.__onAndroidTTSError = (token: string) => {
    const cb = androidTtsCallbacks.get(token);
    if (cb) {
      androidTtsCallbacks.delete(token);
      cb.onError();
    }
  };
}

export interface SpeakArabicOptions {
  speedMultiplier?: number;
  allowTimedFallback?: boolean;
  onFallbackNotice?: (message: string) => void;
  onEnd?: () => void;
  onError?: () => void;
}

function clearTimedFallback(): void {
  if (timedFallbackTimer !== null) {
    clearTimeout(timedFallbackTimer);
    timedFallbackTimer = null;
  }
  timedFallbackRemainingMs = 0;
  timedFallbackStartedAt = 0;
  timedFallbackCallback = null;
}

function splitArabicIntoSegments(cleanedText: string, maxLen = 150): string[] {
  if (cleanedText.length <= maxLen) return [cleanedText];
  const rawParts = cleanedText
    .split(/(?<=[.،؛:!؟])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const merged: string[] = [];
  let buffer = '';
  for (const part of rawParts) {
    if (!buffer) {
      buffer = part;
    } else if (buffer.length + part.length + 1 <= maxLen) {
      buffer = `${buffer} ${part}`;
    } else {
      merged.push(buffer);
      buffer = part;
    }
  }
  if (buffer) merged.push(buffer);
  return merged.length > 0 ? merged : [cleanedText];
}

function pickBestArabicVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(
      (v) =>
        v.lang.startsWith('ar') &&
        (v.name.includes('Arabic') ||
          v.name.includes('Natural') ||
          v.name.includes('Maged') ||
          v.name.includes('Tarık') ||
          v.name.includes('Hoda') ||
          v.name.includes('Naayf'))
    ) ||
    voices.find((v) => v.lang.startsWith('ar')) ||
    null
  );
}

function waitForVoicesBriefly(timeoutMs = 350): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }
    if (window.speechSynthesis.getVoices().length > 0) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener?.('voiceschanged', done);
      resolve();
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', done);
    setTimeout(done, timeoutMs);
  });
}

export function stopArabicSpeech(): void {
  speechSessionToken += 1;
  clearTimedFallback();
  androidTtsCallbacks.clear();
  if (pendingSpeakTimer !== null) {
    clearTimeout(pendingSpeakTimer);
    pendingSpeakTimer = null;
  }
  if (activeUtteranceRef) {
    activeUtteranceRef.onend = null;
    activeUtteranceRef.onerror = null;
    activeUtteranceRef = null;
  }
  if (typeof window !== 'undefined') {
    try {
      window.AndroidTTS?.stop?.();
    } catch {}
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }
}

export function pauseArabicSpeech(): void {
  if (timedFallbackTimer !== null && timedFallbackStartedAt > 0) {
    const elapsed = Date.now() - timedFallbackStartedAt;
    timedFallbackRemainingMs = Math.max(300, timedFallbackRemainingMs - elapsed);
    clearTimeout(timedFallbackTimer);
    timedFallbackTimer = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.pause();
    } catch {}
  }
}

export function resumeArabicSpeech(): void {
  if (timedFallbackCallback && timedFallbackRemainingMs > 0 && timedFallbackTimer === null) {
    const cb = timedFallbackCallback;
    timedFallbackStartedAt = Date.now();
    timedFallbackTimer = setTimeout(() => {
      timedFallbackTimer = null;
      timedFallbackCallback = null;
      timedFallbackRemainingMs = 0;
      cb();
    }, timedFallbackRemainingMs);
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.resume();
    } catch {}
  }
}

export function speakArabicWithSheikh(
  text: string,
  sheikh: AdhkarSheikh,
  onEndOrOptions?: (() => void) | SpeakArabicOptions,
  onErrorArg?: () => void
): boolean {
  const options: SpeakArabicOptions =
    typeof onEndOrOptions === 'function'
      ? { onEnd: onEndOrOptions, onError: onErrorArg }
      : onEndOrOptions || {};

  const cleaned = text
    .replace(/[۝۞۩﴿﴾]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    options.onEnd?.();
    return true;
  }

  const speedMul = options.speedMultiplier ?? 1.0;
  const effectivePitch = Math.max(0.5, Math.min(2.0, sheikh.speechPitch || 1.0));
  const effectiveRate = Math.max(0.5, Math.min(1.75, (sheikh.speechRate || 0.9) * speedMul));

  const startTimedReadingFallback = (reason: string) => {
    if (options.allowTimedFallback === false) {
      options.onError?.();
      return;
    }
    const myToken = speechSessionToken;
    options.onFallbackNotice?.(reason);
    const wordCount = Math.max(3, cleaned.split(/\s+/).length);
    const durationMs = Math.max(2200, Math.min(18000, Math.round((wordCount * 420) / speedMul)));
    timedFallbackRemainingMs = durationMs;
    timedFallbackStartedAt = Date.now();
    timedFallbackCallback = () => {
      if (myToken !== speechSessionToken) return;
      options.onEnd?.();
    };
    timedFallbackTimer = setTimeout(() => {
      if (myToken !== speechSessionToken) return;
      clearTimedFallback();
      options.onEnd?.();
    }, durationMs);
  };

  try {
    const wasWebSpeechActive =
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending);

    stopArabicSpeech();
    const myToken = speechSessionToken;

    // Tier 1: Native Android Offline TextToSpeech inside APK
    if (typeof window !== 'undefined' && window.AndroidTTS?.isAvailable?.()) {
      const tokenStr = `utt_${myToken}_${Date.now()}`;
      androidTtsCallbacks.set(tokenStr, {
        onEnd: () => {
          if (myToken !== speechSessionToken) return;
          options.onEnd?.();
        },
        onError: () => {
          if (myToken !== speechSessionToken) return;
          startTimedReadingFallback('تعذر النطق التلقائي عبر النظام، تم تفعيل وضع القراءة المتتابعة المرئية بدون إنترنت.');
        },
      });
      window.AndroidTTS.speak(cleaned, effectiveRate, effectivePitch, tokenStr);
      return true;
    }

    // Tier 2: Web Speech Synthesis API
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      startTimedReadingFallback('المتصفح لا يدعم محرك النطق، تم تفعيل التمرير والقراءة المرئية المتتابعة.');
      return true;
    }

    const segments = splitArabicIntoSegments(cleaned);

    const speakSegmentIndex = async (segIndex: number) => {
      if (myToken !== speechSessionToken) return;
      if (segIndex === 0 && window.speechSynthesis.getVoices().length === 0) {
        await waitForVoicesBriefly(350);
        if (myToken !== speechSessionToken) return;
      }

      if (segIndex >= segments.length) {
        activeUtteranceRef = null;
        options.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segments[segIndex]);
      utterance.lang = 'ar-SA';
      const arabicVoice = pickBestArabicVoice();
      if (arabicVoice) utterance.voice = arabicVoice;
      utterance.pitch = effectivePitch;
      utterance.rate = effectiveRate;

      utterance.onend = () => {
        if (myToken !== speechSessionToken) return;
        activeUtteranceRef = null;
        if (segIndex + 1 < segments.length) {
          void speakSegmentIndex(segIndex + 1);
        } else {
          options.onEnd?.();
        }
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (myToken !== speechSessionToken) return;
        if (event?.error === 'canceled' || event?.error === 'interrupted') {
          return;
        }
        activeUtteranceRef = null;
        startTimedReadingFallback(
          'محرك الصوت غير متاح حالياً (قد يتطلب تثبيت حزمة الصوت العربية في الجهاز)، وتم تفعيل التتابع المرئي.'
        );
      };

      activeUtteranceRef = utterance;
      window.speechSynthesis.speak(utterance);
    };

    if (wasWebSpeechActive) {
      pendingSpeakTimer = setTimeout(() => {
        pendingSpeakTimer = null;
        void speakSegmentIndex(0);
      }, 45);
    } else {
      void speakSegmentIndex(0);
    }

    return true;
  } catch {
    startTimedReadingFallback('تعذر تشغيل الصوت، تم تفعيل القراءة المرئية المتتابعة.');
    return true;
  }
}
