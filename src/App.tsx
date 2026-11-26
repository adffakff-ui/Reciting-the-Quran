/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { APP_VERSION, BACKUP_LOCAL_STORAGE_KEYS } from './utils/offlineStorage';
import { RECITER_PREFERENCES_EVENT, stopArabicSpeech } from './utils/reciterPreferences';
import { NAV_PREFERENCES_EVENT } from './utils/navPreferences';

const SESSION_SIGNED_OUT_KEY = 'murtal_session_signed_out';

export default function App() {
  const [activeTab, setActiveTab] = useState('mushaf');
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('quran_bookmarks');
      return saved ? JSON.parse(saved) : ['1:1', '1:7'];
    } catch {
      return ['1:1', '1:7'];
    }
  });
  const [streak] = useState(7);
  const [coachParams, setCoachParams] = useState<{ surahName: string; ayahText: string; ayahNumber?: number } | null>(null);
  const [targetBookmark, setTargetBookmark] = useState<{ surahName: string; ayahKey: string; nonce: number } | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [isSignedOut, setIsSignedOut] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SESSION_SIGNED_OUT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [clearedOnSignOut, setClearedOnSignOut] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('quran_bookmarks', JSON.stringify(bookmarks));
    } catch (e) {
      console.error(e);
    }
  }, [bookmarks]);

  useEffect(() => {
    const syncRestoredBookmarks = () => {
      try {
        const saved = localStorage.getItem('quran_bookmarks');
        if (saved) {
          setBookmarks(JSON.parse(saved));
        }
      } catch {}
    };
    window.addEventListener('murtal-backup-restored', syncRestoredBookmarks);
    return () => window.removeEventListener('murtal-backup-restored', syncRestoredBookmarks);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeTab]);

  const handleToggleBookmark = (ayahKey: string) => {
    setBookmarks(prev =>
      prev.includes(ayahKey) ? prev.filter(k => k !== ayahKey) : [...prev, ayahKey]
    );
  };

  const handleSelectAyahForCoach = (surahName: string, ayahText: string, ayahNumber?: number) => {
    setCoachParams({ surahName, ayahText, ayahNumber });
    setActiveTab('coach');
  };

  const handleConfirmSignOut = (clearLocalData: boolean) => {
    stopArabicSpeech();
    if (clearLocalData) {
      try {
        BACKUP_LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      } catch {}
      setBookmarks(['1:1', '1:7']);
      window.dispatchEvent(new CustomEvent(RECITER_PREFERENCES_EVENT));
      window.dispatchEvent(new CustomEvent(NAV_PREFERENCES_EVENT));
      window.dispatchEvent(new CustomEvent('murtal-backup-restored'));
    }
    try {
      localStorage.setItem(SESSION_SIGNED_OUT_KEY, '1');
    } catch {}
    setClearedOnSignOut(clearLocalData);
    setSignOutConfirmOpen(false);
    setIsSignedOut(true);
  };

  const handleResumeSession = (targetTab = 'mushaf') => {
    try {
      localStorage.removeItem(SESSION_SIGNED_OUT_KEY);
    } catch {}
    setClearedOnSignOut(false);
    setActiveTab(targetTab);
    setIsSignedOut(false);
  };

  if (isSignedOut) {
    return (
      <>
        <SignedOutView
          clearedData={clearedOnSignOut}
          onResumeSession={() => handleResumeSession('mushaf')}
          onOpenBackup={() => handleResumeSession('backup')}
          onOpenAbout={() => setAboutOpen(true)}
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
        onOpenAbout={() => setAboutOpen(true)}
        onRequestSignOut={() => setSignOutConfirmOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16 w-full max-w-full overflow-x-clip">
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
        <div className="flex items-center justify-center gap-4 text-xs">
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

      {/* About & Sign Out Modals */}
      <AboutModal
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      <SignOutModal
        isOpen={signOutConfirmOpen}
        onClose={() => setSignOutConfirmOpen(false)}
        bookmarksCount={bookmarks.length}
        streak={streak}
        onConfirmSignOut={handleConfirmSignOut}
      />
    </div>
  );
}
