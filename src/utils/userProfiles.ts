import { BACKUP_LOCAL_STORAGE_KEYS } from './offlineStorage';
import { RECITER_PREFERENCES_EVENT } from './reciterPreferences';
import { NAV_PREFERENCES_EVENT } from './navPreferences';

export const USER_PROFILES_STORAGE_KEY = 'murtal_user_profiles_v1';
export const USER_PROFILES_EVENT = 'murtal-user-profiles-changed';

export type ProfileColor = 'emerald' | 'teal' | 'amber' | 'indigo' | 'rose' | 'sky';

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  avatarColor: ProfileColor;
  createdAt: string;
  lastActiveAt: string;
  streak: number;
  data: Record<string, string>;
}

export interface ProfilesStore {
  activeProfileId: string;
  profiles: UserProfile[];
}

export interface ProfileProgressSummary {
  memorizedSurahsCount: number;
  tajweedSavedCount: number;
  spacedCardsCount: number;
  bookmarksCount: number;
  adhkarCompletedCount: number;
}

const VALID_COLORS: ProfileColor[] = ['emerald', 'teal', 'amber', 'indigo', 'rose', 'sky'];

function readLivePerUserStorage(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  if (typeof localStorage === 'undefined') return snapshot;
  for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) {
        snapshot[key] = val;
      }
    } catch {}
  }
  return snapshot;
}

function writeLivePerUserStorage(data: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
    try {
      if (Object.prototype.hasOwnProperty.call(data, key) && typeof data[key] === 'string') {
        localStorage.setItem(key, data[key]);
      } else {
        localStorage.removeItem(key);
      }
    } catch {}
  }
}

function dispatchProfileSyncEvents(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RECITER_PREFERENCES_EVENT));
  window.dispatchEvent(new CustomEvent(NAV_PREFERENCES_EVENT));
  window.dispatchEvent(new CustomEvent('murtal-backup-restored'));
  window.dispatchEvent(new CustomEvent(USER_PROFILES_EVENT));
}

function sanitizeProfile(raw: Partial<UserProfile>, idx: number): UserProfile {
  const now = new Date().toISOString();
  const safeData: Record<string, string> = {};
  if (raw.data && typeof raw.data === 'object') {
    for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
      const val = (raw.data as Record<string, unknown>)[key];
      if (typeof val === 'string') {
        safeData[key] = val;
      }
    }
  }
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `profile_${idx}_${Date.now()}`,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `مستخدم ${idx + 1}`,
    role: typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : 'فرد من العائلة',
    avatarColor: VALID_COLORS.includes(raw.avatarColor as ProfileColor)
      ? (raw.avatarColor as ProfileColor)
      : VALID_COLORS[idx % VALID_COLORS.length],
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    lastActiveAt: typeof raw.lastActiveAt === 'string' ? raw.lastActiveAt : now,
    streak: typeof raw.streak === 'number' && Number.isFinite(raw.streak) && raw.streak >= 0 ? raw.streak : 1,
    data: safeData,
  };
}

function persistProfilesStore(store: ProfilesStore, emitEvent = true): ProfilesStore {
  try {
    localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(store));
  } catch {}
  if (emitEvent && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(USER_PROFILES_EVENT, { detail: store }));
  }
  return store;
}

export function initOrGetProfilesStore(): ProfilesStore {
  const now = new Date().toISOString();
  try {
    const raw = localStorage.getItem(USER_PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProfilesStore>;
      if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
        const profiles = parsed.profiles.map((p, i) => sanitizeProfile(p, i));
        const activeId = profiles.some((p) => p.id === parsed.activeProfileId)
          ? (parsed.activeProfileId as string)
          : profiles[0].id;
        return { activeProfileId: activeId, profiles };
      }
    }
  } catch {}

  const defaultProfile: UserProfile = {
    id: 'profile_default',
    name: 'المستخدم الرئيسي',
    role: 'الملف الأساسي',
    avatarColor: 'emerald',
    createdAt: now,
    lastActiveAt: now,
    streak: 7,
    data: readLivePerUserStorage(),
  };

  const initialStore: ProfilesStore = {
    activeProfileId: defaultProfile.id,
    profiles: [defaultProfile],
  };

  return persistProfilesStore(initialStore, false);
}

export function getActiveProfile(store?: ProfilesStore): UserProfile {
  const current = store || initOrGetProfilesStore();
  return current.profiles.find((p) => p.id === current.activeProfileId) || current.profiles[0];
}

/**
 * Saves live localStorage progress & settings of the currently active profile
 * back into its isolated slot inside USER_PROFILES_STORAGE_KEY.
 */
export function syncActiveProfileSnapshot(): ProfilesStore {
  const store = initOrGetProfilesStore();
  const liveData = readLivePerUserStorage();
  const now = new Date().toISOString();
  const updated: ProfilesStore = {
    ...store,
    profiles: store.profiles.map((p) =>
      p.id === store.activeProfileId
        ? { ...p, lastActiveAt: now, data: liveData }
        : p
    ),
  };
  return persistProfilesStore(updated, false);
}

export function createUserProfile(params: {
  name: string;
  role?: string;
  avatarColor?: ProfileColor;
  copyDisplayPreferences?: boolean;
  switchImmediately?: boolean;
}): { store: ProfilesStore; created: UserProfile } {
  const synced = syncActiveProfileSnapshot();
  const now = new Date().toISOString();
  const cleanName = params.name.trim() || `قارئ ${synced.profiles.length + 1}`;
  const cleanRole = (params.role || '').trim() || 'فرد من العائلة';
  const color =
    params.avatarColor && VALID_COLORS.includes(params.avatarColor)
      ? params.avatarColor
      : VALID_COLORS[synced.profiles.length % VALID_COLORS.length];

  const activeCurrent = getActiveProfile(synced);
  const initialData: Record<string, string> = {};

  if (params.copyDisplayPreferences) {
    const prefKeys = ['murtal_reciter_preferences', 'murtal_nav_preferences', 'mushaf_reciter', 'adhkar_sheikh_id'];
    for (const k of prefKeys) {
      if (typeof activeCurrent.data[k] === 'string') {
        initialData[k] = activeCurrent.data[k];
      }
    }
  }

  const newProfile: UserProfile = {
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    role: cleanRole,
    avatarColor: color,
    createdAt: now,
    lastActiveAt: now,
    streak: 1,
    data: initialData,
  };

  if (params.switchImmediately !== false) {
    writeLivePerUserStorage(newProfile.data);
    const nextStore = persistProfilesStore({
      activeProfileId: newProfile.id,
      profiles: [...synced.profiles, newProfile],
    });
    dispatchProfileSyncEvents();
    return { store: nextStore, created: newProfile };
  }

  const nextStore = persistProfilesStore({
    ...synced,
    profiles: [...synced.profiles, newProfile],
  });
  return { store: nextStore, created: newProfile };
}

export function switchUserProfile(targetProfileId: string): ProfilesStore {
  const synced = syncActiveProfileSnapshot();
  const target = synced.profiles.find((p) => p.id === targetProfileId);
  if (!target) return synced;

  if (target.id === synced.activeProfileId) {
    return synced;
  }

  writeLivePerUserStorage(target.data);
  const now = new Date().toISOString();
  const nextStore = persistProfilesStore({
    activeProfileId: target.id,
    profiles: synced.profiles.map((p) =>
      p.id === target.id ? { ...p, lastActiveAt: now } : p
    ),
  });
  dispatchProfileSyncEvents();
  return nextStore;
}

export function updateUserProfileDetails(
  profileId: string,
  updates: { name?: string; role?: string; avatarColor?: ProfileColor }
): ProfilesStore {
  const synced = syncActiveProfileSnapshot();
  const nextStore = persistProfilesStore({
    ...synced,
    profiles: synced.profiles.map((p) => {
      if (p.id !== profileId) return p;
      return {
        ...p,
        name: updates.name?.trim() ? updates.name.trim() : p.name,
        role: updates.role?.trim() ? updates.role.trim() : p.role,
        avatarColor:
          updates.avatarColor && VALID_COLORS.includes(updates.avatarColor)
            ? updates.avatarColor
            : p.avatarColor,
      };
    }),
  });
  return nextStore;
}

export function resetActiveProfileProgress(): ProfilesStore {
  const synced = syncActiveProfileSnapshot();
  writeLivePerUserStorage({});
  const nextStore = persistProfilesStore({
    ...synced,
    profiles: synced.profiles.map((p) =>
      p.id === synced.activeProfileId
        ? { ...p, streak: 1, data: {} }
        : p
    ),
  });
  dispatchProfileSyncEvents();
  return nextStore;
}

export function deleteUserProfile(profileId: string): ProfilesStore {
  const synced = syncActiveProfileSnapshot();
  if (synced.profiles.length <= 1) {
    return synced;
  }

  const remaining = synced.profiles.filter((p) => p.id !== profileId);
  const wasActive = synced.activeProfileId === profileId;
  const nextActive = wasActive ? remaining[0] : getActiveProfile({ activeProfileId: synced.activeProfileId, profiles: remaining });

  if (wasActive) {
    writeLivePerUserStorage(nextActive.data);
  }

  const nextStore = persistProfilesStore({
    activeProfileId: nextActive.id,
    profiles: remaining,
  });

  if (wasActive) {
    dispatchProfileSyncEvents();
  }
  return nextStore;
}

export function getProfileProgressSummary(
  profile: UserProfile,
  isActive = false
): ProfileProgressSummary {
  const data = isActive ? readLivePerUserStorage() : profile.data;

  const safeParseArrayLen = (key: string): number => {
    try {
      const raw = data[key];
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  const countNonZeroCounters = (key: string): number => {
    try {
      const raw = data[key];
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as Record<string, number>;
      if (!parsed || typeof parsed !== 'object') return 0;
      return Object.values(parsed).filter((v) => typeof v === 'number' && v > 0).length;
    } catch {
      return 0;
    }
  };

  return {
    memorizedSurahsCount: safeParseArrayLen('hifz_memorized_surahs'),
    tajweedSavedCount: safeParseArrayLen('coach_saved_ayahs'),
    spacedCardsCount: safeParseArrayLen('hifz_spaced_cards'),
    bookmarksCount: safeParseArrayLen('quran_bookmarks'),
    adhkarCompletedCount:
      countNonZeroCounters('adhkar_counters') + countNonZeroCounters('hisn_counters'),
  };
}

export function getProfileColorClasses(color: ProfileColor): {
  bg: string;
  border: string;
  text: string;
  ring: string;
} {
  switch (color) {
    case 'teal':
      return {
        bg: 'bg-teal-600',
        border: 'border-teal-500/50',
        text: 'text-teal-300',
        ring: 'ring-teal-500/40',
      };
    case 'amber':
      return {
        bg: 'bg-amber-600',
        border: 'border-amber-500/50',
        text: 'text-amber-300',
        ring: 'ring-amber-500/40',
      };
    case 'indigo':
      return {
        bg: 'bg-indigo-600',
        border: 'border-indigo-500/50',
        text: 'text-indigo-300',
        ring: 'ring-indigo-500/40',
      };
    case 'rose':
      return {
        bg: 'bg-rose-600',
        border: 'border-rose-500/50',
        text: 'text-rose-300',
        ring: 'ring-rose-500/40',
      };
    case 'sky':
      return {
        bg: 'bg-sky-600',
        border: 'border-sky-500/50',
        text: 'text-sky-300',
        ring: 'ring-sky-500/40',
      };
    case 'emerald':
    default:
      return {
        bg: 'bg-emerald-600',
        border: 'border-emerald-500/50',
        text: 'text-emerald-300',
        ring: 'ring-emerald-500/40',
      };
  }
}

export function getProfileInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0) : 'م';
}
