import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Mic,
  Brain,
  ShieldCheck,
  BarChart3,
  Sun,
  Calendar,
  Menu,
  X,
  Flame,
  ChevronLeft,
  HardDriveDownload,
  ScrollText,
  BookMarked,
  Shield,
  Info,
  LogOut,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Pin,
  RotateCcw,
  Check,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { APP_VERSION } from '../utils/offlineStorage';
import { stopArabicSpeech } from '../utils/reciterPreferences';
import {
  NAV_PREFERENCES_EVENT,
  NAV_SECTIONS,
  NavPreferences,
  NavSectionMeta,
  applyMainButtonsPreset,
  getNavPreferences,
  setFeaturedMainButton,
  setMobileQuickBarVisible,
  toggleMainButtonVisibility,
} from '../utils/navPreferences';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  streak: number;
  onOpenAbout: () => void;
  onRequestSignOut: () => void;
}

const SECTION_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  mushaf: BookOpen,
  coach: Mic,
  quiz: Brain,
  spaced: Calendar,
  guide: ShieldCheck,
  adhkar: Sun,
  hisn: Shield,
  jazariyyah: BookMarked,
  shatibiyyah: ScrollText,
  dashboard: BarChart3,
  backup: HardDriveDownload,
};

function getSectionIcon(id: string): React.ComponentType<{ className?: string }> {
  return SECTION_ICON_MAP[id] || BookOpen;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  streak,
  onOpenAbout,
  onRequestSignOut,
}) => {
  const headerRef = useRef<HTMLElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [navPrefs, setNavPrefs] = useState<NavPreferences>(() => getNavPreferences());
  const [customNotice, setCustomNotice] = useState<string | null>(null);

  // Sync navigation preferences across components & backup restores
  useEffect(() => {
    const syncNav = () => setNavPrefs(getNavPreferences());
    window.addEventListener(NAV_PREFERENCES_EVENT, syncNav);
    window.addEventListener('murtal-backup-restored', syncNav);
    return () => {
      window.removeEventListener(NAV_PREFERENCES_EVENT, syncNav);
      window.removeEventListener('murtal-backup-restored', syncNav);
    };
  }, []);

  // Measure actual header height dynamically so sticky players never overlap or leave gaps
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof document === 'undefined') return;

    const updateOffset = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty('--murtal-header-offset', `${h + 6}px`);
      }
    };

    updateOffset();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateOffset);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, [navPrefs]);

  // Body scroll lock & Escape handler while drawer is open
  useEffect(() => {
    if (!drawerOpen) {
      setCustomizing(false);
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const flashNotice = (msg: string) => {
    setCustomNotice(msg);
    setTimeout(() => {
      setCustomNotice((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const handleSelectTab = (tabId: string) => {
    if (tabId !== activeTab) {
      stopArabicSpeech();
    }
    setActiveTab(tabId);
    setDrawerOpen(false);
  };

  const handleOpenAbout = () => {
    setDrawerOpen(false);
    onOpenAbout();
  };

  const handleOpenSignOut = () => {
    setDrawerOpen(false);
    onRequestSignOut();
  };

  const handleToggleVisible = (section: NavSectionMeta) => {
    const updated = toggleMainButtonVisibility(section.id);
    setNavPrefs(updated);
    const isNowVisible = updated.visibleMainButtons.includes(section.id);
    flashNotice(
      isNowVisible
        ? `تم إظهار زر «${section.shortLabel}» على الشاشة الرئيسية.`
        : `تم إخفاء زر «${section.shortLabel}» من الشاشة الرئيسية.`
    );
  };

  const handleSetFeatured = (sectionId: string | null) => {
    const updated = setFeaturedMainButton(sectionId);
    setNavPrefs(updated);
    if (!sectionId) {
      flashNotice('تم إخفاء الزر المخصص من الشريط العلوي.');
    } else {
      const found = NAV_SECTIONS.find((s) => s.id === sectionId);
      if (found) {
        flashNotice(`تم تعيين «${found.shortLabel}» كزر مخصص على الشاشة الرئيسية.`);
      }
    }
  };

  const featuredSection = navPrefs.featuredButtonId
    ? NAV_SECTIONS.find((s) => s.id === navPrefs.featuredButtonId) || null
    : null;

  // Build ordered desktop bar buttons without duplicates
  const desktopItems: NavSectionMeta[] = (() => {
    const list: NavSectionMeta[] = [];
    if (featuredSection) list.push(featuredSection);
    for (const id of navPrefs.visibleMainButtons) {
      if (featuredSection && id === featuredSection.id) continue;
      const found = NAV_SECTIONS.find((s) => s.id === id);
      if (found) list.push(found);
    }
    return list;
  })();

  // Build mobile quick bar items excluding featuredSection (which lives cleanly in the top row!)
  const mobileQuickItems: NavSectionMeta[] = navPrefs.visibleMainButtons
    .filter((id) => !featuredSection || id !== featuredSection.id)
    .map((id) => NAV_SECTIONS.find((s) => s.id === id))
    .filter((s): s is NavSectionMeta => Boolean(s));

  const showMobileQuickRow = navPrefs.showQuickBarOnMobile && mobileQuickItems.length > 0;

  const quranGroup = NAV_SECTIONS.filter((it) => it.group === 'quran');
  const adhkarGroup = NAV_SECTIONS.filter((it) => it.group === 'adhkar');
  const toolsGroup = NAV_SECTIONS.filter((it) => it.group === 'tools');

  const activeMainCount = Array.from(
    new Set([
      ...navPrefs.visibleMainButtons,
      ...(navPrefs.featuredButtonId ? [navPrefs.featuredButtonId] : []),
    ])
  ).length;

  const renderDrawerSectionRow = (item: NavSectionMeta, accentColorClass: string) => {
    const Icon = getSectionIcon(item.id);
    const isActive = activeTab === item.id;
    const isVisibleOnMain = navPrefs.visibleMainButtons.includes(item.id);
    const isFeatured = navPrefs.featuredButtonId === item.id;

    return (
      <div
        key={item.id}
        className={`w-full flex items-center justify-between gap-2 p-2 rounded-2xl border transition-colors min-h-[54px] ${
          isActive
            ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-200'
            : 'bg-slate-950/60 border-slate-800/80 text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <button
          type="button"
          onClick={() => (customizing ? handleToggleVisible(item) : handleSelectTab(item.id))}
          className="flex-1 flex items-center gap-3 min-w-0 text-right cursor-pointer py-0.5"
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isActive ? 'bg-emerald-600 text-white' : `bg-slate-800 ${accentColorClass}`
            }`}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-bold truncate">{item.label}</span>
              {!customizing && isFeatured && (
                <span className="text-[10px] font-semibold text-amber-300 shrink-0">· مخصص</span>
              )}
              {!customizing && !isFeatured && isVisibleOnMain && (
                <span className="text-[10px] font-semibold text-emerald-400 shrink-0">· ظاهر</span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 block truncate">{item.description}</span>
          </div>
        </button>

        {customizing ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleSetFeatured(isFeatured ? null : item.id)}
              className={`min-h-[40px] min-w-[40px] px-2 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
                isFeatured
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-amber-300'
              }`}
              title={isFeatured ? 'إلغاء التعيين كزر مخصص' : 'تعيين كزر مخصص على الشاشة الرئيسية'}
              aria-label={`تعيين ${item.label} كزر مخصص`}
            >
              <Pin className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleToggleVisible(item)}
              className={`min-h-[40px] px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                isVisibleOnMain
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title={isVisibleOnMain ? 'إخفاء من الشاشة الرئيسية' : 'إظهار على الشاشة الرئيسية'}
              aria-label={isVisibleOnMain ? `إخفاء ${item.label}` : `إظهار ${item.label}`}
            >
              {isVisibleOnMain ? (
                <>
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>ظاهر</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                  <span>مخفي</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleSelectTab(item.id)}
            className="min-h-[40px] min-w-[32px] flex items-center justify-center text-slate-500 hover:text-white cursor-pointer shrink-0"
            aria-label={`فتح ${item.label}`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-emerald-500/20 shadow-lg w-full max-w-full overflow-x-clip"
      >
        {/* Top Header Row */}
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 lg:h-[74px] gap-2 sm:gap-3">
            {/* Zone 1: Brand Title */}
            <button
              type="button"
              onClick={() => handleSelectTab('mushaf')}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none min-w-0 text-right shrink-0"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-900/40 border border-emerald-400/30 shrink-0">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-sm sm:text-lg lg:text-xl font-bold bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent font-quran leading-tight whitespace-nowrap truncate max-w-[125px] xs:max-w-[155px] sm:max-w-none">
                مُرَتِّل القرآن الذكي
              </span>
            </button>

            {/* Zone 2: Desktop User-Configured Main Buttons (No duplicates, hides unwanted buttons) */}
            {desktopItems.length > 0 && (
              <nav
                className="hidden lg:flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-2xl xl:max-w-3xl px-1"
                aria-label="الأزرار المعروضة على الشاشة الرئيسية"
              >
                {desktopItems.map((item) => {
                  const Icon = getSectionIcon(item.id);
                  const isActive = activeTab === item.id;
                  const isFeatured = featuredSection?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[40px] ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                          : isFeatured
                          ? 'bg-amber-500/15 border border-amber-400/45 text-amber-200 hover:bg-amber-500/25'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? 'text-white'
                            : isFeatured
                            ? 'text-amber-300'
                            : 'text-slate-400'
                        }`}
                      />
                      <span>{item.shortLabel}</span>
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Zone 3: Custom Mobile Featured Button, PWA Install, Streak & Three-Lines Menu Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
              {/* Dedicated User-Selected Featured Button on Mobile Main Screen */}
              {featuredSection && (() => {
                const FeaturedIcon = getSectionIcon(featuredSection.id);
                const isActive = activeTab === featuredSection.id;
                return (
                  <button
                    type="button"
                    onClick={() => handleSelectTab(featuredSection.id)}
                    className={`lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer min-h-[40px] max-w-[115px] min-w-0 active:scale-95 ${
                      isActive
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-amber-500/15 border-amber-400/45 text-amber-200 hover:bg-amber-500/25'
                    }`}
                    title={`الزر المخصص: ${featuredSection.label}`}
                  >
                    <FeaturedIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{featuredSection.shortLabel}</span>
                  </button>
                );
              })()}

              <PWAInstallButton compact />

              <div
                className={`items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-bold whitespace-nowrap tabular-nums ${
                  featuredSection ? 'hidden sm:flex' : 'flex'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{streak} أيام</span>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen((prev) => !prev)}
                aria-expanded={drawerOpen}
                aria-controls="main-navigation-drawer"
                aria-label="فتح القائمة الرئيسية وتخصيص الأزرار"
                className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 rounded-xl border font-bold text-xs transition-colors cursor-pointer min-h-[44px] min-w-[44px] whitespace-nowrap shrink-0 active:scale-95 ${
                  drawerOpen
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white'
                }`}
                title="القائمة الرئيسية · تخصيص الأزرار · عنا · تسجيل خروج"
              >
                {drawerOpen ? (
                  <X className="w-5 h-5 shrink-0" />
                ) : (
                  <Menu className="w-5 h-5 shrink-0" />
                )}
                <span className="hidden sm:inline">القائمة</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Quick Strip (Only shows user-selected buttons when enabled) */}
        {showMobileQuickRow && (
          <div className="lg:hidden w-full overflow-x-auto no-scrollbar border-t border-slate-800/80 bg-slate-900/95 px-2 py-1">
            <div className="flex items-center gap-1.5 min-w-max px-1">
              {mobileQuickItems.map((item) => {
                const Icon = getSectionIcon(item.id);
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors shrink-0 cursor-pointer min-h-[40px] active:scale-95 ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                        : 'bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-white' : 'text-emerald-400'
                      }`}
                    />
                    <span>{item.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Unified Three-Lines Slide-Over Drawer */}
      {drawerOpen && (
        <div
          id="main-navigation-drawer"
          className="fixed inset-0 z-[75] flex justify-end animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label="القائمة الرئيسية للتطبيق"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm cursor-pointer"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <aside className="relative z-10 w-[min(94vw,410px)] h-full bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col text-right mr-auto">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-900">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-bold text-white font-quran truncate">
                    مُرَتِّل القرآن الذكي
                  </p>
                  <p className="text-[11px] text-slate-400 tabular-nums truncate">
                    الإصدار {APP_VERSION} · السلسلة {streak} أيام
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
                aria-label="إغلاق القائمة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
              {/* Main Screen Button Customization Controls */}
              <div className="p-3 rounded-2xl bg-slate-950/90 border border-emerald-500/25 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      أزرار الشاشة الرئيسية
                    </p>
                    <p className="text-[11px] text-slate-400 tabular-nums truncate">
                      المعروض حالياً: {activeMainCount} من {NAV_SECTIONS.length} أقسام
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCustomizing((v) => !v)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                      customizing
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-emerald-300'
                    }`}
                  >
                    {customizing ? (
                      <>
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>حفظ وإغلاق التخصيص</span>
                      </>
                    ) : (
                      <>
                        <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                        <span>تخصيص الأزرار</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Custom Featured Button Selector (Always Quick-Accessible) */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <label
                    htmlFor="custom-main-button-select"
                    className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5"
                  >
                    <Pin className="w-3.5 h-3.5 shrink-0" />
                    <span>تخصيص الزر الرئيسي المعروض في الشريط العلوي:</span>
                  </label>
                  <select
                    id="custom-main-button-select"
                    value={navPrefs.featuredButtonId || ''}
                    onChange={(e) => handleSetFeatured(e.target.value || null)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 min-h-[42px] cursor-pointer"
                  >
                    <option value="">إخفاء الزر المخصص (القائمة فقط)</option>
                    {NAV_SECTIONS.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Expanded Customizer Tools */}
                {customizing && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-300 font-semibold">
                        شريط الأزرار السريع (الجوال):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = setMobileQuickBarVisible(!navPrefs.showQuickBarOnMobile);
                          setNavPrefs(updated);
                          flashNotice(
                            updated.showQuickBarOnMobile
                              ? 'تم إظهار شريط الأزرار السريع.'
                              : 'تم إخفاء شريط الأزرار السريع من الشاشة الرئيسية.'
                          );
                        }}
                        className={`min-h-[36px] px-3 py-1 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors ${
                          navPrefs.showQuickBarOnMobile
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        {navPrefs.showQuickBarOnMobile ? 'ظاهر' : 'مخفي'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = applyMainButtonsPreset('minimal');
                          setNavPrefs(updated);
                          flashNotice('تم إخفاء جميع الأزرار الثانوية من الشاشة الرئيسية.');
                        }}
                        className="min-h-[38px] px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                      >
                        إخفاء الكل
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = applyMainButtonsPreset('default');
                          setNavPrefs(updated);
                          flashNotice('تمت استعادة الإعداد المتوازن الافتراضي.');
                        }}
                        className="min-h-[38px] px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 shrink-0" />
                        <span>افتراضي</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = applyMainButtonsPreset('all');
                          setNavPrefs(updated);
                          flashNotice('تم إظهار جميع الأقسام على الشاشة الرئيسية.');
                        }}
                        className="min-h-[38px] px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                      >
                        عرض الكل
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      اضغط على أي قسم بالأسفل لإظهاره أو إخفائه من الشاشة الرئيسية، أو استخدم الدبوس لتثبيته كزر مخصص.
                    </p>
                  </div>
                )}

                {customNotice && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-950/70 border border-emerald-500/35 text-emerald-200 text-[11px] font-semibold">
                    {customNotice}
                  </div>
                )}
              </div>

              {/* Group 1: Quran & Tajweed */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-emerald-400 px-2 pb-0.5">
                  القرآن الكريم والحفظ والتجويد
                </p>
                {quranGroup.map((item) => renderDrawerSectionRow(item, 'text-emerald-400'))}
              </div>

              {/* Group 2: Adhkar & Mutun */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <p className="text-[11px] font-bold text-teal-400 px-2 pb-0.5">
                  الأذكار والمتون العلمية
                </p>
                {adhkarGroup.map((item) => renderDrawerSectionRow(item, 'text-teal-400'))}
              </div>

              {/* Group 3: Analytics & Offline */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <p className="text-[11px] font-bold text-amber-400 px-2 pb-0.5">
                  المتابعة والعمل بدون إنترنت
                </p>
                {toolsGroup.map((item) => renderDrawerSectionRow(item, 'text-amber-400'))}

                <div className="pt-1">
                  <PWAInstallButton />
                </div>
              </div>
            </div>

            {/* Drawer Footer: About ("عنا") & Sign Out ("تسجيل خروج") */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-950/90 space-y-2 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleOpenAbout}
                  className="min-h-[46px] px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>عنا</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenSignOut}
                  className="min-h-[46px] px-3 py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>تسجيل خروج</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 text-center tabular-nums">
                مُرَتِّل القرآن الذكي · الإصدار {APP_VERSION}
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
