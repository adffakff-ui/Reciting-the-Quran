import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  HardDriveDownload,
  LogIn,
  LogOut,
  Plus,
  Power,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { APP_VERSION } from '../utils/offlineStorage';
import {
  UserProfile,
  getProfileColorClasses,
  getProfileInitial,
  getProfileProgressSummary,
} from '../utils/userProfiles';

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
  activeProfile: UserProfile;
  bookmarksCount: number;
  streak: number;
  onConfirmSignOut: (clearLocalData: boolean) => void;
}

export const SignOutModal: React.FC<SignOutModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
  bookmarksCount,
  streak,
  onConfirmSignOut,
}) => {
  const [clearLocalData, setClearLocalData] = useState(false);
  const isAndroidApk = canExitNativeAndroidApp();
  const colors = getProfileColorClasses(activeProfile.avatarColor);

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
              <p className="text-xs text-slate-400 truncate">
                إنهاء جلسة {activeProfile.name} بأمان
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
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl ${colors.bg} text-white font-bold text-sm flex items-center justify-center shrink-0`}
              >
                {getProfileInitial(activeProfile.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-white truncate">{activeProfile.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{activeProfile.role}</p>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
              {bookmarksCount} علامة · {streak} أيام
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            سيتم إيقاف أي تلاوة أو قراءة صوتية نشطة والعودة إلى شاشة اختيار الملفات لتتمكن أنت أو أي فرد من العائلة من الدخول لاحقاً.
          </p>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-rose-500/30 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={clearLocalData}
              onChange={(e) => setClearLocalData(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-rose-500 cursor-pointer shrink-0"
            />
            <div className="space-y-0.5 text-xs">
              <span className="font-bold text-slate-200 block">
                تصفير بيانات ملف «{activeProfile.name}» فقط
              </span>
              <span className="text-slate-400 block">
                تبقى ملفات باقي أفراد العائلة محفوظة ولن تتأثر.
              </span>
            </div>
          </label>

          {clearLocalData && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>تنبيه: سيتم تصفير حفظ وتجويد وأذكار «{activeProfile.name}» فقط عند تأكيد الخروج.</span>
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
  profiles: UserProfile[];
  activeProfileId: string;
  onSelectProfileAndResume: (profileId: string) => void;
  onOpenProfilesManager: () => void;
  onOpenAbout: () => void;
  onOpenBackup: () => void;
  clearedData: boolean;
}

export const SignedOutView: React.FC<SignedOutViewProps> = ({
  profiles,
  activeProfileId,
  onSelectProfileAndResume,
  onOpenProfilesManager,
  onOpenAbout,
  onOpenBackup,
  clearedData,
}) => {
  const isAndroidApk = canExitNativeAndroidApp();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-8 font-cairo">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-8 text-center space-y-6 animate-fadeIn">
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
              ? 'تم تصفير بيانات الملف السابق، مع بقاء ملفات العائلة الأخرى محفوظة.'
              : 'اختر ملفك الشخصي من ملفات العائلة أدناه لمتابعة حفظك وتلاوتك المستقلة.'}
          </p>
        </div>

        {/* Family Profile Picker Cards */}
        <div className="space-y-2 text-right">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>ملفات العائلة على هذا الجهاز ({profiles.length})</span>
            </span>
            <button
              type="button"
              onClick={onOpenProfilesManager}
              className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer py-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إدارة / إضافة</span>
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
            {profiles.map((p) => {
              const isLastActive = p.id === activeProfileId;
              const colors = getProfileColorClasses(p.avatarColor);
              const stats = getProfileProgressSummary(p, isLastActive);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProfileAndResume(p.id)}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-3 text-right cursor-pointer transition-colors min-h-[60px] ${
                    isLastActive
                      ? 'bg-emerald-950/35 border-emerald-500/50 hover:bg-emerald-950/55'
                      : 'bg-slate-950/70 border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl ${colors.bg} text-white font-bold text-base flex items-center justify-center shrink-0`}
                    >
                      {getProfileInitial(p.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white truncate">{p.name}</span>
                        <span className="text-[11px] text-slate-400 truncate">· {p.role}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 tabular-nums truncate">
                        سور: {stats.memorizedSurahsCount} · تجويد: {stats.tajweedSavedCount} · علامات: {stats.bookmarksCount}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 text-xs font-bold shrink-0">
                    {isLastActive ? <UserCheck className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
                    <span>دخول</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
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
