import React, { useEffect } from 'react';
import {
  BookOpen,
  HardDriveDownload,
  Info,
  Mail,
  ShieldCheck,
  X,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { APP_VERSION, APP_VERSION_CODE } from '../utils/offlineStorage';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const features = [
    'المصحف الشريف كاملاً (114 سورة و6236 آية) مع التلاوة والتكرار بدون إنترنت',
    'توجيه التجويد التفاعلي، اختبارات الحفظ، والتكرار المتباعد الذكي',
    'أذكار الصباح والمساء وحصن المسلم بقراءة كاملة لجميع الأذكار والأدعية',
    'متن الشاطبية ومتن المقدمة الجزرية مع الشرح والتشغيل المتتتابع',
    'نظام تفضيل القراء وحفظ النسخ الاحتياطية والملفات الصوتية محلياً',
  ];

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      <div
        className="w-full max-w-xl rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-right my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-l from-emerald-950/50 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-950/50">
              <Info className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="about-modal-title"
                className="text-lg sm:text-xl font-bold text-white font-quran truncate"
              >
                عن مُرَتِّل القرآن الذكي
              </h2>
              <p className="text-xs text-slate-400 tabular-nums">
                الإصدار {APP_VERSION} · رمز البناء {APP_VERSION_CODE}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            aria-label="إغلاق نافذة عنا"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            منصة قرآنية متكاملة مصممة لتيسير التلاوة، وتصحيح التجويد، ومراجعة الحفظ، وقراءة الأذكار ومتون القراءات بواجهة عربية واضحة تعمل على الهواتف والحواسيب وفي الوضع بدون إنترنت.
          </p>

          <div className="space-y-2.5 pt-1">
            <h3 className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>أبرز إمكانات الإصدار {APP_VERSION}</span>
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
              {features.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div className="pt-3 border-t border-slate-800 space-y-2.5">
            <p className="text-xs font-bold text-slate-400">وصول سريع داخل التطبيق</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  onNavigate('mushaf');
                  onClose();
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-slate-200 text-xs font-bold min-h-[44px] cursor-pointer transition-colors"
              >
                <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>المصحف الشريف</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('dashboard');
                  onClose();
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-slate-200 text-xs font-bold min-h-[44px] cursor-pointer transition-colors"
              >
                <BarChart3 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>لوحة الإنجاز</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('backup');
                  onClose();
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-slate-200 text-xs font-bold min-h-[44px] cursor-pointer transition-colors"
              >
                <HardDriveDownload className="w-4 h-4 text-amber-400 shrink-0" />
                <span>النسخة الاحتياطية</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">التواصل والدعم: adffakff@gmail.com</span>
            </div>
            <span className="text-emerald-400 font-semibold shrink-0 tabular-nums">
              v{APP_VERSION}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold min-h-[44px] cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
