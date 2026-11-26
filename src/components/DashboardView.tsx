import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Sparkles,
  Flame,
  Bookmark,
  CheckCircle2,
  Trophy,
  HardDriveDownload,
  ChevronLeft,
  Plus,
  Check,
  Search,
  Calendar,
  Layers,
  TrendingUp,
  PieChart as PieIcon,
  BarChart2,
  Filter,
  Award,
  RotateCcw,
  X,
  Edit3,
  BookOpen,
  Star,
  Headphones,
  Sliders
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { QURAN_SURAHS, RECITERS, Surah } from '../data/quranData';
import {
  ReciterPreferences,
  ReciterSectionKey,
  getReciterPreferences,
  toggleFavoriteReciter,
  setSectionDefaultReciter,
  setAllDefaultsToReciter,
  sortWithFavoritesFirst,
  formatSheikhOptionLabel,
  RECITER_PREFERENCES_EVENT,
} from '../utils/reciterPreferences';

export interface MemorizedSurahRecord {
  surahNumber: number;
  date: string; // YYYY-MM
  status: 'mastered' | 'reviewing' | 'learning';
}

const DEFAULT_MEMORIZED_SURAHS: MemorizedSurahRecord[] = [
  { surahNumber: 1, date: '2025-11', status: 'mastered' },
  { surahNumber: 114, date: '2025-12', status: 'mastered' },
  { surahNumber: 113, date: '2025-12', status: 'mastered' },
  { surahNumber: 112, date: '2025-12', status: 'mastered' },
  { surahNumber: 111, date: '2026-01', status: 'mastered' },
  { surahNumber: 110, date: '2026-01', status: 'mastered' },
  { surahNumber: 109, date: '2026-01', status: 'mastered' },
  { surahNumber: 108, date: '2026-02', status: 'mastered' },
  { surahNumber: 107, date: '2026-02', status: 'reviewing' },
  { surahNumber: 106, date: '2026-02', status: 'reviewing' },
  { surahNumber: 105, date: '2026-03', status: 'mastered' },
  { surahNumber: 104, date: '2026-03', status: 'reviewing' },
  { surahNumber: 103, date: '2026-03', status: 'mastered' },
  { surahNumber: 102, date: '2026-04', status: 'learning' },
  { surahNumber: 101, date: '2026-04', status: 'reviewing' },
  { surahNumber: 100, date: '2026-04', status: 'learning' },
  { surahNumber: 99, date: '2026-05', status: 'learning' },
  { surahNumber: 67, date: '2026-05', status: 'reviewing' },
  { surahNumber: 78, date: '2026-05', status: 'learning' },
];

const MONTH_NAMES_AR: Record<string, string> = {
  '01': 'يناير',
  '02': 'فبراير',
  '03': 'مارس',
  '04': 'أبريل',
  '05': 'مايو',
  '06': 'يونيو',
  '07': 'يوليو',
  '08': 'أغسطس',
  '09': 'سبتمبر',
  '10': 'أكتوبر',
  '11': 'نوفمبر',
  '12': 'ديسمبر',
};

// 30 Ajzaa Definition with names and corresponding Surahs
const JUZ_MAPPING = [
  { juz: 1, name: 'جزء 1 (الم)', surahs: [1, 2] },
  { juz: 2, name: 'جزء 2 (سيقول)', surahs: [2] },
  { juz: 3, name: 'جزء 3 (تلك الرسل)', surahs: [2, 3] },
  { juz: 4, name: 'جزء 4 (لن تنالوا)', surahs: [3, 4] },
  { juz: 5, name: 'جزء 5 (والمحصنات)', surahs: [4] },
  { juz: 6, name: 'جزء 6 (لا يحب الله)', surahs: [4, 5] },
  { juz: 7, name: 'جزء 7 (وإذا سمعوا)', surahs: [5, 6] },
  { juz: 8, name: 'جزء 8 (ولو أننا)', surahs: [6, 7] },
  { juz: 9, name: 'جزء 9 (قال الملأ)', surahs: [7, 8] },
  { juz: 10, name: 'جزء 10 (واعلموا)', surahs: [8, 9] },
  { juz: 11, name: 'جزء 11 (يعتذرون)', surahs: [9, 10, 11] },
  { juz: 12, name: 'جزء 12 (وما من دابة)', surahs: [11, 12] },
  { juz: 13, name: 'جزء 13 (وما أبرئ)', surahs: [12, 13, 14] },
  { juz: 14, name: 'جزء 14 (ربما)', surahs: [15, 16] },
  { juz: 15, name: 'جزء 15 (سبحان)', surahs: [17, 18] },
  { juz: 16, name: 'جزء 16 (قال ألم)', surahs: [18, 19, 20] },
  { juz: 17, name: 'جزء 17 (اقترب)', surahs: [21, 22] },
  { juz: 18, name: 'جزء 18 (قد أفلح)', surahs: [23, 24, 25] },
  { juz: 19, name: 'جزء 19 (وقال الذين)', surahs: [25, 26, 27] },
  { juz: 20, name: 'جزء 20 (أمن خلق)', surahs: [27, 28, 29] },
  { juz: 21, name: 'جزء 21 (اتل ما أوحي)', surahs: [29, 30, 31, 32, 33] },
  { juz: 22, name: 'جزء 22 (ومن يقنت)', surahs: [33, 34, 35, 36] },
  { juz: 23, name: 'جزء 23 (وما أنزلنا)', surahs: [36, 37, 38, 39] },
  { juz: 24, name: 'جزء 24 (فمن أظلم)', surahs: [39, 40, 41] },
  { juz: 25, name: 'جزء 25 (إليه يرد)', surahs: [41, 42, 43, 44, 45] },
  { juz: 26, name: 'جزء 26 (حم)', surahs: [46, 47, 48, 49, 50, 51] },
  { juz: 27, name: 'جزء 27 (قال فما خطبكم)', surahs: [51, 52, 53, 54, 55, 56, 57] },
  { juz: 28, name: 'جزء 28 (قد سمع)', surahs: [58, 59, 60, 61, 62, 63, 64, 65, 66] },
  { juz: 29, name: 'جزء 29 (تبارك)', surahs: [67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77] },
  { juz: 30, name: 'جزء 30 (عمّ)', surahs: Array.from({ length: 37 }, (_, i) => 78 + i) },
];

const TOTAL_QURAN_AYAHS = 6236;
const TOTAL_QURAN_SURAHS = 114;
const TOTAL_QURAN_JUZ = 30;

interface DashboardViewProps {
  streak: number;
  bookmarks: string[];
  onSelectBookmark: (surahName: string, ayahKey: string) => void;
  onOpenBackup?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  streak,
  bookmarks,
  onSelectBookmark,
  onOpenBackup,
}) => {
  const [memorizedSurahs, setMemorizedSurahs] = useState<MemorizedSurahRecord[]>(() => {
    try {
      const saved = localStorage.getItem('hifz_memorized_surahs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_MEMORIZED_SURAHS;
  });

  const [activeChartTab, setActiveChartTab] = useState<'timeline' | 'ajzaa' | 'mastery'>('timeline');
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  const [managerJuzFilter, setManagerJuzFilter] = useState<number | 'all'>('all');
  const [reciterPrefs, setReciterPrefs] = useState<ReciterPreferences>(() => getReciterPreferences());
  const [prefsNotice, setPrefsNotice] = useState<string | null>(null);

  // Persist to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('hifz_memorized_surahs', JSON.stringify(memorizedSurahs));
    } catch {}
  }, [memorizedSurahs]);

  useEffect(() => {
    const syncPrefs = () => setReciterPrefs(getReciterPreferences());
    window.addEventListener(RECITER_PREFERENCES_EVENT, syncPrefs);
    window.addEventListener('murtal-backup-restored', syncPrefs);
    return () => {
      window.removeEventListener(RECITER_PREFERENCES_EVENT, syncPrefs);
      window.removeEventListener('murtal-backup-restored', syncPrefs);
    };
  }, []);

  const showPrefsNotice = (msg: string) => {
    setPrefsNotice(msg);
    setTimeout(() => {
      setPrefsNotice((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  // Overall calculations
  const stats = useMemo(() => {
    const memorizedMap = new Map<number, MemorizedSurahRecord>();
    memorizedSurahs.forEach(m => memorizedMap.set(m.surahNumber, m));

    let totalAyahs = 0;
    let masteredCount = 0;
    let reviewingCount = 0;
    let learningCount = 0;

    memorizedSurahs.forEach(m => {
      const surah = QURAN_SURAHS.find(s => s.number === m.surahNumber);
      if (surah) {
        totalAyahs += surah.numberOfAyahs;
      }
      if (m.status === 'mastered') masteredCount++;
      else if (m.status === 'reviewing') reviewingCount++;
      else if (m.status === 'learning') learningCount++;
    });

    const surahsCount = memorizedSurahs.length;
    const progressPercent = ((totalAyahs / TOTAL_QURAN_AYAHS) * 100).toFixed(1);
    const ajzaaEquivalent = (totalAyahs / (TOTAL_QURAN_AYAHS / 30)).toFixed(1);

    // Completed 100% Ajzaa count
    let fullyCompletedAjzaa = 0;
    JUZ_MAPPING.forEach(j => {
      const allInJuzMemorized = j.surahs.every(sNum => memorizedMap.has(sNum));
      if (allInJuzMemorized) fullyCompletedAjzaa++;
    });

    return {
      surahsCount,
      totalAyahs,
      progressPercent,
      ajzaaEquivalent,
      fullyCompletedAjzaa,
      masteredCount,
      reviewingCount,
      learningCount,
      remainingCount: TOTAL_QURAN_SURAHS - surahsCount,
      memorizedMap
    };
  }, [memorizedSurahs]);

  // Timeline Data for AreaChart
  const timelineData = useMemo(() => {
    // Collect all distinct months
    const dateMap = new Map<string, number[]>();
    memorizedSurahs.forEach(m => {
      const key = m.date || '2026-01';
      if (!dateMap.has(key)) dateMap.set(key, []);
      dateMap.get(key)!.push(m.surahNumber);
    });

    const sortedMonths = Array.from(dateMap.keys()).sort();
    if (sortedMonths.length === 0) return [];

    let cumSurahs = 0;
    let cumAyahs = 0;

    return sortedMonths.map(monthKey => {
      const surahNums = dateMap.get(monthKey) || [];
      cumSurahs += surahNums.length;
      surahNums.forEach(sNum => {
        const s = QURAN_SURAHS.find(x => x.number === sNum);
        if (s) cumAyahs += s.numberOfAyahs;
      });

      const [year, month] = monthKey.split('-');
      const arMonthName = MONTH_NAMES_AR[month] || monthKey;
      const label = `${arMonthName} ${year ? year.slice(2) : ''}`;
      const cumAjzaa = parseFloat((cumAyahs / 208).toFixed(1));

      return {
        monthKey,
        label,
        surahs: cumSurahs,
        ajzaa: cumAjzaa,
        ayahs: cumAyahs,
      };
    });
  }, [memorizedSurahs]);

  // 30 Ajzaa Data for BarChart
  const ajzaaData = useMemo(() => {
    return JUZ_MAPPING.map(j => {
      const totalSurahs = j.surahs.length;
      let memorizedInJuz = 0;
      let ayahsInJuz = 0;

      j.surahs.forEach(sNum => {
        if (stats.memorizedMap.has(sNum)) {
          memorizedInJuz++;
          const s = QURAN_SURAHS.find(x => x.number === sNum);
          if (s) ayahsInJuz += s.numberOfAyahs;
        }
      });

      const completionPercent = totalSurahs > 0 ? Math.round((memorizedInJuz / totalSurahs) * 100) : 0;

      return {
        juz: j.juz,
        name: `جزء ${j.juz}`,
        fullName: j.name,
        completion: completionPercent,
        memorizedSurahs: memorizedInJuz,
        totalSurahs,
        ayahs: ayahsInJuz,
      };
    });
  }, [stats.memorizedMap]);

  // Mastery Breakdown Data for PieChart
  const masteryData = useMemo(() => {
    return [
      { name: 'متقن تماماً (100%)', value: stats.masteredCount, color: '#10b981' },
      { name: 'مراجعة دورية', value: stats.reviewingCount, color: '#06b6d4' },
      { name: 'قيد الحفظ والتثبيت', value: stats.learningCount, color: '#f59e0b' },
      { name: 'باقي السور الكريمة', value: stats.remainingCount, color: '#334155' },
    ].filter(item => item.value > 0);
  }, [stats]);

  // Memorization Actions
  const handleToggleSurah = (surahNumber: number) => {
    setMemorizedSurahs(prev => {
      const exists = prev.some(m => m.surahNumber === surahNumber);
      if (exists) {
        return prev.filter(m => m.surahNumber !== surahNumber);
      } else {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return [...prev, { surahNumber, date: currentMonth, status: 'mastered' }];
      }
    });
  };

  const handleUpdateStatus = (surahNumber: number, status: 'mastered' | 'reviewing' | 'learning') => {
    setMemorizedSurahs(prev =>
      prev.map(m => (m.surahNumber === surahNumber ? { ...m, status } : m))
    );
  };

  const handleQuickMarkJuz = (juzNumber: number) => {
    const juzInfo = JUZ_MAPPING.find(j => j.juz === juzNumber);
    if (!juzInfo) return;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    setMemorizedSurahs(prev => {
      const existingMap = new Map(prev.map(m => [m.surahNumber, m]));
      juzInfo.surahs.forEach(sNum => {
        if (!existingMap.has(sNum)) {
          existingMap.set(sNum, { surahNumber: sNum, date: currentMonth, status: 'mastered' });
        }
      });
      return Array.from(existingMap.values());
    });
  };

  const handleResetToDefault = () => {
    if (window.confirm('هل تريد استعادة البيانات النموذجية الأولية لمسار الحفظ؟')) {
      setMemorizedSurahs(DEFAULT_MEMORIZED_SURAHS);
    }
  };

  // Filtered surahs for manager modal
  const filteredManagerSurahs = useMemo(() => {
    return QURAN_SURAHS.filter(s => {
      const matchesSearch = s.name.includes(managerSearch) ||
        (s.originalName && s.originalName.includes(managerSearch)) ||
        s.number.toString().includes(managerSearch);
      const matchesJuz = managerJuzFilter === 'all' || s.juz === managerJuzFilter;
      return matchesSearch && matchesJuz;
    });
  }, [managerSearch, managerJuzFilter]);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 animate-fadeIn w-full overflow-x-hidden">
      {/* Banner */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 sm:space-y-3 z-10 text-center sm:text-right max-w-xl">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs font-semibold">
              لوحة الإنجاز والمتابعة القرآنية
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-[11px] font-bold">
              ختم {stats.progressPercent}% من القرآن الكريم
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-white font-quran">
            تابع حفظك لكتاب الله بدقة وإتقان
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            راقب تقدمك الزمني في حفظ السور والأجزاء مع المخططات البيانية التفاعلية ومؤشرات التثبيت المعتمدة.
          </p>
        </div>
        <div className="flex items-center gap-3 z-10 shrink-0">
          <button
            onClick={() => setIsManagerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-900/40 transition-all cursor-pointer min-h-[44px]"
          >
            <Edit3 className="w-4 h-4" />
            <span>تحديث السور المحفوظة</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {/* Stat 1: Surahs */}
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3 hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-slate-400 font-semibold">السور المحفوظة</span>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-xl sm:text-3xl font-bold text-white font-quran">{stats.surahsCount}</h3>
              <span className="text-xs text-slate-400">/ 114 سورة</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(stats.surahsCount / TOTAL_QURAN_SURAHS) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Stat 2: Ajzaa */}
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3 hover:border-teal-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-slate-400 font-semibold">الأجزاء المكتملة</span>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-xl sm:text-3xl font-bold text-white font-quran">{stats.ajzaaEquivalent}</h3>
              <span className="text-xs text-slate-400">/ 30 جزء</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-teal-400 mt-1">
              {stats.fullyCompletedAjzaa} أجزاء كاملة 100%
            </p>
          </div>
        </div>

        {/* Stat 3: Ayahs */}
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3 hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-slate-400 font-semibold">الآيات المحفوظة</span>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-xl sm:text-3xl font-bold text-white font-quran">{stats.totalAyahs}</h3>
              <span className="text-xs text-slate-400">/ 6,236 آية</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-amber-400 mt-1">
              {stats.progressPercent}% من كامل المصحف
            </p>
          </div>
        </div>

        {/* Stat 4: Streak */}
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3 hover:border-rose-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-slate-400 font-semibold">أيام التلاوة المتتالية</span>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-xl sm:text-3xl font-bold text-white font-quran">{streak}</h3>
              <span className="text-xs text-slate-400">أيام متواصلة</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-rose-400 mt-1">
              مواظبة ممتازة وثواب عظيم
            </p>
          </div>
        </div>
      </div>

      {/* Main Charts Section (Recharts) */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg sm:text-xl font-bold text-white font-quran">
                لوحة الرسوم البيانية ومسار الحفظ
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              تحليل بياني متكامل لإنجاز السور والأجزاء مع مرور الوقت ومستويات التثبيت.
            </p>
          </div>

          {/* Chart View Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActiveChartTab('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'timeline'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>التقدم عبر الزمن</span>
            </button>

            <button
              onClick={() => setActiveChartTab('ajzaa')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'ajzaa'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>الأجزاء الثلاثون</span>
            </button>

            <button
              onClick={() => setActiveChartTab('mastery')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'mastery'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>مستويات الإتقان</span>
            </button>
          </div>
        </div>

        {/* Chart View 1: Timeline Progress (AreaChart) */}
        {activeChartTab === 'timeline' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-300 font-medium">
                تطور حفظ السور والأجزاء المتراكمة على مدار الأشهر:
              </span>
              <div className="flex items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
                  <span className="text-slate-300">السور المحفوظة (تراكمي)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-cyan-400 inline-block"></span>
                  <span className="text-slate-300">الأجزاء المكافئة</span>
                </div>
              </div>
            </div>

            <div dir="ltr" className="w-full h-72 sm:h-84 select-none">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSurahs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorAjzaa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div dir="rtl" className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-2xl shadow-2xl text-right text-xs space-y-1.5 min-w-[150px]">
                            <p className="font-bold text-emerald-400 border-b border-slate-800 pb-1 font-quran">{label}</p>
                            <div className="flex items-center justify-between gap-3 text-emerald-300">
                              <span>السور التراكمية:</span>
                              <span className="font-bold">{payload[0]?.value} سورة</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-cyan-300">
                              <span>الأجزاء المكافئة:</span>
                              <span className="font-bold">{payload[1]?.value} جزء</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="surahs"
                    name="السور المحفوظة"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSurahs)"
                  />
                  <Area
                    type="monotone"
                    dataKey="ajzaa"
                    name="الأجزاء المكتملة"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorAjzaa)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Chart View 2: 30 Ajzaa Completion (BarChart) */}
        {activeChartTab === 'ajzaa' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-300 font-medium">
                نسبة إنجاز كل جزء من أجزاء القرآن الثلاثين (1 - 30):
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                  <span className="text-slate-300">100% مكتمل</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500"></span>
                  <span className="text-slate-300">قيد الإنجاز</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-700"></span>
                  <span className="text-slate-400">بانتظار البدء</span>
                </div>
              </div>
            </div>

            <div dir="ltr" className="w-full h-72 sm:h-84 select-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ajzaaData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="juz"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div dir="rtl" className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-2xl shadow-2xl text-right text-xs space-y-1.5 min-w-[170px]">
                            <p className="font-bold text-white border-b border-slate-800 pb-1 font-quran">{data.fullName}</p>
                            <div className="flex items-center justify-between text-emerald-300">
                              <span>نسبة الإنجاز:</span>
                              <span className="font-bold">{data.completion}%</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-300">
                              <span>السور المحفوظة:</span>
                              <span className="font-bold">{data.memorizedSurahs} / {data.totalSurahs}</span>
                            </div>
                            <div className="flex items-center justify-between text-cyan-300">
                              <span>الآيات المحفوظة:</span>
                              <span className="font-bold">{data.ayahs} آية</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="completion" radius={[4, 4, 0, 0]}>
                    {ajzaaData.map((entry, index) => {
                      let fillColor = '#334155';
                      if (entry.completion === 100) fillColor = '#10b981';
                      else if (entry.completion > 0) fillColor = '#06b6d4';
                      return <Cell key={`cell-${index}`} fill={fillColor} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Chart View 3: Mastery Distribution (PieChart) */}
        {activeChartTab === 'mastery' && (
          <div className="flex flex-col md:flex-row items-center justify-around gap-6">
            <div dir="ltr" className="w-full md:w-1/2 h-64 sm:h-72 relative select-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={masteryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {masteryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        return (
                          <div dir="rtl" className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-2.5 rounded-xl shadow-xl text-right text-xs">
                            <span className="font-bold text-white">{data.name}: </span>
                            <span className="text-emerald-400 font-bold">{data.value} سورة</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-2xl sm:text-3xl font-bold text-white font-quran">{stats.progressPercent}%</span>
                <span className="text-[11px] text-slate-400">إتمام المصحف</span>
              </div>
            </div>

            <div className="w-full md:w-1/2 space-y-3">
              <h4 className="text-sm font-bold text-slate-300 font-quran">تفصيل حالات الحفظ والتثبيت</h4>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-200">متقن تماماً (100% عرض وتسميع)</span>
                  </div>
                  <span className="font-bold text-emerald-400">{stats.masteredCount} سورة</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
                    <span className="text-slate-200">مراجعة دورية (تثبيت مستمر)</span>
                  </div>
                  <span className="font-bold text-cyan-400">{stats.reviewingCount} سورة</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="text-slate-200">قيد الحفظ والتثبيت</span>
                  </div>
                  <span className="font-bold text-amber-400">{stats.learningCount} سورة</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-600"></span>
                    <span className="text-slate-400">باقي سور المصحف الكريم</span>
                  </div>
                  <span className="font-bold text-slate-400">{stats.remainingCount} سورة</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bookmarks Section */}
      <div className="p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg sm:text-xl font-bold text-white font-quran flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-400" />
            <span>الآيات المحفوظة والمفضلة للمراجعة</span>
          </h3>
          <span className="text-xs text-slate-400">{bookmarks.length} آية</span>
        </div>

        {bookmarks.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            لا توجد آيات محفوظة في المفضلة حالياً. اضغط على أيقونة الإشارة المرجعية بجانب أي آية في المصحف لإضافتها هنا.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bookmarks.map((bKey, idx) => {
              const [surahNum, ayahNum] = bKey.split(':');
              const surah = QURAN_SURAHS.find(s => s.number === Number(surahNum));
              const ayah = surah?.ayahs.find(a => a.number === Number(ayahNum));

              return (
                <div
                  key={idx}
                  onClick={() => surah && onSelectBookmark(surah.name, bKey)}
                  className="p-5 rounded-2xl bg-slate-850 border border-slate-800 space-y-3 flex flex-col justify-between hover:border-emerald-500/40 cursor-pointer transition-all hover:scale-[1.01]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">سورة {surah?.name} - آية {ayahNum}</span>
                    <Bookmark className="w-4 h-4 text-amber-400 fill-current" />
                  </div>
                  <p className="font-quran text-lg text-slate-200 line-clamp-2 leading-relaxed">{ayah?.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Favorite & Default Reciters Settings Panel */}
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-emerald-500/25 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3 text-right">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Star className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-bold text-white font-quran flex items-center gap-2">
                <span>إعدادات القراء المفضلين والافتراضيين</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ميّز قراءك المفضلين بالنجمة واختر القارئ الافتراضي لكل قسم ليبدأ التشغيل به تلقائياً.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
              المفضلون: {reciterPrefs.favoriteReciterIds.length} / {RECITERS.length}
            </span>
          </div>
        </div>

        {prefsNotice && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            {prefsNotice}
          </div>
        )}

        {/* Per-Section Default Reciter Pickers */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <Sliders className="w-4 h-4" />
            <span>تخصيص القارئ الافتراضي حسب القسم:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(
              [
                { key: 'surah' as ReciterSectionKey, label: 'تلاوة السور والمصحف والمعلم', value: reciterPrefs.defaultSurahReciterId },
                { key: 'adhkar' as ReciterSectionKey, label: 'أذكار الصباح والمساء', value: reciterPrefs.defaultAdhkarSheikhId },
                { key: 'hisn' as ReciterSectionKey, label: 'حصن المسلم', value: reciterPrefs.defaultHisnSheikhId },
                { key: 'shatibiyyah' as ReciterSectionKey, label: 'متن الشاطبية', value: reciterPrefs.defaultShatibiyyahSheikhId },
                { key: 'jazariyyah' as ReciterSectionKey, label: 'متن الجزرية', value: reciterPrefs.defaultJazariyyahSheikhId },
              ]
            ).map((sec) => {
              const sortedReciters = sortWithFavoritesFirst(RECITERS, reciterPrefs.favoriteReciterIds);
              return (
                <div
                  key={sec.key}
                  className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 min-w-0 overflow-hidden"
                >
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{sec.label}</span>
                  </label>
                  <select
                    value={sec.value}
                    onChange={(e) => {
                      const updated = setSectionDefaultReciter(sec.key, e.target.value);
                      setReciterPrefs(updated);
                      const rName = RECITERS.find((r) => r.id === e.target.value)?.name || '';
                      showPrefsNotice(`تم اعتماد ${rName} افتراضياً لقسم ${sec.label}`);
                    }}
                    className="w-full min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px] cursor-pointer truncate"
                  >
                    {sortedReciters.map((r) => {
                      const isFav = reciterPrefs.favoriteReciterIds.includes(r.id);
                      return (
                        <option key={r.id} value={r.id}>
                          {formatSheikhOptionLabel(r.name, r.style, isFav)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive 14 Sheikhs Star & Unified Default Grid */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <p className="text-xs font-bold text-slate-300">
            قائمة الشيوخ (اضغط على النجمة للتفضيل أو «اعتماد للكل» لتثبيته في جميع الأقسام):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {sortWithFavoritesFirst(RECITERS, reciterPrefs.favoriteReciterIds).map((reciter) => {
              const isFav = reciterPrefs.favoriteReciterIds.includes(reciter.id);
              const isAllDefault =
                reciterPrefs.defaultSurahReciterId === reciter.id &&
                reciterPrefs.defaultAdhkarSheikhId === reciter.id &&
                reciterPrefs.defaultHisnSheikhId === reciter.id &&
                reciterPrefs.defaultShatibiyyahSheikhId === reciter.id &&
                reciterPrefs.defaultJazariyyahSheikhId === reciter.id;

              return (
                <div
                  key={reciter.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all ${
                    isAllDefault
                      ? 'bg-emerald-950/35 border-emerald-500/50'
                      : isFav
                      ? 'bg-amber-950/15 border-amber-500/30'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => {
                        const updated = toggleFavoriteReciter(reciter.id);
                        setReciterPrefs(updated);
                      }}
                      className={`p-2 rounded-xl border shrink-0 cursor-pointer transition-colors ${
                        isFav
                          ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                          : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-amber-300'
                      }`}
                      title={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{reciter.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{reciter.style}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const updated = setAllDefaultsToReciter(reciter.id);
                      setReciterPrefs(updated);
                      showPrefsNotice(`تم تعيين ${reciter.name} كقارئ افتراضي لجميع الأقسام`);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer border transition-colors ${
                      isAllDefault
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300'
                    }`}
                  >
                    {isAllDefault ? 'افتراضي للكل' : 'اعتماد للكل'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Offline Backup Shortcut Card */}
      {onOpenBackup && (
        <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-l from-emerald-950/70 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-right">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <HardDriveDownload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white font-quran">
                النسخة الاحتياطية والعمل بدون إنترنت
              </h3>
              <p className="text-xs text-slate-300">
                بيانات حفظك ومخططاتك مخزنة محلياً بالكامل. يمكنك تنزيل ملف نسخة احتياطية أو استعادتها بدون اتصال بالإنترنت.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenBackup}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold cursor-pointer shrink-0 min-h-[42px]"
          >
            <span>إدارة النسخة الاحتياطية</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Interactive Modal: Manage Memorized Surahs */}
      {isManagerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-bold text-white font-quran flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-emerald-400" />
                  <span>إدارة السور وتحديث حالة الحفظ</span>
                </h3>
                <p className="text-xs text-slate-400">
                  حدد السور التي حفظتها ومستوى إتقانها ليتم تحديث الرسوم البيانية فوراً.
                </p>
              </div>
              <button
                onClick={() => setIsManagerOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions & Search */}
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-300">إجراءات سريعة:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleQuickMarkJuz(30)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-bold cursor-pointer transition-colors"
                  >
                    + تحديد جزء عمّ كاملاً (37 سورة)
                  </button>
                  <button
                    onClick={() => handleQuickMarkJuz(29)}
                    className="px-3 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 text-xs font-bold cursor-pointer transition-colors"
                  >
                    + تحديد جزء تبارك (11 سورة)
                  </button>
                  <button
                    onClick={handleResetToDefault}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer flex items-center gap-1"
                    title="استعادة الوضع الافتراضي"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة ضبط</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={managerSearch}
                    onChange={e => setManagerSearch(e.target.value)}
                    placeholder="ابحث باسم السورة أو رقمها..."
                    className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <select
                  value={managerJuzFilter}
                  onChange={e => setManagerJuzFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">كافة الأجزاء</option>
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                    <option key={j} value={j}>جزء {j}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Surahs List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredManagerSurahs.map(surah => {
                const record = stats.memorizedMap.get(surah.number);
                const isMemorized = !!record;

                return (
                  <div
                    key={surah.number}
                    className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isMemorized
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleSurah(surah.number)}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          isMemorized
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-800 border border-slate-700 text-transparent hover:text-slate-500'
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">#{surah.number}</span>
                          <h4 className="text-sm font-bold text-white font-quran">سورة {surah.name}</h4>
                          <span className="text-[11px] text-slate-400">({surah.numberOfAyahs} آية)</span>
                        </div>
                        <span className="text-[10px] text-slate-500">الجزء {surah.juz} • {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</span>
                      </div>
                    </div>

                    {/* Status & Options if Memorized */}
                    {isMemorized && (
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          onClick={() => handleUpdateStatus(surah.number, 'mastered')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            record.status === 'mastered'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          متقن 100%
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(surah.number, 'reviewing')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            record.status === 'reviewing'
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          مراجعة
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(surah.number, 'learning')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            record.status === 'learning'
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          قيد الحفظ
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                تم حفظ <strong className="text-emerald-400">{stats.surahsCount}</strong> سورة ({stats.progressPercent}% من المصحف)
              </span>
              <button
                onClick={() => setIsManagerOpen(false)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                إغلاق وتحديث المخططات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
