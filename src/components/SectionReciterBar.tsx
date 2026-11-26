import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Layers, Star, UserCheck, Volume2, Square } from 'lucide-react';
import { ADHKAR_SHEIKHS, AdhkarSheikh } from '../data/adhkarData';
import {
  RECITER_PREFERENCES_EVENT,
  ReciterPreferences,
  ReciterSectionKey,
  formatSheikhOptionLabel,
  getReciterPreferences,
  getSheikhById,
  setAllDefaultsToReciter,
  sortWithFavoritesFirst,
  speakArabicWithSheikh,
  stopArabicSpeech,
  toggleFavoriteReciter,
} from '../utils/reciterPreferences';

interface SectionReciterBarProps {
  sectionKey: Extract<ReciterSectionKey, 'shatibiyyah' | 'jazariyyah' | 'hisn'>;
  sectionTitle: string;
  selectedSheikh: AdhkarSheikh;
  favoriteReciterIds: string[];
  onSelectSheikh: (sheikh: AdhkarSheikh) => void;
  onPreferencesChange?: (prefs: ReciterPreferences) => void;
  accent?: 'amber' | 'emerald' | 'teal';
}

export const SectionReciterBar: React.FC<SectionReciterBarProps> = ({
  sectionKey,
  sectionTitle,
  selectedSheikh,
  favoriteReciterIds,
  onSelectSheikh,
  onPreferencesChange,
  accent = 'emerald',
}) => {
  const [prefs, setPrefs] = useState<ReciterPreferences>(() => getReciterPreferences());
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    const sync = () => setPrefs(getReciterPreferences());
    window.addEventListener(RECITER_PREFERENCES_EVENT, sync);
    window.addEventListener('murtal-backup-restored', sync);
    return () => {
      window.removeEventListener(RECITER_PREFERENCES_EVENT, sync);
      window.removeEventListener('murtal-backup-restored', sync);
    };
  }, []);

  const flashNotice = (msg: string) => {
    setInlineNotice(msg);
    setTimeout(() => {
      setInlineNotice((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const sortedSheikhs = sortWithFavoritesFirst(ADHKAR_SHEIKHS, favoriteReciterIds);
  const isCurrentFav = favoriteReciterIds.includes(selectedSheikh.id);
  const isAllDefault =
    prefs.defaultSurahReciterId === selectedSheikh.id &&
    prefs.defaultAdhkarSheikhId === selectedSheikh.id &&
    prefs.defaultHisnSheikhId === selectedSheikh.id &&
    prefs.defaultShatibiyyahSheikhId === selectedSheikh.id &&
    prefs.defaultJazariyyahSheikhId === selectedSheikh.id;

  const sectionLabelMap: Record<typeof sectionKey, string> = {
    shatibiyyah: 'الشاطبية',
    jazariyyah: 'الجزرية',
    hisn: 'حصن المسلم',
  };

  const previewSampleMap: Record<typeof sectionKey, string> = {
    shatibiyyah: 'بَدَأْتُ بِبِسْمِ اللَّهِ فِي النَّظْمِ أَوَّلَا، تَبَارَكَ رَحْمَانًا رَحِيمًا وَمَوْئِلَا.',
    jazariyyah: 'يَقُولُ رَاجِي عَفْوِ رَبٍّ سَامِعِ، مُحَمَّدُ بْنُ الْجَزَرِيِّ الشَّافِعِي.',
    hisn: 'بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ.',
  };

  const iconAccentClasses =
    accent === 'amber'
      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
      : accent === 'teal'
      ? 'bg-teal-500/15 border-teal-500/30 text-teal-400'
      : 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400';

  const handleToggleFavorite = () => {
    const updated = toggleFavoriteReciter(selectedSheikh.id);
    setPrefs(updated);
    onPreferencesChange?.(updated);
    const nowFav = updated.favoriteReciterIds.includes(selectedSheikh.id);
    flashNotice(
      nowFav
        ? `تمت إضافة ${selectedSheikh.name} إلى القراء المفضلين.`
        : `تمت إزالة ${selectedSheikh.name} من القراء المفضلين.`
    );
  };

  const handleApplyToAll = () => {
    const updated = setAllDefaultsToReciter(selectedSheikh.id);
    setPrefs(updated);
    onPreferencesChange?.(updated);
    flashNotice(
      `تم اعتماد ${selectedSheikh.name} قارئاً افتراضياً للمصحف والأذكار وحصن المسلم والشاطبية والجزرية.`
    );
  };

  const handlePreviewVoice = () => {
    if (isPreviewing) {
      stopArabicSpeech();
      setIsPreviewing(false);
      return;
    }
    setIsPreviewing(true);
    speakArabicWithSheikh(previewSampleMap[sectionKey], selectedSheikh, {
      onFallbackNotice: (msg) => flashNotice(msg),
      onEnd: () => setIsPreviewing(false),
      onError: () => setIsPreviewing(false),
    });
  };

  return (
    <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 w-full max-w-full overflow-hidden">
      {/* Header + Primary Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconAccentClasses}`}
          >
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-xs sm:text-sm font-bold text-white leading-snug">
              {sectionTitle}
            </p>
            <p className="text-[11px] sm:text-xs text-emerald-300 font-semibold truncate">
              {selectedSheikh.name} · {selectedSheikh.style}
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-1">
              قراءة كاملة لجميع النصوص والأذكار دون استثناء · {selectedSheikh.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-[400px] xl:w-[440px] min-w-0 shrink-0">
          <select
            aria-label={sectionTitle}
            value={selectedSheikh.id}
            onChange={(e) => {
              const next = getSheikhById(e.target.value);
              setIsPreviewing(false);
              onSelectSheikh(next);
              flashNotice(`تم تعيين ${next.name} افتراضياً لقسم ${sectionLabelMap[sectionKey]}.`);
            }}
            className="w-full min-w-0 flex-1 bg-slate-950 border border-emerald-500/35 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-emerald-300 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 min-h-[44px] cursor-pointer truncate"
          >
            {sortedSheikhs.map((s) => (
              <option key={s.id} value={s.id}>
                {formatSheikhOptionLabel(s.name, s.style, favoriteReciterIds.includes(s.id))}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleToggleFavorite}
            className={`min-h-[44px] min-w-[44px] px-2.5 rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
              isCurrentFav
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-amber-300'
            }`}
            title={isCurrentFav ? 'إزالة من القراء المفضلين' : 'إضافة إلى القراء المفضلين'}
            aria-label={isCurrentFav ? 'إزالة من القراء المفضلين' : 'إضافة إلى القراء المفضلين'}
          >
            <Star className={`w-4 h-4 shrink-0 ${isCurrentFav ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Sheikh Selection Strip + Preview & Apply to All */}
      <div className="pt-2.5 border-t border-slate-800/80 space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] text-slate-400 font-semibold">
            اختيار سريع للقارئ · المفضلون أولاً ({favoriteReciterIds.length} من {ADHKAR_SHEIKHS.length})
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePreviewVoice}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer min-h-[36px] whitespace-nowrap shrink-0 ${
                isPreviewing
                  ? 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-emerald-300 hover:border-emerald-500/40'
              }`}
            >
              {isPreviewing ? (
                <>
                  <Square className="w-3 h-3 fill-current shrink-0" />
                  <span>إيقاف المعاينة</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 shrink-0" />
                  <span>معاينة القراءة</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleApplyToAll}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer min-h-[36px] whitespace-nowrap shrink-0 ${
                isAllDefault
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200 hover:border-emerald-500/40'
              }`}
            >
              {isAllDefault ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>معتمد افتراضياً لجميع الأقسام</span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>اعتماد لجميع الأقسام</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 w-full max-w-full">
          {sortedSheikhs.map((s) => {
            const isSelected = selectedSheikh.id === s.id;
            const isFav = favoriteReciterIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelectSheikh(s);
                  flashNotice(`تم تعيين ${s.name} افتراضياً لقسم ${sectionLabelMap[sectionKey]}.`);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer min-h-[40px] ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60'
                    : isFav
                    ? 'bg-amber-950/30 border border-amber-500/35 text-amber-200 hover:text-white'
                    : 'bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                {isFav && <Star className="w-3 h-3 text-amber-400 fill-current shrink-0" />}
                <span>{s.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {inlineNotice && (
        <div className="px-3 py-2 rounded-xl bg-emerald-950/70 border border-emerald-500/35 text-emerald-200 text-xs font-semibold">
          {inlineNotice}
        </div>
      )}
    </div>
  );
};
