export const NAV_PREFERENCES_KEY = 'murtal_nav_preferences';
export const NAV_PREFERENCES_EVENT = 'murtal-nav-preferences-changed';

export interface NavPreferences {
  visibleMainButtons: string[];
  featuredButtonId: string | null;
  showQuickBarOnMobile: boolean;
}

export interface NavSectionMeta {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  group: 'quran' | 'adhkar' | 'tools';
}

export const NAV_SECTIONS: NavSectionMeta[] = [
  {
    id: 'mushaf',
    label: 'المصحف الشريف',
    shortLabel: 'المصحف',
    description: 'تصفح القرآن الكريم كاملاً 114 سورة',
    group: 'quran',
  },
  {
    id: 'coach',
    label: 'مُعلم التجويد الذكي',
    shortLabel: 'المعلم الذكي',
    description: 'متابعة وتنبيه فوري لأخطاء القراءة',
    group: 'quran',
  },
  {
    id: 'quiz',
    label: 'اختبارات الحفظ',
    shortLabel: 'الاختبارات',
    description: 'اختبارات الحفظ والربط بين الآيات',
    group: 'quran',
  },
  {
    id: 'spaced',
    label: 'التكرار المتباعد',
    shortLabel: 'المراجعة',
    description: 'تثبيت الحفظ بجدولة علمية ذكية',
    group: 'quran',
  },
  {
    id: 'guide',
    label: 'دليلك للتجويد',
    shortLabel: 'التجويد',
    description: 'أحكام النون، الميم، القلقلة، والمدود',
    group: 'quran',
  },
  {
    id: 'adhkar',
    label: 'الأذكار اليومية',
    shortLabel: 'الأذكار',
    description: 'أذكار الصباح والمساء والورد اليومي',
    group: 'adhkar',
  },
  {
    id: 'hisn',
    label: 'حصن المسلم',
    shortLabel: 'حصن المسلم',
    description: 'أذكار وأدعية الكتاب والسنة لليوم والليلة',
    group: 'adhkar',
  },
  {
    id: 'jazariyyah',
    label: 'متن الجزرية',
    shortLabel: 'الجزرية',
    description: 'المقدمة الجزرية في مخارج الحروف والصفات',
    group: 'adhkar',
  },
  {
    id: 'shatibiyyah',
    label: 'متن الشاطبية',
    shortLabel: 'الشاطبية',
    description: 'حرز الأماني ورموز القراء السبعة ورواتهم',
    group: 'adhkar',
  },
  {
    id: 'dashboard',
    label: 'لوحة الإنجاز',
    shortLabel: 'الإنجاز',
    description: 'متابعة الإنجاز اليومي والإحصائيات',
    group: 'tools',
  },
  {
    id: 'backup',
    label: 'النسخة الاحتياطية',
    shortLabel: 'أوفلاين',
    description: 'تصدير، استعادة، وتنزيل التلاوات بدون إنترنت',
    group: 'tools',
  },
];

const VALID_SECTION_IDS = new Set(NAV_SECTIONS.map((s) => s.id));

export const DEFAULT_NAV_PREFERENCES: NavPreferences = {
  visibleMainButtons: ['mushaf', 'adhkar', 'hisn'],
  featuredButtonId: 'coach',
  showQuickBarOnMobile: true,
};

function sanitizePrefs(raw: Partial<NavPreferences> | null | undefined): NavPreferences {
  const visible = Array.isArray(raw?.visibleMainButtons)
    ? Array.from(
        new Set(raw.visibleMainButtons.filter((id): id is string => typeof id === 'string' && VALID_SECTION_IDS.has(id)))
      )
    : [...DEFAULT_NAV_PREFERENCES.visibleMainButtons];

  const featured =
    raw?.featuredButtonId === null
      ? null
      : typeof raw?.featuredButtonId === 'string' && VALID_SECTION_IDS.has(raw.featuredButtonId)
      ? raw.featuredButtonId
      : DEFAULT_NAV_PREFERENCES.featuredButtonId;

  const showQuickBarOnMobile =
    typeof raw?.showQuickBarOnMobile === 'boolean'
      ? raw.showQuickBarOnMobile
      : DEFAULT_NAV_PREFERENCES.showQuickBarOnMobile;

  return {
    visibleMainButtons: visible,
    featuredButtonId: featured,
    showQuickBarOnMobile,
  };
}

export function getNavPreferences(): NavPreferences {
  try {
    const raw = localStorage.getItem(NAV_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_NAV_PREFERENCES };
    return sanitizePrefs(JSON.parse(raw) as Partial<NavPreferences>);
  } catch {
    return { ...DEFAULT_NAV_PREFERENCES };
  }
}

export function saveNavPreferences(next: NavPreferences): NavPreferences {
  const normalized = sanitizePrefs(next);
  try {
    localStorage.setItem(NAV_PREFERENCES_KEY, JSON.stringify(normalized));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NAV_PREFERENCES_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function toggleMainButtonVisibility(sectionId: string): NavPreferences {
  const current = getNavPreferences();
  if (!VALID_SECTION_IDS.has(sectionId)) return current;
  const exists = current.visibleMainButtons.includes(sectionId);
  const nextVisible = exists
    ? current.visibleMainButtons.filter((id) => id !== sectionId)
    : [...current.visibleMainButtons, sectionId];

  return saveNavPreferences({
    ...current,
    visibleMainButtons: nextVisible,
    // Automatically reveal mobile bar when adding a button if it was empty
    showQuickBarOnMobile: !exists ? true : current.showQuickBarOnMobile,
  });
}

export function setFeaturedMainButton(sectionId: string | null): NavPreferences {
  const current = getNavPreferences();
  const validId = sectionId && VALID_SECTION_IDS.has(sectionId) ? sectionId : null;
  return saveNavPreferences({
    ...current,
    featuredButtonId: validId,
  });
}

export function setMobileQuickBarVisible(visible: boolean): NavPreferences {
  const current = getNavPreferences();
  return saveNavPreferences({
    ...current,
    showQuickBarOnMobile: visible,
  });
}

export function applyMainButtonsPreset(
  preset: 'minimal' | 'default' | 'all'
): NavPreferences {
  const current = getNavPreferences();
  if (preset === 'minimal') {
    return saveNavPreferences({
      visibleMainButtons: [],
      featuredButtonId: current.featuredButtonId,
      showQuickBarOnMobile: false,
    });
  }
  if (preset === 'all') {
    return saveNavPreferences({
      visibleMainButtons: NAV_SECTIONS.map((s) => s.id),
      featuredButtonId: current.featuredButtonId,
      showQuickBarOnMobile: true,
    });
  }
  return saveNavPreferences({ ...DEFAULT_NAV_PREFERENCES });
}
