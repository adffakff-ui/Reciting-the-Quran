import { QURAN_SURAHS, RECITERS, Surah, getReciterAyahAudioUrl, getReciterBasmalahAudioUrl } from '../data/quranData';
import { ADHKAR_LIST, ADHKAR_SHEIKHS, AdhkarSheikh } from '../data/adhkarData';

export const APP_VERSION = '1.1.0';
export const APP_VERSION_CODE = 110;
export const AUDIO_CACHE_NAME = 'quran-audio-cache';
const IDB_NAME = 'murtal_offline_db';
const IDB_VERSION = 1;
const SNAPSHOTS_STORE = 'snapshots';
const AUDIO_PACKS_STORE = 'audio_packs';

export const BACKUP_LOCAL_STORAGE_KEYS = [
  'quran_bookmarks',
  'hifz_spaced_cards',
  'hifz_memorized_surahs',
  'coach_saved_ayahs',
  'adhkar_counters',
  'mushaf_reciter',
  'mushaf_auto_continue',
  'mushaf_auto_next_surah',
  'mushaf_play_basmalah',
  'mushaf_speed',
  'adhkar_sheikh_id',
  'adhkar_playback_speed',
  'shatibiyyah_saved_abyat',
  'shatibiyyah_memorized_abyat',
  'jazariyyah_saved_abyat',
  'jazariyyah_memorized_abyat',
  'hisn_counters',
  'hisn_favorites',
  'murtal_reciter_preferences',
] as const;

export interface BackupStats {
  bookmarksCount: number;
  spacedCardsCount: number;
  adhkarCountersCount: number;
  settingsCount: number;
  memorizedSurahsCount?: number;
  coachSavedAyahsCount?: number;
}

export interface BackupPayload {
  version: number;
  app: string;
  createdAt: string;
  label?: string;
  stats: BackupStats;
  data: Record<string, string>;
}

export interface LocalSnapshot extends BackupPayload {
  id: string;
}

export interface OfflineAudioPack {
  id: string;
  type: 'surah' | 'adhkar' | 'mushaf' | 'juz';
  title: string;
  subtitle: string;
  reciterName: string;
  urls: string[];
  ayahCount: number;
  completedCount?: number;
  isComplete?: boolean;
  savedAt: string;
}

export interface ReciterOfflineCoverage {
  reciterId: string;
  identifier: string;
  name: string;
  style: string;
  cachedAyahs: number;
  totalAyahs: number;
  percentage: number;
  isComplete: boolean;
  estimatedTotalMB: number;
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB غير مدعوم في هذا المتصفح'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AUDIO_PACKS_STORE)) {
        db.createObjectStore(AUDIO_PACKS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function computeBackupStats(data: Record<string, string>): BackupStats {
  let bookmarksCount = 0;
  let spacedCardsCount = 0;
  let adhkarCountersCount = 0;
  let settingsCount = 0;
  let memorizedSurahsCount = 0;
  let coachSavedAyahsCount = 0;

  try {
    if (data.quran_bookmarks) {
      const parsed = JSON.parse(data.quran_bookmarks);
      if (Array.isArray(parsed)) bookmarksCount = parsed.length;
    }
  } catch {}

  try {
    if (data.hifz_spaced_cards) {
      const parsed = JSON.parse(data.hifz_spaced_cards);
      if (Array.isArray(parsed)) spacedCardsCount = parsed.length;
    }
  } catch {}

  try {
    if (data.hifz_memorized_surahs) {
      const parsed = JSON.parse(data.hifz_memorized_surahs);
      if (Array.isArray(parsed)) memorizedSurahsCount = parsed.length;
    }
  } catch {}

  try {
    if (data.coach_saved_ayahs) {
      const parsed = JSON.parse(data.coach_saved_ayahs);
      if (Array.isArray(parsed)) coachSavedAyahsCount = parsed.length;
    }
  } catch {}

  try {
    if (data.adhkar_counters) {
      const parsed = JSON.parse(data.adhkar_counters);
      if (parsed && typeof parsed === 'object') {
        adhkarCountersCount = Object.values(parsed).filter((v) => Number(v) > 0).length;
      }
    }
  } catch {}

  const settingKeys = [
    'mushaf_reciter',
    'mushaf_auto_continue',
    'mushaf_auto_next_surah',
    'mushaf_play_basmalah',
    'mushaf_speed',
    'adhkar_sheikh_id',
    'adhkar_playback_speed',
    'murtal_reciter_preferences',
  ];
  settingsCount = settingKeys.filter((k) => data[k] !== undefined).length;

  return {
    bookmarksCount,
    spacedCardsCount,
    adhkarCountersCount,
    settingsCount,
    memorizedSurahsCount,
    coachSavedAyahsCount,
  };
}

export function createBackupPayload(label?: string): BackupPayload {
  const data: Record<string, string> = {};
  for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) {
        data[key] = val;
      }
    } catch {}
  }

  return {
    version: 1,
    app: 'murtal-quran-ai',
    createdAt: new Date().toISOString(),
    label,
    stats: computeBackupStats(data),
    data,
  };
}

export function parseAndValidateBackup(rawText: string): BackupPayload {
  const parsed = JSON.parse(rawText);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.app !== 'murtal-quran-ai' ||
    !parsed.data ||
    typeof parsed.data !== 'object'
  ) {
    throw new Error('ملف النسخة الاحتياطية غير صالح أو لا يخص هذا التطبيق.');
  }

  const sanitizedData: Record<string, string> = {};
  for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
    if (typeof parsed.data[key] === 'string') {
      sanitizedData[key] = parsed.data[key];
    }
  }

  return {
    version: Number(parsed.version) || 1,
    app: 'murtal-quran-ai',
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    label: typeof parsed.label === 'string' ? parsed.label : undefined,
    stats: computeBackupStats(sanitizedData),
    data: sanitizedData,
  };
}

export function restoreBackupPayload(payload: BackupPayload): void {
  for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
    try {
      if (payload.data[key] !== undefined) {
        localStorage.setItem(key, payload.data[key]);
      }
    } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('murtal-backup-restored', { detail: payload }));
  }
}

export function downloadBackupJsonFile(payload: BackupPayload): string {
  const datePart = payload.createdAt.slice(0, 10);
  const filename = `murtal-backup-${datePart}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export async function saveLocalSnapshot(label?: string): Promise<LocalSnapshot> {
  const db = await openOfflineDB();
  const payload = createBackupPayload(label || 'نسخة احتياطية محلية');
  const snapshot: LocalSnapshot = {
    ...payload,
    id: `snap_${Date.now()}`,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
    tx.objectStore(SNAPSHOTS_STORE).put(snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  return snapshot;
}

export async function listLocalSnapshots(): Promise<LocalSnapshot[]> {
  try {
    const db = await openOfflineDB();
    const items = await new Promise<LocalSnapshot[]>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOTS_STORE, 'readonly');
      const req = tx.objectStore(SNAPSHOTS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as LocalSnapshot[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function deleteLocalSnapshot(id: string): Promise<void> {
  const db = await openOfflineDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
    tx.objectStore(SNAPSHOTS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export const TOTAL_QURAN_AYAHS = QURAN_SURAHS.reduce((sum, s) => sum + s.ayahs.length, 0);

export function getSurahAyahAudioUrls(surah: Surah, reciterIdentifier: string): string[] {
  const urls: string[] = [];
  if (surah.number > 1 && surah.number !== 9) {
    urls.push(getReciterBasmalahAudioUrl(reciterIdentifier));
  }
  for (const a of surah.ayahs) {
    urls.push(getReciterAyahAudioUrl(reciterIdentifier, surah.number, a.number));
  }
  return Array.from(new Set(urls));
}

export function getBatchSurahsAudioUrls(surahNumbers: number[], reciterIdentifier: string): string[] {
  const urls: string[] = [];
  for (const num of surahNumbers) {
    const surah = QURAN_SURAHS.find((s) => s.number === num);
    if (surah) {
      urls.push(...getSurahAyahAudioUrls(surah, reciterIdentifier));
    }
  }
  return Array.from(new Set(urls));
}

export function getFullMushafAudioUrls(reciterIdentifier: string): string[] {
  const urls: string[] = [];
  for (const surah of QURAN_SURAHS) {
    for (const a of surah.ayahs) {
      urls.push(getReciterAyahAudioUrl(reciterIdentifier, surah.number, a.number));
    }
  }
  return urls;
}

export function getJuzAudioUrls(juzNumber: number, reciterIdentifier: string): string[] {
  const surahsInJuz = QURAN_SURAHS.filter((s) => s.juz === juzNumber);
  return getBatchSurahsAudioUrls(
    surahsInJuz.map((s) => s.number),
    reciterIdentifier
  );
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch {}
  return false;
}

export function getAdhkarSheikhAudioUrls(sheikh: AdhkarSheikh): string[] {
  const urls: string[] = [];
  for (const item of ADHKAR_LIST) {
    if (sheikh.everyayahFolder && item.quranVerseRefs && item.quranVerseRefs.length > 0) {
      for (const ref of item.quranVerseRefs) {
        urls.push(`https://everyayah.com/data/${sheikh.everyayahFolder}/${ref}.mp3`);
      }
    } else if (item.quranAyahNumbers && item.quranAyahNumbers.length > 0) {
      const bitrate = sheikh.bitrate || 128;
      for (const num of item.quranAyahNumbers) {
        urls.push(`https://cdn.islamic.network/quran/audio/${bitrate}/${sheikh.subfolder}/${num}.mp3`);
      }
    }
  }
  return Array.from(new Set(urls));
}

export function getAllSheikhsAdhkarUrls(): string[] {
  const urls: string[] = [];
  for (const sh of ADHKAR_SHEIKHS) {
    urls.push(...getAdhkarSheikhAudioUrls(sh));
  }
  return Array.from(new Set(urls));
}

export async function prefetchAudioToCache(url: string): Promise<void> {
  if (typeof caches === 'undefined' || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const existing = await cache.match(url);
    if (existing) return;
    const isCorsSupported = url.includes('everyayah.com');
    const res = await fetch(url, { mode: isCorsSupported ? 'cors' : 'no-cors' });
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(url, res);
    }
  } catch {}
}

export async function resolvePlayableAudioSrc(
  url: string
): Promise<{ src: string; fromCache: boolean; revoke?: () => void }> {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const cached = await cache.match(url);
      if (cached && cached.ok && cached.type !== 'opaque') {
        const blob = await cached.blob();
        if (blob.size > 0) {
          const objectUrl = URL.createObjectURL(blob);
          return {
            src: objectUrl,
            fromCache: true,
            revoke: () => URL.revokeObjectURL(objectUrl),
          };
        }
      }
    }
  } catch {}

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    // Warm cache silently in background so next play works 100% offline
    void prefetchAudioToCache(url);
  }

  return { src: url, fromCache: false };
}

export async function listOfflineAudioPacks(): Promise<OfflineAudioPack[]> {
  try {
    const db = await openOfflineDB();
    const items = await new Promise<OfflineAudioPack[]>((resolve, reject) => {
      const tx = db.transaction(AUDIO_PACKS_STORE, 'readonly');
      const req = tx.objectStore(AUDIO_PACKS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as OfflineAudioPack[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch {
    return [];
  }
}

async function saveAudioPackRecord(savedPack: OfflineAudioPack): Promise<void> {
  const db = await openOfflineDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIO_PACKS_STORE, 'readwrite');
    tx.objectStore(AUDIO_PACKS_STORE).put(savedPack);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function fetchWithRetry(
  url: string,
  isCorsSupported: boolean,
  signal?: AbortSignal,
  retries = 2
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const res = await fetch(url, {
        mode: isCorsSupported ? 'cors' : 'no-cors',
        signal,
      });
      if (res && (res.ok || res.type === 'opaque')) {
        return res;
      }
    } catch (err: unknown) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      }
    }
  }
  return null;
}

export async function downloadAudioPackOffline(
  pack: Omit<OfflineAudioPack, 'savedAt'>,
  onProgress: (completed: number, total: number) => void,
  signal?: AbortSignal,
  options?: { batchSize?: number; retries?: number; saveCheckpointEvery?: number }
): Promise<OfflineAudioPack> {
  if (typeof caches === 'undefined') {
    throw new Error('ذاكرة التخزين المؤقت غير مدعومة في هذا المتصفح');
  }

  await requestPersistentStorage();

  const cache = await caches.open(AUDIO_CACHE_NAME);
  const total = pack.urls.length;
  let completed = 0;
  let newDownloads = 0;

  const batchSize = options?.batchSize || (total > 500 ? 8 : 4);
  const retries = options?.retries ?? 2;
  const saveCheckpointEvery = options?.saveCheckpointEvery ?? 120;

  let wasAborted = false;

  for (let i = 0; i < total; i += batchSize) {
    if (signal?.aborted) {
      wasAborted = true;
      break;
    }
    const batch = pack.urls.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (url) => {
        if (signal?.aborted) return;
        const existing = await cache.match(url);
        const isCorsSupported = url.includes('everyayah.com');
        if (existing && (!isCorsSupported || (existing.ok && existing.type !== 'opaque'))) {
          completed += 1;
          onProgress(completed, total);
          return;
        }
        try {
          const res = await fetchWithRetry(url, isCorsSupported, signal, retries);
          if (res) {
            await cache.put(url, res);
            completed += 1;
            newDownloads += 1;
          }
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            wasAborted = true;
          }
        }
        onProgress(completed, total);
      })
    );

    if (wasAborted || signal?.aborted) {
      wasAborted = true;
      break;
    }

    if (newDownloads > 0 && newDownloads % saveCheckpointEvery < batchSize) {
      await saveAudioPackRecord({
        ...pack,
        completedCount: completed,
        isComplete: completed >= total,
        savedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  const savedPack: OfflineAudioPack = {
    ...pack,
    completedCount: completed,
    isComplete: !wasAborted && completed >= total,
    savedAt: new Date().toISOString(),
  };

  if (completed > 0) {
    await saveAudioPackRecord(savedPack);
  }

  if (wasAborted) {
    throw new Error(`تم إيقاف التنزيل مؤقتاً وحفظ التقدم (${completed} / ${total} مقطع محفوظ بدون إنترنت).`);
  }

  return savedPack;
}

export async function removeOfflineAudioPack(pack: OfflineAudioPack): Promise<void> {
  if (typeof caches !== 'undefined') {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const chunkSize = 200;
    for (let i = 0; i < pack.urls.length; i += chunkSize) {
      await Promise.all(pack.urls.slice(i, i + chunkSize).map((url) => cache.delete(url)));
    }
  }
  const db = await openOfflineDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIO_PACKS_STORE, 'readwrite');
    tx.objectStore(AUDIO_PACKS_STORE).delete(pack.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function removeReciterOfflineAudio(reciterIdentifier: string): Promise<void> {
  if (typeof caches !== 'undefined') {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const keys = await cache.keys();
    const marker = `/data/${reciterIdentifier}/`;
    const matching = keys.filter((req) => req.url.includes(marker));
    const chunkSize = 200;
    for (let i = 0; i < matching.length; i += chunkSize) {
      await Promise.all(matching.slice(i, i + chunkSize).map((req) => cache.delete(req)));
    }
  }

  const reciter = RECITERS.find((r) => r.identifier === reciterIdentifier);
  if (reciter) {
    const packs = await listOfflineAudioPacks();
    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIO_PACKS_STORE, 'readwrite');
      const store = tx.objectStore(AUDIO_PACKS_STORE);
      for (const p of packs) {
        if (p.id.endsWith(`_${reciter.id}`) || p.id === `full_mushaf_${reciter.id}`) {
          store.delete(p.id);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }
}

export async function getRecitersOfflineCoverage(): Promise<ReciterOfflineCoverage[]> {
  const countsByIdentifier = new Map<string, Set<string>>();
  for (const r of RECITERS) {
    countsByIdentifier.set(r.identifier, new Set<string>());
  }

  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const keys = await cache.keys();
      const pattern = /\/data\/([^/]+)\/(\d{6}\.mp3)/;
      for (const req of keys) {
        const match = req.url.match(pattern);
        if (match) {
          const identifier = match[1];
          const file = match[2];
          const set = countsByIdentifier.get(identifier);
          if (set) {
            set.add(file);
          }
        }
      }
    }
  } catch {}

  return RECITERS.map((r) => {
    const cachedAyahs = Math.min(countsByIdentifier.get(r.identifier)?.size || 0, TOTAL_QURAN_AYAHS);
    const percentage = Math.round((cachedAyahs / TOTAL_QURAN_AYAHS) * 100);
    // Estimate full Mushaf size based on reciter bitrate/style (~280MB for 40kbps, ~420MB for 128kbps, ~560MB for 192kbps)
    const estimatedTotalMB = r.identifier.includes('40kbps')
      ? 280
      : r.identifier.includes('192kbps')
      ? 560
      : 420;
    return {
      reciterId: r.id,
      identifier: r.identifier,
      name: r.name,
      style: r.style,
      cachedAyahs,
      totalAyahs: TOTAL_QURAN_AYAHS,
      percentage,
      isComplete: cachedAyahs >= TOTAL_QURAN_AYAHS,
      estimatedTotalMB,
    };
  });
}

export async function isSurahCachedOffline(
  surah: Surah,
  reciterIdentifier: string
): Promise<{ cachedCount: number; totalCount: number; isComplete: boolean }> {
  const urls = getSurahAyahAudioUrls(surah, reciterIdentifier);
  if (typeof caches === 'undefined') {
    return { cachedCount: 0, totalCount: urls.length, isComplete: false };
  }
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const results = await Promise.all(
      urls.map(async (url) => {
        const hit = await cache.match(url);
        return Boolean(hit && hit.ok && hit.type !== 'opaque');
      })
    );
    const cachedCount = results.filter(Boolean).length;
    return {
      cachedCount,
      totalCount: urls.length,
      isComplete: cachedCount >= urls.length,
    };
  } catch {
    return { cachedCount: 0, totalCount: urls.length, isComplete: false };
  }
}

export async function getStorageSummary(): Promise<{
  usedMB: number;
  quotaMB: number;
  cachedAudioFiles: number;
  swReady: boolean;
  persisted: boolean;
}> {
  let usedMB = 0;
  let quotaMB = 0;
  let cachedAudioFiles = 0;
  let swReady = false;
  let persisted = false;

  try {
    if (navigator.storage) {
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        usedMB = Math.round(((est.usage || 0) / (1024 * 1024)) * 10) / 10;
        quotaMB = Math.round(((est.quota || 0) / (1024 * 1024)) * 10) / 10;
      }
      if (navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }
    }
  } catch {}

  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const keys = await cache.keys();
      cachedAudioFiles = keys.length;
    }
  } catch {}

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      swReady = regs.length > 0;
    }
  } catch {}

  return { usedMB, quotaMB, cachedAudioFiles, swReady, persisted };
}

export function getPopularOfflineSurahs(): Surah[] {
  const popularNumbers = [1, 18, 36, 55, 67, 112, 113, 114];
  return popularNumbers
    .map((num) => QURAN_SURAHS.find((s) => s.number === num))
    .filter((s): s is Surah => Boolean(s));
}
