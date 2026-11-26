import React, { useState, useEffect, useRef } from 'react';
import {
  HardDriveDownload,
  Upload,
  Download,
  CheckCircle2,
  Wifi,
  WifiOff,
  Trash2,
  RotateCcw,
  Save,
  Volume2,
  Database,
  ShieldCheck,
  AlertCircle,
  Loader2,
  X,
  BookOpen,
  Sun,
  Smartphone,
  Package,
  RefreshCw,
  Copy,
  Check,
  Layers,
  FileCheck,
  UserCheck,
  Pause,
  Play,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { QURAN_SURAHS, RECITERS } from '../data/quranData';
import { ADHKAR_SHEIKHS } from '../data/adhkarData';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PWAInstallButton } from './PWAInstallButton';
import {
  APP_VERSION,
  BackupPayload,
  LocalSnapshot,
  OfflineAudioPack,
  ReciterOfflineCoverage,
  TOTAL_QURAN_AYAHS,
  createBackupPayload,
  deleteLocalSnapshot,
  downloadAudioPackOffline,
  downloadBackupJsonFile,
  getAdhkarSheikhAudioUrls,
  getAllSheikhsAdhkarUrls,
  getBatchSurahsAudioUrls,
  getFullMushafAudioUrls,
  getJuzAudioUrls,
  getPopularOfflineSurahs,
  getRecitersOfflineCoverage,
  getStorageSummary,
  getSurahAyahAudioUrls,
  listLocalSnapshots,
  listOfflineAudioPacks,
  parseAndValidateBackup,
  removeOfflineAudioPack,
  removeReciterOfflineAudio,
  restoreBackupPayload,
  saveLocalSnapshot,
} from '../utils/offlineStorage';

export const OfflineBackupView: React.FC = () => {
  const isOnline = useOnlineStatus();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);

  const [currentBackupInfo, setCurrentBackupInfo] = useState<BackupPayload>(() =>
    createBackupPayload()
  );
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([]);
  const [audioPacks, setAudioPacks] = useState<OfflineAudioPack[]>([]);
  const [reciterCoverages, setReciterCoverages] = useState<ReciterOfflineCoverage[]>([]);
  const [storageSummary, setStorageSummary] = useState({
    usedMB: 0,
    quotaMB: 0,
    cachedAudioFiles: 0,
    swReady: false,
    persisted: false,
  });

  const [selectedSurahNum, setSelectedSurahNum] = useState<number>(18); // Default Al-Kahf
  const [selectedJuzNum, setSelectedJuzNum] = useState<number>(30);
  const [selectedReciterId, setSelectedReciterId] = useState<string>(RECITERS[0].identifier);
  const [selectedAdhkarSheikhId, setSelectedAdhkarSheikhId] = useState<string>(ADHKAR_SHEIKHS[0].id);
  const [selectedMultiReciters, setSelectedMultiReciters] = useState<string[]>([
    RECITERS[0].identifier,
    RECITERS[3].identifier, // المنشاوي
    RECITERS[4].identifier, // الحصري
  ]);

  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [downloadingTitle, setDownloadingTitle] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 0,
  });
  const [multiQueueStatus, setMultiQueueStatus] = useState<{
    currentIdx: number;
    totalReciters: number;
    currentReciterName: string;
  } | null>(null);

  const refreshAllState = async () => {
    setCurrentBackupInfo(createBackupPayload());
    const [snaps, packs, summary, coverages] = await Promise.all([
      listLocalSnapshots(),
      listOfflineAudioPacks(),
      getStorageSummary(),
      getRecitersOfflineCoverage(),
    ]);
    setSnapshots(snaps);
    setAudioPacks(packs);
    setStorageSummary(summary);
    setReciterCoverages(coverages);
  };

  useEffect(() => {
    refreshAllState();
    const handleRestored = () => {
      refreshAllState();
    };
    window.addEventListener('murtal-backup-restored', handleRestored);
    return () => {
      window.removeEventListener('murtal-backup-restored', handleRestored);
      if (downloadAbortRef.current) {
        downloadAbortRef.current.abort();
      }
    };
  }, []);

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  const handleExportJson = () => {
    try {
      const payload = createBackupPayload('نسخة احتياطية يدوية');
      const filename = downloadBackupJsonFile(payload);
      showStatus('success', `تم تصدير النسخة الاحتياطية (${filename}) بنجاح وتعمل الاستعادة بدون إنترنت.`);
    } catch {
      showStatus('error', 'تعذر تصدير ملف النسخة الاحتياطية.');
    }
  };

  const handleSaveLocalSnapshot = async () => {
    try {
      await saveLocalSnapshot(`نسخة محلية (${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })})`);
      await refreshAllState();
      showStatus('success', 'تم حفظ نسخة احتياطية محلية فورية داخل ذاكرة الجهاز (IndexedDB).');
    } catch {
      showStatus('error', 'تعذر حفظ النسخة المحلية في المتصفح.');
    }
  };

  const handleRestoreSnapshot = async (snapshot: LocalSnapshot) => {
    restoreBackupPayload(snapshot);
    await refreshAllState();
    showStatus('success', 'تمت استعادة البيانات من النسخة المحلية بنجاح.');
  };

  const handleDeleteSnapshot = async (id: string) => {
    await deleteLocalSnapshot(id);
    await refreshAllState();
    showStatus('info', 'تم حذف النسخة المحلية.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseAndValidateBackup(String(reader.result || ''));
        setPendingImport(parsed);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'ملف غير صالح';
        showStatus('error', msg);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmRestoreImport = async () => {
    if (!pendingImport) return;
    restoreBackupPayload(pendingImport);
    setPendingImport(null);
    await refreshAllState();
    showStatus('success', 'تمت استعادة جميع البيانات والإعدادات من الملف بنجاح بدون إنترنت.');
  };

  const startAudioPackDownload = async (
    id: string,
    type: 'surah' | 'adhkar' | 'mushaf' | 'juz',
    title: string,
    subtitle: string,
    reciterName: string,
    urls: string[]
  ) => {
    if (!isOnline) {
      showStatus('error', 'يلزم الاتصال بالإنترنت لتنزيل ملفات الصوت لأول مرة ثم تصبح متاحة بدون إنترنت.');
      return;
    }
    if (downloadingTitle) return;

    const controller = new AbortController();
    downloadAbortRef.current = controller;
    setDownloadingTitle(title);
    setDownloadProgress({ completed: 0, total: urls.length });

    try {
      await downloadAudioPackOffline(
        {
          id,
          type,
          title,
          subtitle,
          reciterName,
          urls,
          ayahCount: urls.length,
        },
        (completed, total) => {
          setDownloadProgress({ completed, total });
        },
        controller.signal
      );
      await refreshAllState();
      showStatus('success', `تم حفظ "${title}" للاستماع بدون إنترنت (${urls.length} مقطع صوتي).`);
    } catch (err: unknown) {
      await refreshAllState();
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء التنزيل';
      showStatus(msg.includes('مؤقتاً') ? 'info' : 'error', msg);
    } finally {
      setDownloadingTitle(null);
      setMultiQueueStatus(null);
      downloadAbortRef.current = null;
    }
  };

  const handleDownloadSelectedSurah = () => {
    const surah = QURAN_SURAHS.find((s) => s.number === selectedSurahNum);
    const reciter = RECITERS.find((r) => r.identifier === selectedReciterId) || RECITERS[0];
    if (!surah) return;
    const urls = getSurahAyahAudioUrls(surah, reciter.identifier);
    startAudioPackDownload(
      `surah_${surah.number}_${reciter.id}`,
      'surah',
      `سورة ${surah.name}`,
      `${surah.numberOfAyahs} آية • ${surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}`,
      reciter.name,
      urls
    );
  };

  const handleDownloadQuickSurah = (surahNumber: number) => {
    const surah = QURAN_SURAHS.find((s) => s.number === surahNumber);
    const reciter = RECITERS.find((r) => r.identifier === selectedReciterId) || RECITERS[0];
    if (!surah) return;
    const urls = getSurahAyahAudioUrls(surah, reciter.identifier);
    startAudioPackDownload(
      `surah_${surah.number}_${reciter.id}`,
      'surah',
      `سورة ${surah.name}`,
      `${surah.numberOfAyahs} آية`,
      reciter.name,
      urls
    );
  };

  const handleDownloadAdhkarPack = () => {
    const sheikh = ADHKAR_SHEIKHS.find((s) => s.id === selectedAdhkarSheikhId) || ADHKAR_SHEIKHS[0];
    const urls = getAdhkarSheikhAudioUrls(sheikh);
    startAudioPackDownload(
      `adhkar_${sheikh.id}`,
      'adhkar',
      `أذكار الصباح والمساء`,
      `${urls.length} مقطع قرآني مسجل`,
      sheikh.name,
      urls
    );
  };

  const handleDownloadAllSheikhsAdhkar = () => {
    const urls = getAllSheikhsAdhkarUrls();
    startAudioPackDownload(
      'adhkar_all_14_sheikhs',
      'adhkar',
      `أذكار كافة الشيوخ (${ADHKAR_SHEIKHS.length} شيخاً)`,
      `تشمل كافة أصوات المشايخ الـ ${ADHKAR_SHEIKHS.length} بدون إنترنت`,
      'جميع الشيوخ الـ 14',
      urls
    );
  };

  const handleDownloadShortSurahsPack = () => {
    const reciter = RECITERS.find((r) => r.identifier === selectedReciterId) || RECITERS[0];
    const surahNums = [1, 103, 108, 109, 110, 111, 112, 113, 114];
    const urls = getBatchSurahsAudioUrls(surahNums, reciter.identifier);
    startAudioPackDownload(
      `bundle_short_${reciter.id}`,
      'surah',
      'حزمة الفاتحة وقصار السور والمعوذات',
      `${surahNums.length} سور كاملة (${urls.length} آية)`,
      reciter.name,
      urls
    );
  };

  const handleDownloadJuzAmmaPack = () => {
    const reciter = RECITERS.find((r) => r.identifier === selectedReciterId) || RECITERS[0];
    const juzAmmaNums = Array.from({ length: 37 }, (_, i) => 78 + i); // 78..114
    const urls = getBatchSurahsAudioUrls(juzAmmaNums, reciter.identifier);
    startAudioPackDownload(
      `bundle_juz30_${reciter.id}`,
      'surah',
      'جزء عمّ كاملاً (من النبأ إلى الناس)',
      `37 سورة كاملة (${urls.length} آية)`,
      reciter.name,
      urls
    );
  };

  const handleRemovePack = async (pack: OfflineAudioPack) => {
    await removeOfflineAudioPack(pack);
    await refreshAllState();
    showStatus('info', `تم حذف "${pack.title}" من الذاكرة المحلية.`);
  };

  const handleDownloadFullMushafForReciter = (reciterIdentifier: string) => {
    const reciter = RECITERS.find((r) => r.identifier === reciterIdentifier) || RECITERS[0];
    const urls = getFullMushafAudioUrls(reciter.identifier);
    startAudioPackDownload(
      `full_mushaf_${reciter.id}`,
      'mushaf',
      `المصحف الشريف كاملاً — ${reciter.name}`,
      `114 سورة • ${TOTAL_QURAN_AYAHS} آية كاملة بدون إنترنت`,
      reciter.name,
      urls
    );
  };

  const handleDownloadSelectedJuz = () => {
    const reciter = RECITERS.find((r) => r.identifier === selectedReciterId) || RECITERS[0];
    const urls = getJuzAudioUrls(selectedJuzNum, reciter.identifier);
    startAudioPackDownload(
      `juz_${selectedJuzNum}_${reciter.id}`,
      'juz',
      `الجزء ${selectedJuzNum} كاملاً`,
      `تلاوة متصلة بدون إنترنت (${urls.length} مقطع)`,
      reciter.name,
      urls
    );
  };

  const handleDownloadMultiRecitersMushaf = async (reciterIdentifiers: string[]) => {
    if (!isOnline) {
      showStatus('error', 'يلزم الاتصال بالإنترنت لتنزيل ملفات الصوت لأول مرة ثم تصبح متاحة بدون إنترنت.');
      return;
    }
    if (downloadingTitle || reciterIdentifiers.length === 0) return;

    const controller = new AbortController();
    downloadAbortRef.current = controller;

    try {
      for (let i = 0; i < reciterIdentifiers.length; i++) {
        if (controller.signal.aborted) break;
        const reciter = RECITERS.find((r) => r.identifier === reciterIdentifiers[i]);
        if (!reciter) continue;

        const urls = getFullMushafAudioUrls(reciter.identifier);
        const title = `المصحف كاملاً (${i + 1}/${reciterIdentifiers.length}) — ${reciter.name}`;
        setMultiQueueStatus({
          currentIdx: i + 1,
          totalReciters: reciterIdentifiers.length,
          currentReciterName: reciter.name,
        });
        setDownloadingTitle(title);
        setDownloadProgress({ completed: 0, total: urls.length });

        await downloadAudioPackOffline(
          {
            id: `full_mushaf_${reciter.id}`,
            type: 'mushaf',
            title: `المصحف الشريف كاملاً — ${reciter.name}`,
            subtitle: `114 سورة • ${TOTAL_QURAN_AYAHS} آية كاملة بدون إنترنت`,
            reciterName: reciter.name,
            urls,
            ayahCount: urls.length,
          },
          (completed, total) => {
            setDownloadProgress({ completed, total });
          },
          controller.signal
        );
        await refreshAllState();
      }
      showStatus(
        'success',
        `تم حفظ النسخة الكاملة للمصحف الشريف لـ ${reciterIdentifiers.length} من الشيوخ للعمل بدون إنترنت.`
      );
    } catch (err: unknown) {
      await refreshAllState();
      const msg = err instanceof Error ? err.message : 'تم إيقاف التنزيل مؤقتاً';
      showStatus(msg.includes('مؤقتاً') ? 'info' : 'error', msg);
    } finally {
      setDownloadingTitle(null);
      setMultiQueueStatus(null);
      downloadAbortRef.current = null;
    }
  };

  const handleDeleteReciterAudio = async (reciterIdentifier: string, reciterName: string) => {
    await removeReciterOfflineAudio(reciterIdentifier);
    await refreshAllState();
    showStatus('info', `تم مسح تلاوات ${reciterName} من الذاكرة المحلية.`);
  };

  const toggleMultiReciter = (identifier: string) => {
    setSelectedMultiReciters((prev) =>
      prev.includes(identifier) ? prev.filter((id) => id !== identifier) : [...prev, identifier]
    );
  };

  const popularSurahs = getPopularOfflineSurahs();
  const completedRecitersCount = reciterCoverages.filter((r) => r.isComplete).length;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-7 animate-fadeIn w-full max-w-full overflow-x-hidden">
      {/* Header Banner */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2 text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <HardDriveDownload className="w-3.5 h-3.5" />
              <span>مركز النسخة الاحتياطية والعمل بدون إنترنت</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-quran">
              نسختك القرآنية وبيانات الحفظ محمية بالكامل
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              تصفح المصحف الشريف كاملاً (114 سورة) والأذكار وراجع حفظك في أي وقت بدون إنترنت، مع إمكانية تنزيل التلاوات وتصدير واستعادة نسخة احتياطية كاملة لبياناتك.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900/90 border border-emerald-500/30 text-emerald-300">
              <span>الإصدار {APP_VERSION}</span>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border ${
                isOnline
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              }`}
            >
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 animate-pulse" />}
              <span>{isOnline ? 'متصل بالإنترنت' : 'الوضع بدون إنترنت مفعّل'}</span>
            </div>
            <PWAInstallButton />
          </div>
        </div>
      </div>

      {/* Status Toast / Alert */}
      {statusMessage && (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-bold ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
              : 'bg-slate-900 border-slate-700 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Offline Readiness Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-semibold">نص المصحف والأذكار</p>
            <p className="text-sm sm:text-base font-bold text-white truncate">محفوظ 100% بدون إنترنت</p>
            <p className="text-[11px] text-emerald-400">
              {storageSummary.swReady ? 'محرك العمل دون اتصال نشط' : 'جاهز للتخزين المحلي'}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Volume2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-semibold">المقاطع الصوتية المحفوظة</p>
            <p className="text-sm sm:text-base font-bold text-white">
              {storageSummary.cachedAudioFiles} مقطع صوتي
            </p>
            <p className="text-[11px] text-slate-400">{audioPacks.length} حزم مكتملة</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-semibold">سعة التخزين المحلية</p>
            <p className="text-sm sm:text-base font-bold text-white">
              {storageSummary.usedMB} م.ب مستخدمة
            </p>
            <p className="text-[11px] text-slate-400">
              {storageSummary.quotaMB > 0 ? `المتاح: ${storageSummary.quotaMB} م.ب` : 'ذاكرة الجهاز المحلية'}
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Data Backup & Restore (Works 100% Offline) */}
      <div className="p-4 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white font-quran flex items-center gap-2">
              <Save className="w-5 h-5 text-emerald-400" />
              <span>النسخة الاحتياطية لبيانات الحفظ والمفضلة (بدون إنترنت)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              احفظ نسخة من آياتك المفضلة وبطاقات التكرار المتباعد وتقدم الأذكار وإعدادات القارئ كملف على جهازك أو داخل المتصفح.
            </p>
          </div>
        </div>

        {/* Data Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
            <span className="text-lg sm:text-xl font-bold text-emerald-400 block">
              {currentBackupInfo.stats.bookmarksCount}
            </span>
            <span className="text-[11px] text-slate-400">آية في المفضلة</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
            <span className="text-lg sm:text-xl font-bold text-amber-400 block">
              {currentBackupInfo.stats.spacedCardsCount}
            </span>
            <span className="text-[11px] text-slate-400">بطاقة تكرار متباعد</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
            <span className="text-lg sm:text-xl font-bold text-teal-400 block">
              {currentBackupInfo.stats.adhkarCountersCount}
            </span>
            <span className="text-[11px] text-slate-400">ذكر مسجل اليوم</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
            <span className="text-lg sm:text-xl font-bold text-sky-400 block">
              {currentBackupInfo.stats.settingsCount}
            </span>
            <span className="text-[11px] text-slate-400">تفضيلات القراءة</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleExportJson}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-95 min-h-[46px]"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>تصدير نسخة احتياطية (ملف JSON)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 min-h-[46px]"
          >
            <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>استعادة من ملف نسخة احتياطية</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            onClick={handleSaveLocalSnapshot}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/40 text-teal-300 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 min-h-[46px]"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>حفظ لقطة فورية داخل الجهاز</span>
          </button>
        </div>

        {/* Pending File Restore Preview */}
        {pendingImport && (
          <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-emerald-300">
                تأكيد استعادة النسخة الاحتياطية
              </p>
              <span className="text-[11px] text-slate-400">
                تاريخ النسخة: {new Date(pendingImport.createdAt).toLocaleString('ar-SA')}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              تحتوي على {pendingImport.stats.bookmarksCount} آية مفضلة،{' '}
              {pendingImport.stats.spacedCardsCount} بطاقة حفظ،{' '}
              {pendingImport.stats.memorizedSurahsCount ? `${pendingImport.stats.memorizedSurahsCount} سورة محفوظة، ` : ''}
              {pendingImport.stats.coachSavedAyahsCount ? `${pendingImport.stats.coachSavedAyahsCount} آية تجويد محفوظة، ` : ''}و{' '}
              {pendingImport.stats.adhkarCountersCount} عداد أذكار.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={confirmRestoreImport}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                نعم، استعادة البيانات الآن
              </button>
              <button
                onClick={() => setPendingImport(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Saved Local Snapshots */}
        {snapshots.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <h4 className="text-xs font-bold text-slate-400">
              النسخ الاحتياطية المحفوظة داخل ذاكرة الجهاز ({snapshots.length})
            </h4>
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs sm:text-sm font-bold text-white">
                      {snap.label || 'نسخة محلية'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(snap.createdAt).toLocaleString('ar-SA')} • {snap.stats.bookmarksCount} مفضلة • {snap.stats.spacedCardsCount} بطاقة حفظ
                      {snap.stats.memorizedSurahsCount ? ` • ${snap.stats.memorizedSurahsCount} سورة` : ''}
                      {snap.stats.coachSavedAyahsCount ? ` • ${snap.stats.coachSavedAyahsCount} آية تجويد` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRestoreSnapshot(snap)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer min-h-[36px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>استعادة</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSnapshot(snap.id)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="حذف النسخة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Complete Offline Mushaf & All 14 Sheikhs Audio Library */}
      <div className="p-4 sm:p-7 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-500/30 space-y-5 shadow-2xl">
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold mb-2">
              <Sparkles className="w-3 h-3" />
              <span>النسخة الكاملة للمصحف الشريف بصوت الشيوخ (114 سورة • {TOTAL_QURAN_AYAHS} آية)</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white font-quran flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-amber-400 shrink-0" />
              <span>مكتبة المصحف الكامل للعمل بدون إنترنت</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              نص المصحف الكامل (114 سورة) محفوظ لديك أوفلاين دائماً، ويمكنك هنا تنزيل المصحف الكامل بصوت شيخ واحد أو عدة شيوخ أو جميع الشيوخ الـ {RECITERS.length} مع حفظ التقدم واستكمال التنزيل في أي وقت.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1 shrink-0 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-bold">
              مكتملون: {completedRecitersCount} / {RECITERS.length} شيوخ
            </span>
            {storageSummary.persisted && (
              <span className="text-[11px] text-teal-400 font-semibold">
                الذاكرة الدائمة مفعّلة لحماية الصوتيات
              </span>
            )}
          </div>
        </div>

        {/* Active Download Progress Bar */}
        {downloadingTitle && (
          <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-300">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>جاري تنزيل: {downloadingTitle}</span>
              </div>
              <button
                onClick={() => downloadAbortRef.current?.abort()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>إيقاف مؤقت وحفظ التقدم</span>
              </button>
            </div>
            {multiQueueStatus && (
              <p className="text-[11px] text-teal-300 font-semibold">
                الطابور المتعدد: الشيخ {multiQueueStatus.currentIdx} من {multiQueueStatus.totalReciters} ({multiQueueStatus.currentReciterName})
              </p>
            )}
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-emerald-400 to-teal-500 transition-all duration-200"
                style={{
                  width: `${
                    downloadProgress.total > 0
                      ? Math.round((downloadProgress.completed / downloadProgress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>
                تم حفظ {downloadProgress.completed} من {downloadProgress.total} مقطع صوتي
              </span>
              <span className="font-bold text-emerald-300">
                {downloadProgress.total > 0
                  ? Math.round((downloadProgress.completed / downloadProgress.total) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        )}

        {/* Full Mushaf One-Click & Multi-Sheikh Batch Downloader */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/25 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-300">
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>تنزيل المصحف الكامل (114 سورة) بصوت الشيخ المختار أو مجموعة الشيوخ</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedMultiReciters(RECITERS.map((r) => r.identifier))}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
              >
                تحديد الكل ({RECITERS.length})
              </button>
              <button
                onClick={() => setSelectedMultiReciters([])}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-bold cursor-pointer"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>

          {/* Grid of all 14 Sheikhs with per-Sheikh progress & Full Mushaf button */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RECITERS.map((r) => {
              const cov = reciterCoverages.find((c) => c.identifier === r.identifier);
              const cached = cov?.cachedAyahs || 0;
              const pct = cov?.percentage || 0;
              const isDone = Boolean(cov?.isComplete);
              const isChecked = selectedMultiReciters.includes(r.identifier);

              return (
                <div
                  key={r.id}
                  className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                    isDone
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : isChecked
                      ? 'bg-slate-900/90 border-teal-500/40'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleMultiReciter(r.identifier)}
                      className="flex items-start gap-2.5 text-right cursor-pointer min-w-0 flex-1"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-white truncate">{r.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {r.style} • ~{cov?.estimatedTotalMB || 420} م.ب للمصحف كاملاً
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleDownloadFullMushafForReciter(r.identifier)}
                        disabled={Boolean(downloadingTitle) || isDone}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer min-h-[34px] ${
                          isDone
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white'
                        }`}
                      >
                        {isDone ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مكتمل</span>
                          </>
                        ) : cached > 0 ? (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>استكمال</span>
                          </>
                        ) : (
                          <>
                            <HardDriveDownload className="w-3.5 h-3.5" />
                            <span>تنزيل المصحف</span>
                          </>
                        )}
                      </button>

                      {cached > 0 && (
                        <button
                          onClick={() => handleDeleteReciterAudio(r.identifier, r.name)}
                          disabled={Boolean(downloadingTitle)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 text-slate-400 hover:text-rose-300 disabled:opacity-50 cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                          title={`حذف تلاوات ${r.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Per-Reciter Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isDone ? 'bg-emerald-400' : 'bg-teal-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{cached.toLocaleString('en-US')} / {TOTAL_QURAN_AYAHS.toLocaleString('en-US')} آية محفوظة</span>
                      <span className={isDone ? 'text-emerald-400 font-bold' : ''}>{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={() => handleDownloadMultiRecitersMushaf(selectedMultiReciters)}
              disabled={Boolean(downloadingTitle) || selectedMultiReciters.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/40 cursor-pointer min-h-[46px]"
            >
              <HardDriveDownload className="w-4 h-4 shrink-0" />
              <span>
                تنزيل المصحف الكامل للشيوخ المحددين ({selectedMultiReciters.length} من {RECITERS.length})
              </span>
            </button>

            <button
              onClick={() => handleDownloadMultiRecitersMushaf(RECITERS.map((r) => r.identifier))}
              disabled={Boolean(downloadingTitle)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 disabled:opacity-50 text-amber-300 text-xs sm:text-sm font-bold cursor-pointer min-h-[46px]"
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>تنزيل جميع الشيوخ ({RECITERS.length} مصحفاً كاملاً)</span>
            </button>
          </div>
        </div>

        {/* Juz 1..30 Downloader */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-teal-400">
            <Layers className="w-4 h-4" />
            <span>تنزيل أي جزء من الأجزاء الثلاثين (الجزء 1 إلى الجزء 30)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={selectedJuzNum}
              onChange={(e) => setSelectedJuzNum(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold min-h-[44px]"
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                <option key={j} value={j}>
                  الجزء {j}
                </option>
              ))}
            </select>

            <select
              value={selectedReciterId}
              onChange={(e) => setSelectedReciterId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold min-h-[44px]"
            >
              {RECITERS.map((r) => (
                <option key={r.identifier} value={r.identifier}>
                  {r.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleDownloadSelectedJuz}
              disabled={Boolean(downloadingTitle)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold cursor-pointer min-h-[44px] active:scale-95"
            >
              <HardDriveDownload className="w-4 h-4 shrink-0" />
              <span>تنزيل الجزء {selectedJuzNum} أوفلاين</span>
            </button>
          </div>
        </div>

        {/* Custom Surah + Reciter Downloader */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <BookOpen className="w-4 h-4" />
            <span>تنزيل أي سورة من المصحف الشريف</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={selectedSurahNum}
              onChange={(e) => setSelectedSurahNum(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold min-h-[44px]"
            >
              {QURAN_SURAHS.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.number}. سورة {s.name} ({s.numberOfAyahs} آية)
                </option>
              ))}
            </select>

            <select
              value={selectedReciterId}
              onChange={(e) => setSelectedReciterId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold min-h-[44px]"
            >
              {RECITERS.map((r) => (
                <option key={r.identifier} value={r.identifier}>
                  {r.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleDownloadSelectedSurah}
              disabled={Boolean(downloadingTitle)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold cursor-pointer min-h-[44px] active:scale-95"
            >
              <HardDriveDownload className="w-4 h-4 shrink-0" />
              <span>تنزيل السورة للاستماع أوفلاين</span>
            </button>
          </div>

          {/* Quick Popular Surahs & Full Offline Bundles */}
          <div className="pt-2 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400 font-semibold">تنزيل سريع للشيخ المختار:</span>
              {popularSurahs.map((s) => (
                <button
                  key={s.number}
                  onClick={() => handleDownloadQuickSurah(s.number)}
                  disabled={Boolean(downloadingTitle)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-600/20 border border-slate-700 hover:border-emerald-500/40 text-slate-200 text-xs font-semibold cursor-pointer disabled:opacity-50 min-h-[34px]"
                >
                  + {s.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={handleDownloadShortSurahsPack}
                disabled={Boolean(downloadingTitle)}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer disabled:opacity-50 min-h-[42px]"
              >
                <HardDriveDownload className="w-4 h-4 shrink-0" />
                <span>تنزيل حزمة الفاتحة وقصار السور والمعوذات (9 سور)</span>
              </button>

              <button
                onClick={handleDownloadJuzAmmaPack}
                disabled={Boolean(downloadingTitle)}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/40 text-teal-300 text-xs font-bold cursor-pointer disabled:opacity-50 min-h-[42px]"
              >
                <HardDriveDownload className="w-4 h-4 shrink-0" />
                <span>تنزيل جزء عمّ كاملاً (37 سورة) بالشيخ المختار</span>
              </button>
            </div>
          </div>
        </div>

        {/* Adhkar Offline Audio Downloader */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Sun className="w-4 h-4" />
              <span>تنزيل مقاطع أذكار الصباح والمساء بدون إنترنت (دعم كافة الشيوخ الـ {ADHKAR_SHEIKHS.length})</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={selectedAdhkarSheikhId}
              onChange={(e) => setSelectedAdhkarSheikhId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold min-h-[44px]"
            >
              {ADHKAR_SHEIKHS.map((sh) => (
                <option key={sh.id} value={sh.id}>
                  {sh.name} — {sh.style}
                </option>
              ))}
            </select>

            <button
              onClick={handleDownloadAdhkarPack}
              disabled={Boolean(downloadingTitle)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold cursor-pointer min-h-[44px] active:scale-95"
            >
              <HardDriveDownload className="w-4 h-4 shrink-0" />
              <span>تنزيل للشيخ المختار</span>
            </button>

            <button
              onClick={handleDownloadAllSheikhsAdhkar}
              disabled={Boolean(downloadingTitle)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 disabled:opacity-50 text-amber-300 text-xs sm:text-sm font-bold cursor-pointer min-h-[44px] active:scale-95"
            >
              <HardDriveDownload className="w-4 h-4 shrink-0" />
              <span>تنزيل كافة الشيوخ ({ADHKAR_SHEIKHS.length} شيخاً)</span>
            </button>
          </div>
        </div>

        {/* Downloaded Audio Packs List */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-400">
            الحزم الصوتية المحفوظة للعمل بدون إنترنت ({audioPacks.length})
          </h4>
          {audioPacks.length === 0 ? (
            <div className="p-5 rounded-2xl bg-slate-950/50 border border-dashed border-slate-800 text-center text-xs text-slate-400">
              لم تقم بتنزيل حزم صوتية إضافية بعد. نص المصحف والأذكار يعمل بدون إنترنت دائماً، ويمكنك تنزيل أي سورة أعلاه للاستماع لها أوفلاين.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {audioPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/20 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {pack.title}
                      </p>
                    </div>
                    <p className="text-[11px] text-emerald-400 truncate">{pack.reciterName}</p>
                    <p className="text-[11px] text-slate-400">
                      {pack.subtitle} • {pack.ayahCount} مقطع محفوظ
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemovePack(pack)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 text-slate-400 hover:text-rose-300 cursor-pointer shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
                    title="حذف الحزمة من الذاكرة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
