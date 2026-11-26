import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  HardDriveDownload,
  LogIn,
  LogOut,
  Power,
  ShieldCheck,
  X,
} from 'lucide-react';
import { APP_VERSION } from '../utils/offlineStorage';

declare global {
  interface Window {
    AndroidApp?: {
      exitApp?: () => void;
    };
  }
}

export function canExitNativeAndroidApp(): boolean {
  return typeof window !== 'undefined' && typeof window.AndroidApp?.exitApp === 'function';
}

export function exitNativeAndroidApp(): void {
  try {
    window.AndroidApp?.exitApp?.();
  } catch {}
}

interface SignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarksCount: number;
  streak: number;
  onConfirmSignOut: (clearLocalData: boolean) => void;
}

export const SignOutModal: React.FC<SignOutModalProps> = ({
  isOpen,
  onClose,
  bookmarksCount,
  streak,
  onConfirmSignOut,
}) => {
  const [clearLocalData, setClearLocalData] = useState(false);
  const isAndroidApk = canExitNativeAndroidApp();

  useEffect(() => {
    if (!isOpen) {
      setClearLocalData(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-modal-title"
    >
      <div
        className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-right my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="signout-modal-title" className="text-base sm:text-lg font-bold text-white truncate">
                تسجيل خروج من التطبيق
              </h2>
              <p className="text-xs text-slate-400">
                إنهاء الجلسة الحالية بأمان
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            سيتم إيقاف أي تلاوة أو قراءة صوتية نشطة وإنهاء جلسة الاستخدام الحالية. تبقى علاماتك وإنجازاتك محفوظة محلياً ما لم تختر مسحها.
          </p>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs text-slate-400 tabular-nums">
            <span>العلامات المرجعية: {bookmarksCount}</span>
            <span>السلسلة الحالية: {streak} أيام</span>
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-rose-500/30 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={clearLocalData}
              onChange={(e) => setClearLocalData(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-rose-500 cursor-pointer shrink-0"
            />
            <div className="space-y-0.5 text-xs">
              <span className="font-bold text-slate-200 block">
                مسح بيانات التقدم وتفضيلات القراء من هذا الجهاز
              </span>
              <span className="text-slate-400 block">
                يُترك غير مفعّل للحفاظ على حفظك وأذكارك عند العودة.
              </span>
            </div>
          </label>

          {clearLocalData && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>تنبيه: سيتم حذف السجلات المحلية المخزنة على المتصفح نهائياً عند تأكيد الخروج.</span>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => onConfirmSignOut(clearLocalData)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>تأكيد تسجيل الخروج</span>
            </button>

            {isAndroidApk && (
              <button
                type="button"
                onClick={exitNativeAndroidApp}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Power className="w-4 h-4 shrink-0" />
                <span>إغلاق التطبيق نهائياً</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
            >
              إلغاء والبقاء في التطبيق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SignedOutViewProps {
  onResumeSession: () => void;
  onOpenAbout: () => void;
  onOpenBackup: () => void;
  clearedData: boolean;
}

export const SignedOutView: React.FC<SignedOutViewProps> = ({
  onResumeSession,
  onOpenAbout,
  onOpenBackup,
  clearedData,
}) => {
  const isAndroidApk = canExitNativeAndroidApp();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-8 font-cairo">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
          <BookOpen className="w-8 h-8 text-white" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-quran">
            مُرَتِّل القرآن الذكي
          </h1>
          <p className="text-xs sm:text-sm text-emerald-300 font-semibold flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>تم تسجيل الخروج من الجلسة بأمان</span>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            {clearedData
              ? 'تم مسح بيانات الجلسة المحلية وإعادة ضبط التفضيلات الافتراضية.'
              : 'تم إيقاف القراءة الصوتية وإغلاق الجلسة مع الاحتفاظ ببيانات حفظك وعلاماتك محلياً.'}
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={onResumeSession}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all active:scale-[0.99]"
          >
            <LogIn className="w-4 h-4 shrink-0" />
            <span>الدخول ومتابعة التلاوة</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenBackup}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <HardDriveDownload className="w-4 h-4 text-amber-400 shrink-0" />
              <span>النسخة الاحتياطية</span>
            </button>

            <button
              type="button"
              onClick={onOpenAbout}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>عن التطبيق</span>
            </button>
          </div>

          {isAndroidApk && (
            <button
              type="button"
              onClick={exitNativeAndroidApp}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Power className="w-4 h-4 shrink-0" />
              <span>إغلاق التطبيق نهائياً</span>
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80 tabular-nums">
          الإصدار {APP_VERSION} · مُرَتِّل القرآن الذكي
        </p>
      </div>
    </div>
  );
};
