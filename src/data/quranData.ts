import fullQuranData from './quran_full.json';

export interface Ayah {
  number: number;
  globalNumber?: number;
  text: string;
  translation: string;
  audioKey?: string;
}

export interface Surah {
  number: number;
  name: string;
  originalName?: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
  juz: number;
  ayahs: Ayah[];
}

export interface Reciter {
  id: string;
  name: string;
  style: string;
  identifier: string;
  subfolder: string;
}

export const RECITERS: Reciter[] = [
  { id: 'afasy', name: 'الشيخ مشاري راشد العفاسي', style: 'تلاوة ندية مرتلة', identifier: 'Alafasy_128kbps', subfolder: 'ar.alafasy' },
  { id: 'saadalghamdi', name: 'الشيخ سعد الغامدي', style: 'قراءة هادئة مطمئنة', identifier: 'Ghamadi_40kbps', subfolder: 'ar.saadalghamdi' },
  { id: 'mahermuaiqly', name: 'الشيخ ماهر المعيقلي', style: 'إمام الحرم المكي الشريف', identifier: 'MaherAlMuaiqly128kbps', subfolder: 'ar.mahermuaiqly' },
  { id: 'minshawi', name: 'الشيخ محمد صديق المنشاوي', style: 'مجوّد (معلم)', identifier: 'Minshawy_Murattal_128kbps', subfolder: 'ar.minshawi' },
  { id: 'husary', name: 'الشيخ محمود خليل الحصري', style: 'مرتل (حفص عن عاصم)', identifier: 'Husary_128kbps', subfolder: 'ar.husary' },
  { id: 'sudais', name: 'الشيخ عبد الرحمن السديس', style: 'إمام الحرم المكي', identifier: 'Abdurrahmaan_As-Sudais_192kbps', subfolder: 'ar.abdurrahmaansudais' },
  { id: 'shuraym', name: 'الشيخ سعود الشريم', style: 'إمام الحرم المكي', identifier: 'Saood_ash-Shuraym_128kbps', subfolder: 'ar.saoodshuraym' },
  { id: 'hudhaify', name: 'الشيخ علي الحذيفي', style: 'إمام الحرم النبوي الشريف', identifier: 'Hudhaify_128kbps', subfolder: 'ar.hudhaify' },
  { id: 'abdulbasit', name: 'الشيخ عبد الباسط عبد الصمد', style: 'ترتيل عذب متقن', identifier: 'Abdul_Basit_Murattal_192kbps', subfolder: 'ar.abdulbasitmurattal' },
  { id: 'dosari', name: 'الشيخ ياسر الدوسري', style: 'تلاوة خاشعة مؤثرة', identifier: 'Yasser_Ad-Dussary_128kbps', subfolder: 'ar.yasseraldossari' },
  { id: 'qatami', name: 'الشيخ ناصر القطامي', style: 'تلاوة ندية خاشعة', identifier: 'Nasser_Alqatami_128kbps', subfolder: 'ar.nasseralqatami' },
  { id: 'ajamy', name: 'الشيخ أحمد العجمي', style: 'تلاوة مؤثرة خاشعة', identifier: 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net', subfolder: 'ar.ahmedajamy' },
  { id: 'shaatree', name: 'الشيخ أبو بكر الشاطري', style: 'ترتيل هادئ متقن', identifier: 'Abu_Bakr_Ash-Shaatree_128kbps', subfolder: 'ar.shaatree' },
  { id: 'ayyoub', name: 'الشيخ محمد أيوب', style: 'تلاوة حجازية مؤثرة', identifier: 'Muhammad_Ayyoub_128kbps', subfolder: 'ar.muhammadayyoub' },
];

export function getReciterAyahAudioUrl(
  reciterIdentifierOrId: string,
  surahNumber: number,
  ayahNumber: number
): string {
  const reciter =
    RECITERS.find((r) => r.identifier === reciterIdentifierOrId || r.id === reciterIdentifierOrId) ||
    RECITERS[0];
  const sss = String(surahNumber).padStart(3, '0');
  const uuu = String(ayahNumber).padStart(3, '0');
  return `https://everyayah.com/data/${reciter.identifier}/${sss}${uuu}.mp3`;
}

export function getReciterBasmalahAudioUrl(reciterIdentifierOrId: string): string {
  return getReciterAyahAudioUrl(reciterIdentifierOrId, 1, 1);
}

export function getAyahDisplayText(surahNumber: number, ayahNumber: number, rawText: string): string {
  if (surahNumber > 1 && surahNumber !== 9 && ayahNumber === 1) {
    // Strip prepended Basmalah from Ayah 1 in Surahs 2..114 since it's displayed in the royal Basmalah header block
    return rawText.replace(/^[﻿\s]*بِسْمِ\s*ٱللَّهِ\s*ٱلرَّحْمَٰنِ\s*ٱلرَّحِيمِ\s*/, '').trim();
  }
  return rawText.replace(/^[﻿\s]*/, '').trim();
}

export const QURAN_SURAHS: Surah[] = fullQuranData as unknown as Surah[];

export const TAJWEED_RULES_EXPLAINED = [
  {
    name: "الإخفاء (Ikhfa)",
    color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    description: "نطق النون الساكنة او التنوين بحالة بين الإظهار والإدغام بلا تشديد مع بقاء الغنة في الخيشوم."
  },
  {
    name: "الإدغام (Idgham)",
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    description: "إدخال حرف ساكن في حرف متحرك بحيث يصيران حرفاً واحداً مشدداً كالنجم (بغنة مع حروف ينمو، وبغير غنة مع اللام والراء)."
  },
  {
    name: "القلاب (Iqlab)",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    description: "قلب النون الساكنة أو التنوين ميماً مخفاة بغنة كاملة عند ملاقاة حرف الباء."
  },
  {
    name: "القلقلة (Qalqalah)",
    color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    description: "اضطراب الصوت عند النطق بالحرف الساكن من حروف (قطب جد) حتى يُسمع له نبرة قوية واضحة."
  },
  {
    name: "المد الطبيعي والفرعي (Madd)",
    color: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    description: "إطالة الصوت بأحد حروف المد (الألف، الواو، الياء) حركتين للمد الطبيعي، أو 4-6 حركات للمدود الفرعية كالمنفصل والمتصل واللازم."
  },
  {
    name: "أحكام الميم الساكنة",
    color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    description: "الإخفاء الشفوي عند الباء، الإدغام الصغير عند الميم، والإظهار الشفوي عند باقي الحروف الهجائية."
  }
];
