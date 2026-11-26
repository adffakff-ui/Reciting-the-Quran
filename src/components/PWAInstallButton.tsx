import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-950/50 transition-all cursor-pointer active:scale-95 ${
          compact
            ? 'px-2.5 py-1.5 text-[11px] sm:text-xs min-h-[36px]'
            : 'px-4 py-2.5 text-xs sm:text-sm min-h-[42px]'
        }`}
        title="تثبيت التطبيق للعمل بدون إنترنت"
      >
        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
        <span>{compact ? 'تثبيت' : 'تثبيت التطبيق على الجهاز'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-emerald-300 font-bold transition-all cursor-pointer active:scale-95 ${
            compact
              ? 'px-2.5 py-1.5 text-[11px] sm:text-xs min-h-[36px]'
              : 'px-4 py-2.5 text-xs sm:text-sm min-h-[42px]'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span>{compact ? 'تثبيت iOS' : 'تثبيت التطبيق على iPhone / iPad'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-emerald-500/30 p-5 shadow-2xl space-y-4 text-right">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white font-quran">
                  تثبيت التطبيق للعمل بدون إنترنت
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
                  <Share className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    1. اضغط على زر <strong className="text-white">المشاركة (Share)</strong> في شريط متصفح سفاري بالأسفل.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
                  <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    2. مرر للأسفل واختر <strong className="text-white">إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                فهمت، إغلاق
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
