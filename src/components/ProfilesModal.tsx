import React, { useEffect, useState } from 'react';
import {
  Check,
  Edit3,
  Plus,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  ProfileColor,
  ProfilesStore,
  UserProfile,
  createUserProfile,
  deleteUserProfile,
  getProfileColorClasses,
  getProfileInitial,
  getProfileProgressSummary,
  initOrGetProfilesStore,
  syncActiveProfileSnapshot,
  updateUserProfileDetails,
} from '../utils/userProfiles';

interface ProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchProfile: (profileId: string) => void;
}

const ROLE_PRESETS = ['فرد من العائلة', 'الوالد', 'الوالدة', 'الابن', 'الابنة', 'طالب علم'];

const COLOR_OPTIONS: { id: ProfileColor; label: string; dotClass: string }[] = [
  { id: 'emerald', label: 'زمردي', dotClass: 'bg-emerald-500' },
  { id: 'teal', label: 'فيروزي', dotClass: 'bg-teal-500' },
  { id: 'amber', label: 'ذهبي', dotClass: 'bg-amber-500' },
  { id: 'indigo', label: 'نيلي', dotClass: 'bg-indigo-500' },
  { id: 'sky', label: 'سماوي', dotClass: 'bg-sky-500' },
  { id: 'rose', label: 'وردي', dotClass: 'bg-rose-500' },
];

export const ProfilesModal: React.FC<ProfilesModalProps> = ({
  isOpen,
  onClose,
  onSwitchProfile,
}) => {
  const [store, setStore] = useState<ProfilesStore>(() => initOrGetProfilesStore());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('فرد من العائلة');
  const [newColor, setNewColor] = useState<ProfileColor>('teal');
  const [copyDisplayPrefs, setCopyDisplayPrefs] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editColor, setEditColor] = useState<ProfileColor>('emerald');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowCreateForm(false);
      setEditingId(null);
      setConfirmDeleteId(null);
      return;
    }
    setStore(syncActiveProfileSnapshot());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const flashNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      flashNotice('يرجى إدخال اسم المستخدم أولاً.');
      return;
    }
    const { store: updated, created } = createUserProfile({
      name: newName,
      role: newRole,
      avatarColor: newColor,
      copyDisplayPreferences: copyDisplayPrefs,
      switchImmediately: true,
    });
    setStore(updated);
    setNewName('');
    setNewRole('فرد من العائلة');
    setShowCreateForm(false);
    onSwitchProfile(created.id);
    onClose();
  };

  const startEdit = (profile: UserProfile) => {
    setEditingId(profile.id);
    setEditName(profile.name);
    setEditRole(profile.role);
    setEditColor(profile.avatarColor);
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = (profileId: string) => {
    if (!editName.trim()) return;
    const updated = updateUserProfileDetails(profileId, {
      name: editName,
      role: editRole,
      avatarColor: editColor,
    });
    setStore(updated);
    setEditingId(null);
    flashNotice('تم تحديث بيانات الملف بنجاح.');
  };

  const handleDelete = (profileId: string) => {
    const target = store.profiles.find((p) => p.id === profileId);
    const updated = deleteUserProfile(profileId);
    setStore(updated);
    setConfirmDeleteId(null);
    if (target) {
      flashNotice(`تم حذف ملف «${target.name}» من هذا الجهاز.`);
    }
    onSwitchProfile(updated.activeProfileId);
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profiles-modal-title"
    >
      <div
        className="w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-right my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-l from-emerald-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600/20 border border-emerald-500/35 text-emerald-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="profiles-modal-title"
                className="text-lg sm:text-xl font-bold text-white font-quran truncate"
              >
                ملفات العائلة والمستخدمين
              </h2>
              <p className="text-xs text-slate-400 truncate">
                يُحفظ تقدم الحفظ والتجويد والأذكار وتفضيلات القراء لكل فرد بشكل مستقل
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            aria-label="إغلاق نافذة الملفات"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {statusNotice && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs font-semibold">
              {statusNotice}
            </div>
          )}

          {/* Add New Family Profile Toggle / Form */}
          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>إضافة ملف مستخدم جديد للعائلة</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateSubmit}
              className="p-4 rounded-2xl bg-slate-950/85 border border-emerald-500/35 space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-emerald-300">إنشاء ملف جديد</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer px-2 py-1"
                >
                  إلغاء
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    اسم المستخدم
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="مثال: عبدالله، سارة، الوالدة..."
                    maxLength={32}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    الصفة في العائلة
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px] cursor-pointer"
                  >
                    {ROLE_PRESETS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 block">لون الملف</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewColor(c.id)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                        newColor === c.id
                          ? 'bg-slate-800 border-white text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${c.dotClass}`} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyDisplayPrefs}
                  onChange={(e) => setCopyDisplayPrefs(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-500 cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  نسخ تفضيلات القراء وأزرار الشاشة الرئيسية فقط (يبدأ الحفظ والتجويد والأذكار من الصفر بشكل مستقل دائماً)
                </span>
              </label>

              <button
                type="submit"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>إنشاء الملف والتبديل إليه</span>
              </button>
            </form>
          )}

          {/* Profiles List */}
          <div className="space-y-3">
            {store.profiles.map((profile) => {
              const isActive = profile.id === store.activeProfileId;
              const colors = getProfileColorClasses(profile.avatarColor);
              const stats = getProfileProgressSummary(profile, isActive);
              const isEditing = editingId === profile.id;
              const isConfirmingDelete = confirmDeleteId === profile.id;

              return (
                <div
                  key={profile.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-colors space-y-3 ${
                    isActive
                      ? 'bg-emerald-950/25 border-emerald-500/60'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="اسم المستخدم"
                          maxLength={32}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm min-h-[42px]"
                        />
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm min-h-[42px]"
                        >
                          {ROLE_PRESETS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {COLOR_OPTIONS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setEditColor(c.id)}
                              className={`w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center ${c.dotClass} ${
                                editColor === c.id ? 'border-white scale-110' : 'border-transparent opacity-70'
                              }`}
                              title={c.label}
                              aria-label={c.label}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(profile.id)}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                          >
                            حفظ
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-2xl ${colors.bg} text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-md`}
                          >
                            {getProfileInitial(profile.name)}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                                {profile.name}
                              </h3>
                              <span className="text-[11px] text-slate-400">
                                · {profile.role}
                              </span>
                              {isActive && (
                                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                  <span>نشط الآن</span>
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-400 tabular-nums leading-relaxed">
                              سور محفوظة: {stats.memorizedSurahsCount} · تجويد: {stats.tajweedSavedCount} · مراجعة: {stats.spacedCardsCount} · علامات: {stats.bookmarksCount}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => {
                                onSwitchProfile(profile.id);
                                onClose();
                              }}
                              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                            >
                              دخول للملف
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => startEdit(profile)}
                            className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                            title="تعديل بيانات الملف"
                            aria-label={`تعديل ${profile.name}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {store.profiles.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteId(isConfirmingDelete ? null : profile.id)
                              }
                              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 flex items-center justify-center cursor-pointer"
                              title="حذف الملف"
                              aria-label={`حذف ${profile.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isConfirmingDelete && (
                        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <span className="text-rose-200 font-semibold">
                            هل تريد حذف ملف «{profile.name}» وكل تقدمه المحفوظ؟
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold cursor-pointer"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(profile.id)}
                              className="min-h-[36px] px-3 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                            >
                              نعم، حذف
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400 tabular-nums">
            إجمالي الملفات على هذا الجهاز: {store.profiles.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
