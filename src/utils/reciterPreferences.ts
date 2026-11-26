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

let activeUtteranceRef: SpeechSynthesisUtterance | null = null;
let speechSessionToken = 0;
let pendingSpeakTimer: ReturnType<typeof setTimeout> | null = null;

export interface SpeakArabicOptions {
  speedMultiplier?: number;
  onEnd?: () => void;
  onError?: () => void;
}

export function stopArabicSpeech(): void {
  speechSessionToken += 1;
  if (pendingSpeakTimer !== null) {
    clearTimeout(pendingSpeakTimer);
    pendingSpeakTimer = null;
  }
  if (activeUtteranceRef) {
    activeUtteranceRef.onend = null;
    activeUtteranceRef.onerror = null;
    activeUtteranceRef = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

export function pauseArabicSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.pause();
    } catch {}
  }
}

export function resumeArabicSpeech(): void {
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

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onError?.();
    return false;
  }

  try {
    const wasActive =
      window.speechSynthesis.speaking || window.speechSynthesis.pending;
    stopArabicSpeech();
    const myToken = speechSessionToken;

    const startUtterance = () => {
      if (myToken !== speechSessionToken) return;
      const cleaned = text
        .replace(/[۝۞۩﴿﴾]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleaned) {
        options.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = 'ar-SA';

      const voices = window.speechSynthesis.getVoices();
      const arabicVoice =
        voices.find(
          (v) =>
            v.lang.startsWith('ar') &&
            (v.name.includes('Arabic') ||
              v.name.includes('Natural') ||
              v.name.includes('Maged') ||
              v.name.includes('Tarık'))
        ) || voices.find((v) => v.lang.startsWith('ar'));

      if (arabicVoice) utterance.voice = arabicVoice;
      const speedMul = options.speedMultiplier ?? 1.0;
      utterance.pitch = Math.max(0.5, Math.min(2.0, sheikh.speechPitch || 1.0));
      utterance.rate = Math.max(0.5, Math.min(1.75, (sheikh.speechRate || 0.9) * speedMul));

      utterance.onend = () => {
        if (myToken !== speechSessionToken) return;
        activeUtteranceRef = null;
        options.onEnd?.();
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (myToken !== speechSessionToken) return;
        if (event?.error === 'canceled' || event?.error === 'interrupted') {
          return;
        }
        activeUtteranceRef = null;
        options.onError?.();
      };

      activeUtteranceRef = utterance;
      window.speechSynthesis.speak(utterance);
    };

    if (wasActive) {
      pendingSpeakTimer = setTimeout(() => {
        pendingSpeakTimer = null;
        startUtterance();
      }, 45);
    } else {
      startUtterance();
    }

    return true;
  } catch {
    options.onError?.();
    return false;
  }
}
