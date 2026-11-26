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
  const [streak, setStreak] = useState(7);
  const [coachParams, setCoachParams] = useState<{ surahName: string; ayahText: string; ayahNumber?: number } | null>(null);

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

  const handleToggleBookmark = (ayahKey: string) => {
    setBookmarks(prev => 
      prev.includes(ayahKey) ? prev.filter(k => k !== ayahKey) : [...prev, ayahKey]
    );
  };

  const handleSelectAyahForCoach = (surahName: string, ayahText: string, ayahNumber?: number) => {
    setCoachParams({ surahName, ayahText, ayahNumber });
    setActiveTab('coach');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-cairo w-full max-w-full overflow-x-hidden">
      {/* Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} streak={streak} />

      {/* Main Content Area */}
      <main className="flex-1 pb-16 w-full max-w-full overflow-x-hidden">
        {activeTab === 'mushaf' && (
          <MushafView
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
            onSelectAyahForCoach={handleSelectAyahForCoach}
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
        {activeTab === 'guide' && <TajweedGuideView />}
        {activeTab === 'dashboard' && (
          <DashboardView
            streak={streak}
            bookmarks={bookmarks}
            onSelectBookmark={(surahName, ayahKey) => {
              setActiveTab('mushaf');
            }}
            onOpenBackup={() => setActiveTab('backup')}
          />
        )}
        {activeTab === 'backup' && <OfflineBackupView />}
      </main>

      <OfflineIndicator />

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 bg-slate-950 text-center text-xs text-slate-500">
        <p>مرتل القرآن الذكي • نظام متكامل لترتيل القرآن الكريم وتجويده وحفظه بالذكاء الاصطناعي</p>
      </footer>
    </div>
  );
}
