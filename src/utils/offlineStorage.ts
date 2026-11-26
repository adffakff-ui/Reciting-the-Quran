import { QURAN_SURAHS, RECITERS, Surah, getReciterAyahAudioUrl } from '../data/quranData';
import { ADHKAR_LIST, ADHKAR_SHEIKHS, AdhkarSheikh } from '../data/adhkarData';

export const AUDIO_CACHE_NAME = 'quran-audio-cache';
const IDB_NAME = 'murtal_offline_db';
const IDB_VERSION = 1;
const SNAPSHOTS_STORE = 'snapshots';
const AUDIO_PACKS_STORE = 'audio_packs';

export const BACKUP_LOCAL_STORAGE_KEYS = [
  'quran_bookmarks',
  'hifz_spaced_cards',
  'hifz_memorized_surahs',
  'adhkar_counters',
  'mushaf_reciter',
  'mushaf_auto_continue',
  'mushaf_auto_next_surah',
  'mushaf_play_basmalah',
  'mushaf_speed',
  'adhkar_sheikh_id',
  'adhkar_playback_speed',
] as const;

export interface BackupStats {
  bookmarksCount: number;
  spacedCardsCount: number;
  adhkarCountersCount: number;
  settingsCount: number;
  memorizedSurahsCount?: number;
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
  type: 'surah' | 'adhkar';
  title: string;
  subtitle: string;
  reciterName: string;
  urls: string[];
  ayahCount: number;
  savedAt: string;
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
  ];
  settingsCount = settingKeys.filter((k) => data[k] !== undefined).length;

  return {
    bookmarksCount,
    spacedCardsCount,
    adhkarCountersCount,
    settingsCount,
    memorizedSurahsCount,
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

export function getSurahAyahAudioUrls(surah: Surah, reciterIdentifier: string): string[] {
  return surah.ayahs.map((a) => getReciterAyahAudioUrl(reciterIdentifier, surah.number, a.number));
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

export async function downloadAudioPackOffline(
  pack: Omit<OfflineAudioPack, 'savedAt'>,
  onProgress: (completed: number, total: number) => void,
  signal?: AbortSignal
): Promise<OfflineAudioPack> {
  if (typeof caches === 'undefined') {
    throw new Error('ذاكرة التخزين المؤقت غير مدعومة في هذا المتصفح');
  }

  const cache = await caches.open(AUDIO_CACHE_NAME);
  const total = pack.urls.length;
  let completed = 0;

  const batchSize = 4;
  for (let i = 0; i < total; i += batchSize) {
    if (signal?.aborted) {
      throw new Error('تم إلغاء التنزيل');
    }
    const batch = pack.urls.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (url) => {
        if (signal?.aborted) return;
        const existing = await cache.match(url);
        if (!existing) {
          const isCorsSupported = url.includes('everyayah.com');
          const res = await fetch(url, {
            mode: isCorsSupported ? 'cors' : 'no-cors',
            signal,
          });
          if (res && (res.ok || res.type === 'opaque')) {
            await cache.put(url, res);
          }
        }
        completed += 1;
        onProgress(completed, total);
      })
    );
  }

  const savedPack: OfflineAudioPack = {
    ...pack,
    savedAt: new Date().toISOString(),
  };

  const db = await openOfflineDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIO_PACKS_STORE, 'readwrite');
    tx.objectStore(AUDIO_PACKS_STORE).put(savedPack);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  return savedPack;
}

export async function removeOfflineAudioPack(pack: OfflineAudioPack): Promise<void> {
  if (typeof caches !== 'undefined') {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await Promise.all(pack.urls.map((url) => cache.delete(url)));
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

export async function getStorageSummary(): Promise<{
  usedMB: number;
  quotaMB: number;
  cachedAudioFiles: number;
  swReady: boolean;
}> {
  let usedMB = 0;
  let quotaMB = 0;
  let cachedAudioFiles = 0;
  let swReady = false;

  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      usedMB = Math.round(((est.usage || 0) / (1024 * 1024)) * 10) / 10;
      quotaMB = Math.round(((est.quota || 0) / (1024 * 1024)) * 10) / 10;
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

  return { usedMB, quotaMB, cachedAudioFiles, swReady };
}

export function getPopularOfflineSurahs(): Surah[] {
  const popularNumbers = [1, 18, 36, 55, 67, 112, 113, 114];
  return popularNumbers
    .map((num) => QURAN_SURAHS.find((s) => s.number === num))
    .filter((s): s is Surah => Boolean(s));
}
