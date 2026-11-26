/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { MushafView } from './components/MushafView';
import { TajweedCoachView } from './components/TajweedCoachView';
import { HifzQuizView } from './components/HifzQuizView';
import { TajweedGuideView } from './components/TajweedGuideView';
import { DashboardView } from './components/DashboardView';
import { AdhkarView } from './components/AdhkarView';
import { SpacedRepetitionView } from './components/SpacedRepetitionView';
import { OfflineBackupView } from './components/OfflineBackupView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ShatibiyyahView } from './components/ShatibiyyahView';
import { JazariyyahView } from './components/JazariyyahView';
import { HisnAlMuslimView } from './components/HisnAlMuslimView';
import { AboutModal } from './components/AboutModal';
import { SignOutModal, SignedOutView } from './components/SignOutFlow';
import { ProfilesModal } from './components/ProfilesModal';
import { APP_VERSION } from './utils/offlineStorage';
import { stopArabicSpeech } from './utils/reciterPreferences';
import {
  ProfilesStore,
  USER_PROFILES_EVENT,
  getActiveProfile,
  initOrGetProfilesStore,
  resetActiveProfileProgress,
  switchUserProfile,
  syncActiveProfileSnapshot,
} from './utils/userProfiles';

const SESSION_SIGNED_OUT_KEY = 'murtal_session_signed_out';

function readLiveBookmarks(): string[] {
  try {
    const saved = localStorage.getItem('quran_bookmarks');
    return saved ? JSON.parse(saved) : ['1:1', '1:7'];
  } catch {
    return ['1:1', '1:7'];
  }
}

export default function App() {
  const [profilesStore, setProfilesStore] = useState<ProfilesStore>(() =>
    initOrGetProfilesStore()
  );
  const [profileRevision, setProfileRevision] = useState(0);
  const [activeTab, setActiveTab] = useState('mushaf');
  const [bookmarks, setBookmarks] = useState<string[]>(() => readLiveBookmarks());
  const [coachParams, setCoachParams] = useState<{
    surahName: string;
    ayahText: string;
    ayahNumber?: number;
  } | null>(null);
  const [targetBookmark, setTargetBookmark] = useState<{
    surahName: string;
    ayahKey: string;
    nonce: number;
  } | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [profilesModalOpen, setProfilesModalOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [isSignedOut, setIsSignedOut] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SESSION_SIGNED_OUT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [clearedOnSignOut, setClearedOnSignOut] = useState(false);

  const activeProfile = getActiveProfile(profilesStore);
  const streak = activeProfile.streak || 1;

  // Persist bookmarks & keep active profile snapshot synced
  useEffect(() => {
    try {
      localStorage.setItem('quran_bookmarks', JSON.stringify(bookmarks));
      syncActiveProfileSnapshot();
    } catch (e) {
      console.error(e);
    }
  }, [bookmarks]);

  // Keep active profile snapshot in sync with backup restores, tab switches, and page unload
  useEffect(() => {
    const syncRestored = () => {
      setBookmarks(readLiveBookmarks());
      setProfilesStore(syncActiveProfileSnapshot());
    };
    const syncProfilesList = () => {
      setProfilesStore(initOrGetProfilesStore());
    };
    const handleVisibilityOrUnload = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        syncActiveProfileSnapshot();
      }
    };
    const handleBeforeUnload = () => {
      syncActiveProfileSnapshot();
    };

    window.addEventListener('murtal-backup-restored', syncRestored);
    window.addEventListener(USER_PROFILES_EVENT, syncProfilesList);
    document.addEventListener('visibilitychange', handleVisibilityOrUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('murtal-backup-restored', syncRestored);
      window.removeEventListener(USER_PROFILES_EVENT, syncProfilesList);
      document.removeEventListener('visibilitychange', handleVisibilityOrUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    syncActiveProfileSnapshot();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeTab]);

  const handleSwitchProfile = useCallback((targetProfileId: string) => {
    stopArabicSpeech();
    const updatedStore = switchUserProfile(targetProfileId);
    setProfilesStore(updatedStore);
    setBookmarks(readLiveBookmarks());
    setCoachParams(null);
    setTargetBookmark(null);
    setProfileRevision((r) => r + 1);
  }, []);

  const handleToggleBookmark = (ayahKey: string) => {
    setBookmarks((prev) =>
      prev.includes(ayahKey) ? prev.filter((k) => k !== ayahKey) : [...prev, ayahKey]
    );
  };

  const handleSelectAyahForCoach = (
    surahName: string,
    ayahText: string,
    ayahNumber?: number
  ) => {
    setCoachParams({ surahName, ayahText, ayahNumber });
    setActiveTab('coach');
  };

  const handleConfirmSignOut = (clearLocalData: boolean) => {
    stopArabicSpeech();
    if (clearLocalData) {
      const resetStore = resetActiveProfileProgress();
      setProfilesStore(resetStore);
      setBookmarks(['1:1', '1:7']);
    } else {
      setProfilesStore(syncActiveProfileSnapshot());
    }
    try {
      localStorage.setItem(SESSION_SIGNED_OUT_KEY, '1');
    } catch {}
    setClearedOnSignOut(clearLocalData);
    setSignOutConfirmOpen(false);
    setIsSignedOut(true);
  };

  const handleResumeSession = (targetTab = 'mushaf', profileId?: string) => {
    if (profileId) {
      handleSwitchProfile(profileId);
    }
    try {
      localStorage.removeItem(SESSION_SIGNED_OUT_KEY);
    } catch {}
    setClearedOnSignOut(false);
    setProfilesModalOpen(false);
    setAboutOpen(false);
    setActiveTab(targetTab);
    setIsSignedOut(false);
  };

  if (isSignedOut) {
    return (
      <>
        <SignedOutView
          profiles={profilesStore.profiles}
          activeProfileId={activeProfile.id}
          clearedData={clearedOnSignOut}
          onSelectProfileAndResume={(profileId) =>
            handleResumeSession('mushaf', profileId)
          }
          onOpenProfilesManager={() => setProfilesModalOpen(true)}
          onOpenBackup={() => handleResumeSession('backup')}
          onOpenAbout={() => setAboutOpen(true)}
        />
        <ProfilesModal
          isOpen={profilesModalOpen}
          onClose={() => setProfilesModalOpen(false)}
          onSwitchProfile={(profileId) => handleResumeSession('mushaf', profileId)}
        />
        <AboutModal
          isOpen={aboutOpen}
          onClose={() => setAboutOpen(false)}
          onNavigate={(tab) => handleResumeSession(tab)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-cairo w-full max-w-full overflow-x-clip">
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        streak={streak}
        activeProfile={activeProfile}
        profiles={profilesStore.profiles}
        onOpenProfiles={() => setProfilesModalOpen(true)}
        onQuickSwitchProfile={handleSwitchProfile}
        onOpenAbout={() => setAboutOpen(true)}
        onRequestSignOut={() => setSignOutConfirmOpen(true)}
      />

      {/* Main Content Area (keyed by activeProfile.id + revision for clean isolated reload on switch) */}
      <main
        key={`${activeProfile.id}_${profileRevision}`}
        className="flex-1 pb-16 w-full max-w-full overflow-x-clip"
      >
        {activeTab === 'mushaf' && (
          <MushafView
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
            onSelectAyahForCoach={handleSelectAyahForCoach}
            targetBookmark={targetBookmark}
          />
        )}
        {activeTab === 'coach' && (
          <TajweedCoachView
            initialSurahName={coachParams?.surahName}
            initialAyahText={coachParams?.ayahText}
            initialAyahNumber={coachParams?.ayahNumber}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
          />
        )}
        {activeTab === 'quiz' && <HifzQuizView />}
        {activeTab === 'spaced' && <SpacedRepetitionView />}
        {activeTab === 'adhkar' && <AdhkarView />}
        {activeTab === 'hisn' && <HisnAlMuslimView />}
        {activeTab === 'guide' && <TajweedGuideView />}
        {activeTab === 'jazariyyah' && <JazariyyahView />}
        {activeTab === 'shatibiyyah' && <ShatibiyyahView />}
        {activeTab === 'dashboard' && (
          <DashboardView
            streak={streak}
            bookmarks={bookmarks}
            onSelectBookmark={(surahName, ayahKey) => {
              setTargetBookmark({ surahName, ayahKey, nonce: Date.now() });
              setActiveTab('mushaf');
            }}
            onOpenBackup={() => setActiveTab('backup')}
          />
        )}
        {activeTab === 'backup' && <OfflineBackupView />}
      </main>

      <OfflineIndicator />

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-slate-900 bg-slate-950 text-center text-xs text-slate-500 space-y-2">
        <p className="tabular-nums">
          مرتل القرآن الذكي · نظام متكامل لترتيل القرآن الكريم وتجويده وحفظه · الإصدار {APP_VERSION}
        </p>
        <div className="flex items-center justify-center flex-wrap gap-3 sm:gap-4 text-xs">
          <button
            type="button"
            onClick={() => setProfilesModalOpen(true)}
            className="text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer py-1 px-2"
          >
            ملفات العائلة ({activeProfile.name})
          </button>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer py-1 px-2"
          >
            عنا
          </button>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className="text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer py-1 px-2"
          >
            النسخة الاحتياطية
          </button>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <button
            type="button"
            onClick={() => setSignOutConfirmOpen(true)}
            className="text-slate-400 hover:text-rose-300 transition-colors cursor-pointer py-1 px-2"
          >
            تسجيل خروج
          </button>
        </div>
      </footer>

      {/* Profiles, About & Sign Out Modals */}
      <ProfilesModal
        isOpen={profilesModalOpen}
        onClose={() => setProfilesModalOpen(false)}
        onSwitchProfile={handleSwitchProfile}
      />

      <AboutModal
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      <SignOutModal
        isOpen={signOutConfirmOpen}
        onClose={() => setSignOutConfirmOpen(false)}
        activeProfile={activeProfile}
        bookmarksCount={bookmarks.length}
        streak={streak}
        onConfirmSignOut={handleConfirmSignOut}
      />
    </div>
  );
}
