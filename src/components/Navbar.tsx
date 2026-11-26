import React, { useState } from 'react';
import { 
  BookOpen, Mic, Brain, ShieldCheck, BarChart3, 
  Sun, Calendar, Menu, X, Flame, ChevronLeft, HardDriveDownload, ScrollText, BookMarked, Shield 
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  streak: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, streak }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'mushaf', label: 'المصحف الشريف', shortLabel: 'المصحف', icon: BookOpen },
    { id: 'coach', label: 'مُعلم التجويد الذكي', shortLabel: 'المعلم الذكي', icon: Mic },
    { id: 'quiz', label: 'اختبارات الحفظ', shortLabel: 'الاختبارات', icon: Brain },
    { id: 'spaced', label: 'التكرار المتباعد', shortLabel: 'المراجعة', icon: Calendar },
    { id: 'adhkar', label: 'الأذكار اليومية', shortLabel: 'الأذكار', icon: Sun },
    { id: 'hisn', label: 'حصن المسلم', shortLabel: 'حصن المسلم', icon: Shield },
    { id: 'guide', label: 'دليلك للتجويد', shortLabel: 'أحكام التجويد', icon: ShieldCheck },
    { id: 'jazariyyah', label: 'متن الجزرية', shortLabel: 'الجزرية', icon: BookMarked },
    { id: 'shatibiyyah', label: 'متن الشاطبية', shortLabel: 'الشاطبية', icon: ScrollText },
    { id: 'dashboard', label: 'لوحة الإنجاز', shortLabel: 'الإنجاز', icon: BarChart3 },
    { id: 'backup', label: 'النسخة الاحتياطية', shortLabel: 'أوفلاين', icon: HardDriveDownload },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-emerald-500/20 shadow-lg w-full max-w-full overflow-hidden">
      {/* Top Header Row */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-20 gap-2">
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none min-w-0" 
            onClick={() => handleSelectTab('mushaf')}
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-900/40 border border-emerald-400/30 shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm sm:text-xl font-bold bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-500 bg-clip-text text-transparent font-quran leading-tight truncate">
                مُرَتِّل القرآن الذكي
              </h1>
              <p className="text-[10px] sm:text-xs text-emerald-400/80 font-medium hidden sm:block truncate">
                الترتيل • التجويد • الحفظ الذكي
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full px-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer min-h-[38px] ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.shortLabel}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls: PWA Install, Streak & Mobile Menu Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton compact />

            {/* Streak Badge */}
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] sm:text-xs font-bold shadow-sm whitespace-nowrap">
              <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 animate-pulse" />
              <span>{streak} أيام</span>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center active:scale-95"
              title="القائمة الكاملة"
            >
              {mobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Horizontal Pill Scrollable Tabs Bar */}
      <div className="lg:hidden w-full overflow-x-auto no-scrollbar border-t border-slate-800/80 bg-slate-900/95 px-2 py-1.5">
        <div className="flex items-center gap-1.5 min-w-max px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer min-h-[38px] active:scale-95 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                    : 'bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-400'}`} />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Drawer Menu (When Hamburger Clicked) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[102px] bottom-0 z-50 bg-slate-950/98 backdrop-blur-xl p-3 sm:p-4 overflow-y-auto animate-fadeIn border-t border-slate-800">
          <div className="space-y-2 max-w-md mx-auto pb-8">
            <p className="text-[11px] font-bold text-emerald-400 px-3 pb-1 uppercase tracking-wider">
              أقسام النظام والمصحف الشريف
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border text-right font-medium transition-all cursor-pointer min-h-[50px] active:scale-[0.98] ${
                    isActive
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg'
                      : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold block truncate">{item.label}</span>
                      <span className="text-[11px] text-slate-400 font-sans block truncate">
                        {item.id === 'mushaf' && 'تصفح القرآن الكريم كاملاً 114 سورة'}
                        {item.id === 'coach' && 'متابعة وتنبيه فوري لأخطاء القراءة'}
                        {item.id === 'quiz' && 'اختبارات الحفظ والربط بين الآيات'}
                        {item.id === 'spaced' && 'تثبيت الحفظ بجدولة علمية ذكية'}
                        {item.id === 'adhkar' && 'أذكار الصباح والمساء والورد اليومي'}
                        {item.id === 'hisn' && 'أذكار وأدعية الكتاب والسنة لليوم والليلة'}
                        {item.id === 'guide' && 'أحكام النون، الميم، القلقلة، والمدود'}
                        {item.id === 'jazariyyah' && 'المقدمة الجزرية في مخارج الحروف والصفات'}
                        {item.id === 'shatibiyyah' && 'حرز الأماني ورموز القراء السبعة ورواتهم'}
                        {item.id === 'dashboard' && 'متابعة الإنجاز اليومي والإحصائيات'}
                        {item.id === 'backup' && 'تصدير، استعادة، وتنزيل التلاوات بدون إنترنت'}
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
