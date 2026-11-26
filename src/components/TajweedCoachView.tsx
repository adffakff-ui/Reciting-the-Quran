import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Mic, Square, Sparkles, AlertCircle, CheckCircle2, Volume2, RefreshCw, 
  Award, ArrowRight, Play, Pause, VolumeX, ShieldAlert, ChevronLeft, 
  ChevronRight, Bookmark, RotateCcw, HelpCircle, Eye, Headphones, 
  Radio, Layers, BookOpen, Clock, Waves, UserCheck, Check, Send
} from 'lucide-react';
import { 
  QURAN_SURAHS, RECITERS, Reciter, Surah, Ayah, 
  getReciterAyahAudioUrl, getReciterBasmalahAudioUrl, getAyahDisplayText 
} from '../data/quranData';
import { resolvePlayableAudioSrc } from '../utils/offlineStorage';
import confetti from 'canvas-confetti';

interface TajweedCoachViewProps {
  initialSurahName?: string;
  initialAyahText?: string;
  initialAyahNumber?: number;
  bookmarks?: string[];
  onToggleBookmark?: (ayahKey: string) => void;
}

// Arabic normalization helper for speech comparison
function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u06D6-\u06ED\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()﴿﴾[\]0-9]/g, '')
    .trim()
    .toLowerCase();
}

// Gentle Web Audio API sound alerts
function playAudioChime(type: 'correct' | 'mistake' | 'finish') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'mistake') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'finish') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

// In-context Tajweed rules analyzer for the verse
interface DetectedRule {
  name: string;
  category: string;
  color: string;
  tip: string;
}

function detectVerseTajweedRules(text: string): DetectedRule[] {
  const rules: DetectedRule[] = [];
  const qalqalahRegex = /[قطبجد]/;
  if (qalqalahRegex.test(text)) {
    rules.push({
      name: 'القلقلة',
      category: 'مخارج وصفات',
      color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      tip: 'توجد حروف القلقلة (ق، ط، ب، ج، د). احرص على اضطراب الصوت وسماعه بنبرة واضحة ومميزة عند سكون الحرف.'
    });
  }

  if (/[ًٌٍ]/.test(text) || text.includes('ن') || text.includes('من') || text.includes('عن')) {
    rules.push({
      name: 'النون والتنوين',
      category: 'أحكام التجويد',
      color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      tip: 'انتبه لأحكام النون والتنوين: الإظهار، الإدغام، الإقلاب، أو الإخفاء. اضبط زمن الغنة حركتين دون استعجال.'
    });
  }

  if (/[\u06E4~]/.test(text) || text.includes('آ') || /[\u0627\u0648\u064A]/.test(text)) {
    rules.push({
      name: 'أحكام المدود',
      category: 'أزمنة الحروف',
      color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      tip: 'حافظ على مقدار المد الطبيعي (حركتان)، والمد المتصل أو المنفصل (4-5 حركات)، والمد اللازم (6 حركات كاملة).'
    });
  }

  if (/[\u0645\u0646]ّ/.test(text) || text.includes('مّ') || text.includes('نّ')) {
    rules.push({
      name: 'الغنة المشددة',
      category: 'صفات الحروف',
      color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      tip: 'في النون والميم المشددتين، أخرج الغنة رخيمة من الخيشوم بمقدار حركتين كاملتين.'
    });
  }

  if (text.includes('ٱللَّهِ') || text.includes('ٱللَّهَ') || text.includes('ر')) {
    rules.push({
      name: 'التفخيم والترقيق',
      category: 'مخارج الحروف',
      color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      tip: 'فخّم لام لفظ الجلالة بعد الفتح والضم ورققها بعد الكسر، واضبط تفخيم الراء المفتوحة والمضمومة.'
    });
  }

  return rules;
}

export const TajweedCoachView: React.FC<TajweedCoachViewProps> = ({
  initialSurahName = 'الفاتحة',
  initialAyahText,
  initialAyahNumber,
  bookmarks = [],
  onToggleBookmark,
}) => {
  // Navigation & Surah State
  const [selectedSurahName, setSelectedSurahName] = useState(initialSurahName);
  const selectedSurah = QURAN_SURAHS.find(s => s.name === selectedSurahName) || QURAN_SURAHS[0];
  const [selectedAyahNumber, setSelectedAyahNumber] = useState<number>(initialAyahNumber !== undefined ? initialAyahNumber : 1);
  const [activeMode, setActiveMode] = useState<'liveTest' | 'audioRecording'>('liveTest');

  // Selected Reciter (Sheikh) for model audio
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(() => {
    try {
      const saved = localStorage.getItem('mushaf_reciter');
      return RECITERS.find(r => r.identifier === saved) || RECITERS[0];
    } catch {
      return RECITERS[0];
    }
  });

  // Calculate verse text based on selectedAyahNumber
  const isBasmalahSelected = selectedAyahNumber === 0;

  const rawAyahText = useMemo(() => {
    if (isBasmalahSelected) {
      return 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    }
    const a = selectedSurah.ayahs.find(item => item.number === selectedAyahNumber);
    if (!a) return initialAyahText || selectedSurah.ayahs[0]?.text || 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    return getAyahDisplayText(selectedSurah.number, a.number, a.text);
  }, [selectedSurah, selectedAyahNumber, isBasmalahSelected, initialAyahText]);

  // Words list
  const words = useMemo(() => {
    return rawAyahText.split(/\s+/).filter(w => w.trim().length > 0);
  }, [rawAyahText]);

  // Detected Tajweed Rules for this verse
  const verseRules = useMemo(() => {
    return detectVerseTajweedRules(rawAyahText);
  }, [rawAyahText]);

  // Live Test States
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [wordStatuses, setWordStatuses] = useState<('pending' | 'current' | 'correct' | 'mistake')[]>([]);
  const [liveAlert, setLiveAlert] = useState<{
    type: 'error' | 'success' | 'info';
    message: string;
    expectedWord?: string;
    spokenWord?: string;
  } | null>(null);
  const [mistakesHistory, setMistakesHistory] = useState<Array<{ expected: string; spoken: string; time: string }>>([]);
  const [isTestFinished, setIsTestFinished] = useState(false);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(true);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [liveTimer, setLiveTimer] = useState(0);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);

  // Model Recitation Audio States
  const [isPlayingModelAudio, setIsPlayingModelAudio] = useState(false);

  // AI Analysis States
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    score: number;
    accuracy: string;
    mistakes: Array<{ rule: string; description: string; correction: string }>;
    feedback: string;
    encouragement: string;
  } | null>(null);

  // Toast / notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Refs
  const recognitionRef = useRef<any>(null);
  const modelAudioRef = useRef<HTMLAudioElement | null>(null);
  const modelRevokeRef = useRef<(() => void) | null>(null);
  const recordedAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const recordIntervalRef = useRef<any>(null);
  const currentWordIndexRef = useRef<number>(0);
  currentWordIndexRef.current = currentWordIndex;

  // Sync props when user selects an Ayah from Mushaf
  useEffect(() => {
    if (initialSurahName) {
      setSelectedSurahName(initialSurahName);
      if (initialAyahNumber !== undefined) {
        setSelectedAyahNumber(initialAyahNumber);
      } else {
        const s = QURAN_SURAHS.find(sur => sur.name === initialSurahName);
        if (s && initialAyahText) {
          const found = s.ayahs.find(a => a.text === initialAyahText || a.text.includes(initialAyahText));
          if (found) setSelectedAyahNumber(found.number);
        }
      }
    }
  }, [initialSurahName, initialAyahText, initialAyahNumber]);

  // Reset states when Surah or Ayah changes
  useEffect(() => {
    resetAllStates();
  }, [selectedSurahName, selectedAyahNumber]);

  // Handle live test timer
  useEffect(() => {
    if (isLiveListening) {
      timerIntervalRef.current = setInterval(() => {
        setLiveTimer(t => t + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isLiveListening]);

  // Handle recording timer
  useEffect(() => {
    if (isRecording) {
      recordIntervalRef.current = setInterval(() => {
        setRecordTimer(t => t + 1);
      }, 1000);
    } else {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, [isRecording]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const resetAllStates = () => {
    stopLiveListening();
    stopAudioRecording();
    stopModelRecitation();
    setCurrentWordIndex(0);
    setWordStatuses(words.map((_, i) => (i === 0 ? 'current' : 'pending')));
    setLiveAlert(null);
    setMistakesHistory([]);
    setIsTestFinished(false);
    setSpokenTranscript('');
    setLiveTimer(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioBase64(null);
    setRecordTimer(0);
    setAudioLevel(0);
    setIsPlayingRecorded(false);
    setAnalysisResult(null);
  };

  // 1. Live Listening (Web Speech Recognition)
  const startLiveListening = () => {
    stopModelRecitation();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setLiveAlert({
        type: 'info',
        message: 'متصفحك لا يدعم التعرف الصوتي المباشر. يمكنك استخدام أزرار التحقق التفاعلية أو وضع التسجيل الصوتي بالأسفل.'
      });
      setIsLiveListening(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        setIsLiveListening(true);
        setLiveAlert({
          type: 'info',
          message: 'الميكروفون يعمل.. ابدأ التلاوة الآن بتمهل وترتيل خاشع'
        });
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += chunk + ' ';
          } else {
            interimTranscript += chunk;
          }
        }

        const fullChunk = (finalTranscript + interimTranscript).trim();
        setSpokenTranscript(fullChunk);

        if (fullChunk.length > 0) {
          const spokenWords = fullChunk.split(/\s+/).filter(Boolean);
          const latestSpoken = spokenWords[spokenWords.length - 1];
          handleLiveSpokenWord(latestSpoken);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setLiveAlert({
            type: 'error',
            message: 'تم رفض إذن استخدام الميكروفون. يرجى السماح به في إعدادات المتصفح للاستفادة من المعلم الذكي.'
          });
          setIsLiveListening(false);
        }
      };

      recognition.onend = () => {
        if (isLiveListening && !isTestFinished) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (e) {
      console.warn('Speech recognition start failed:', e);
      setIsLiveListening(true);
    }
  };

  const stopLiveListening = () => {
    setIsLiveListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  };

  const handleLiveSpokenWord = (spoken: string) => {
    const idx = currentWordIndexRef.current;
    if (idx >= words.length) return;

    const expected = words[idx];
    const normSpoken = normalizeArabic(spoken);
    const normExpected = normalizeArabic(expected);

    if (normSpoken === normExpected || normSpoken.includes(normExpected) || normExpected.includes(normSpoken)) {
      setWordStatuses(prev => {
        const next = [...prev];
        next[idx] = 'correct';
        if (idx + 1 < words.length) next[idx + 1] = 'current';
        return next;
      });

      if (soundAlertsEnabled) playAudioChime('correct');

      setLiveAlert({
        type: 'success',
        message: `أحسنت! نطقت كلمة "${expected}" بشكل صحيح.`
      });

      const nextIdx = idx + 1;
      setCurrentWordIndex(nextIdx);

      if (nextIdx >= words.length) {
        finishLiveTest();
      }
    } else {
      if (spoken.length >= 2) {
        setWordStatuses(prev => {
          const next = [...prev];
          next[idx] = 'mistake';
          return next;
        });

        if (soundAlertsEnabled) playAudioChime('mistake');

        setLiveAlert({
          type: 'error',
          message: `تنبيه خطأ: نطقت "${spoken}" والمطلوب هو "${expected}". استمع لنطقها وأعد المحاولة.`,
          expectedWord: expected,
          spokenWord: spoken,
        });

        setMistakesHistory(prev => [
          ...prev,
          { expected, spoken, time: `${liveTimer} ثانية` }
        ]);
      }
    }
  };

  const handleManualWordValidate = (isCorrect: boolean) => {
    const idx = currentWordIndex;
    if (idx >= words.length) return;

    const expected = words[idx];
    if (isCorrect) {
      setWordStatuses(prev => {
        const next = [...prev];
        next[idx] = 'correct';
        if (idx + 1 < words.length) next[idx + 1] = 'current';
        return next;
      });
      if (soundAlertsEnabled) playAudioChime('correct');
      setLiveAlert({ type: 'success', message: `تم تأكيد قراءة "${expected}" بنجاح!` });
      const nextIdx = idx + 1;
      setCurrentWordIndex(nextIdx);
      if (nextIdx >= words.length) finishLiveTest();
    } else {
      setWordStatuses(prev => {
        const next = [...prev];
        next[idx] = 'mistake';
        return next;
      });
      if (soundAlertsEnabled) playAudioChime('mistake');
      setLiveAlert({
        type: 'error',
        message: `تنبيه خطأ: تعثر في كلمة "${expected}". تدرب عليها وأعد المحاولة.`,
        expectedWord: expected,
        spokenWord: 'تعثر في النطق'
      });
      setMistakesHistory(prev => [
        ...prev,
        { expected, spoken: 'تعثر في القراءة', time: `${liveTimer} ثانية` }
      ]);
    }
  };

  const finishLiveTest = () => {
    stopLiveListening();
    setIsTestFinished(true);
    if (soundAlertsEnabled) playAudioChime('finish');
    confetti({
      particleCount: 140,
      spread: 85,
      origin: { y: 0.6 }
    });
    requestAIReport();
  };

  // 2. Audio Recording (MediaRecorder + Waveform Analyzer)
  const startAudioRecording = async () => {
    stopModelRecitation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Audio Analyzer for live visualizer
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // MediaRecorder
      audioChunksRef.current = [];
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) options.mimeType = 'audio/webm';
      else if (MediaRecorder.isTypeSupported('audio/mp4')) options.mimeType = 'audio/mp4';

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1];
          setAudioBase64(base64);
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordTimer(0);
      setLiveAlert({
        type: 'info',
        message: 'جاري تسجيل صوتك الآن.. اقرأ الآية بتمهل وترتيل خاشع'
      });
    } catch (e: any) {
      console.error('Microphone recording error:', e);
      setLiveAlert({
        type: 'error',
        message: 'تعذر الوصول للميكروفون. يرجى التأكد من منحه الإذن في المتصفح.'
      });
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);
  };

  const togglePlayRecordedAudio = () => {
    if (!audioUrl) return;
    if (isPlayingRecorded) {
      if (recordedAudioPlayerRef.current) {
        recordedAudioPlayerRef.current.pause();
        recordedAudioPlayerRef.current = null;
      }
      setIsPlayingRecorded(false);
    } else {
      stopModelRecitation();
      const audio = new Audio(audioUrl);
      recordedAudioPlayerRef.current = audio;
      setIsPlayingRecorded(true);
      audio.onended = () => setIsPlayingRecorded(false);
      audio.onerror = () => setIsPlayingRecorded(false);
      audio.play().catch(() => setIsPlayingRecorded(false));
    }
  };

  // 3. AI Post-Recitation Evaluation Report
  const requestAIReport = async () => {
    const buildLocalReport = () => {
      const calcScore = Math.max(78, 100 - mistakesHistory.length * 6);
      return {
        score: calcScore,
        accuracy: mistakesHistory.length === 0 ? 'إتقان استثنائي وممتاز' : 'جيد جداً مع بعض الملاحظات',
        mistakes: mistakesHistory.map(m => ({
          rule: 'مخارج الحروف والضبط الصوتي',
          description: `لوحظ تعثر عند قراءة كلمة (${m.expected}).`,
          correction: `أعد نطق الكلمة بترتيل مع إعطاء كل حرف حقه من المخرج والصفة.`
        })),
        feedback: 'صوت مبارك ومحاولة طيبة في الترتيل. استمع للنموذج المرتل للشيخ المعلم وحاكِ أدائه.',
        encouragement: 'ثابر على هذا الترتيل المتقن، جعل الله القرآن العظيم ربيع قلبك!'
      };
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAnalysisResult(buildLocalReport());
      setLoadingAnalysis(false);
      return;
    }

    setLoadingAnalysis(true);
    try {
      const payload: any = {
        recitationText: spokenTranscript || 'تلاوة مباشرة للآية الكريمة',
        expectedAyah: rawAyahText,
        surahName: selectedSurah.name,
      };

      if (audioBase64) {
        payload.audioData = audioBase64;
        payload.audioMimeType = audioBlob?.type || 'audio/webm';
      }

      const res = await fetch('/api/ai/tajweed-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('API unavailable');
      const data = await res.json();
      setAnalysisResult(data);
    } catch {
      setAnalysisResult(buildLocalReport());
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // 4. Model Recitation Audio (Supports 14 Sheikhs + Ayah 0 Basmalah)
  const stopModelRecitation = () => {
    if (modelAudioRef.current) {
      modelAudioRef.current.pause();
      modelAudioRef.current = null;
    }
    if (modelRevokeRef.current) {
      modelRevokeRef.current();
      modelRevokeRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingModelAudio(false);
  };

  const handlePlayModelRecitation = () => {
    if (isPlayingModelAudio) {
      stopModelRecitation();
      return;
    }

    setIsPlayingModelAudio(true);

    const speakFallback = () => {
      const u = new SpeechSynthesisUtterance(rawAyahText);
      u.lang = 'ar-SA';
      u.rate = 0.82;
      u.onend = () => setIsPlayingModelAudio(false);
      u.onerror = () => setIsPlayingModelAudio(false);
      window.speechSynthesis.speak(u);
    };

    const targetUrl = isBasmalahSelected
      ? getReciterBasmalahAudioUrl(selectedReciter.identifier)
      : getReciterAyahAudioUrl(selectedReciter.identifier, selectedSurah.number, selectedAyahNumber);

    resolvePlayableAudioSrc(targetUrl)
      .then(({ src, revoke }) => {
        if (revoke) modelRevokeRef.current = revoke;
        const audio = new Audio(src);
        modelAudioRef.current = audio;
        audio.onended = () => {
          modelRevokeRef.current?.();
          modelRevokeRef.current = null;
          setIsPlayingModelAudio(false);
        };
        audio.onerror = speakFallback;
        audio.play().catch(speakFallback);
      })
      .catch(speakFallback);
  };

  // Pronounce a single word
  const handlePronounceWord = (word: string) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'ar-SA';
    u.rate = 0.72;
    window.speechSynthesis.speak(u);
  };

  // Add to Spaced Repetition cards
  const handleAddToSpacedCards = () => {
    try {
      const saved = localStorage.getItem('hifz_spaced_cards');
      const cards = saved ? JSON.parse(saved) : [];
      const cardId = `card_${selectedSurah.number}_${selectedAyahNumber}_${Date.now()}`;
      const newCard = {
        id: cardId,
        surahName: selectedSurah.name,
        ayahNumber: selectedAyahNumber,
        ayahText: rawAyahText,
        repetitions: 0,
        interval: 1,
        nextReview: new Date().toISOString(),
        easeFactor: 2.5
      };
      cards.push(newCard);
      localStorage.setItem('hifz_spaced_cards', JSON.stringify(cards));
      showToast('تمت إضافة الآية لبطاقات التكرار المتباعد بنجاح!');
    } catch {
      showToast('تعذر الحفظ في بطاقات التكرار المتباعد.');
    }
  };

  // Navigation handlers
  const handleNextAyah = () => {
    if (isBasmalahSelected) {
      setSelectedAyahNumber(1);
    } else if (selectedAyahNumber < selectedSurah.numberOfAyahs) {
      setSelectedAyahNumber(selectedAyahNumber + 1);
    } else {
      const nextSurah = QURAN_SURAHS.find(s => s.number === selectedSurah.number + 1);
      if (nextSurah) {
        setSelectedSurahName(nextSurah.name);
        setSelectedAyahNumber(1);
      }
    }
  };

  const handlePrevAyah = () => {
    if (selectedAyahNumber > 1) {
      setSelectedAyahNumber(selectedAyahNumber - 1);
    } else if (selectedAyahNumber === 1 && selectedSurah.number !== 1 && selectedSurah.number !== 9) {
      setSelectedAyahNumber(0); // Move to Basmalah
    }
  };

  const correctCount = wordStatuses.filter(s => s === 'correct').length;
  const progressPercent = Math.round((correctCount / Math.max(1, words.length)) * 100);
  const ayahBookmarkKey = `${selectedSurah.number}:${selectedAyahNumber}`;
  const isCurrentAyahBookmarked = bookmarks.includes(ayahBookmarkKey);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 animate-fadeIn w-full overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-2xl animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="absolute top-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 sm:space-y-3 z-10 text-center md:text-right max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>المعلم الذكي ومساعد التجويد اللحظي</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-white font-quran">
            اختبار التلاوة والتصحيح اللحظي
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            اقرأ أو سجّل صوتك أمام المعلم الذكي؛ ليتم رصد مخارج الحروف وأحكام التجويد كلمةً بكلمة مع التنبيه الفوري بالأخطاء ومقارنة تلاوتك بكبار القراء.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10">
          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl shrink-0">
            <Mic className="w-7 h-7 sm:w-10 sm:h-10 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Surah, Ayah & Reciter Selector Bar */}
      <div className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-center">
          {/* Surah Select */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-semibold block">السورة الكريمة:</label>
            <select
              value={selectedSurahName}
              onChange={(e) => {
                setSelectedSurahName(e.target.value);
                setSelectedAyahNumber(1);
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[42px] cursor-pointer"
            >
              {QURAN_SURAHS.map((s) => (
                <option key={s.number} value={s.name}>
                  {s.number}. سورة {s.name} ({s.numberOfAyahs} آية)
                </option>
              ))}
            </select>
          </div>

          {/* Ayah Select */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-semibold block">رقم الآية:</label>
            <div className="flex items-center gap-1 w-full">
              <button
                onClick={handlePrevAyah}
                disabled={selectedAyahNumber <= 1 && (selectedSurah.number === 1 || selectedSurah.number === 9 || selectedAyahNumber === 0)}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 transition-colors min-h-[42px] min-w-[42px] flex items-center justify-center shrink-0 cursor-pointer"
                title="الآية السابقة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <select
                value={selectedAyahNumber}
                onChange={(e) => setSelectedAyahNumber(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[42px] cursor-pointer"
              >
                {selectedSurah.number !== 9 && selectedSurah.number !== 1 && (
                  <option value={0}>البسملة المباركة (مفتتح السورة)</option>
                )}
                {Array.from({ length: selectedSurah.numberOfAyahs }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>الآية {num}</option>
                ))}
              </select>
              <button
                onClick={handleNextAyah}
                disabled={selectedAyahNumber >= selectedSurah.numberOfAyahs}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 transition-colors min-h-[42px] min-w-[42px] flex items-center justify-center shrink-0 cursor-pointer"
                title="الآية التالية"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sheikh (Reciter) Model Select */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-semibold block">القارئ المعلم (النموذج):</label>
            <select
              value={selectedReciter.identifier}
              onChange={(e) => {
                const rec = RECITERS.find(r => r.identifier === e.target.value);
                if (rec) setSelectedReciter(rec);
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[42px] cursor-pointer"
            >
              {RECITERS.map((r) => (
                <option key={r.id} value={r.identifier}>
                  {r.name} ({r.style})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Toolbar & Secondary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveMode('liveTest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMode === 'liveTest'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>مصحح القراءة اللحظي</span>
            </button>
            <button
              onClick={() => setActiveMode('audioRecording')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMode === 'audioRecording'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Waves className="w-3.5 h-3.5" />
              <span>تسجيل وتحليل صوتي</span>
            </button>
          </div>

          {/* Audio Chime, Model Recitation & Bookmarking Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundAlertsEnabled(!soundAlertsEnabled)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all min-h-[38px] cursor-pointer ${
                soundAlertsEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="تفعيل أو كتم التنبيه الصوتي عند الخطأ"
            >
              {soundAlertsEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">أصوات التنبيه</span>
            </button>

            <button
              onClick={handlePlayModelRecitation}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600/20 border border-teal-500/30 text-teal-300 text-xs font-bold hover:bg-teal-600/30 transition-colors min-h-[38px] cursor-pointer"
              title="استمع لتلاوة نموذجية متقنة للآية بصوت الشيخ المختار"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>{isPlayingModelAudio ? 'إيقاف التلاوة' : 'تلاوة الشيخ'}</span>
            </button>

            {onToggleBookmark && (
              <button
                onClick={() => onToggleBookmark(ayahBookmarkKey)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
                  isCurrentAyahBookmarked
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="حفظ الآية في المفضلة"
              >
                <Bookmark className="w-4 h-4 fill-current" />
              </button>
            )}

            <button
              onClick={handleAddToSpacedCards}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
              title="إضافة لبطاقات التكرار المتباعد لتثبيت الحفظ"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Alert Banner */}
      {liveAlert && (
        <div
          className={`p-4 rounded-2xl border transition-all animate-fadeIn flex items-center justify-between gap-4 ${
            liveAlert.type === 'error'
              ? 'bg-rose-950/60 border-rose-500/50 text-rose-200 shadow-lg shadow-rose-950/40'
              : liveAlert.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200 shadow-lg shadow-emerald-950/40'
              : 'bg-slate-850 border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {liveAlert.type === 'error' ? (
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 animate-bounce" />
            ) : liveAlert.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <Sparkles className="w-6 h-6 text-teal-400 shrink-0" />
            )}
            <div>
              <p className="text-xs sm:text-sm font-bold">{liveAlert.message}</p>
              {liveAlert.expectedWord && (
                <p className="text-xs text-slate-300 mt-0.5">
                  الكلمة المستهدفة: <span className="font-quran text-emerald-300 text-sm font-bold px-1.5 py-0.5 bg-slate-900/60 rounded">{liveAlert.expectedWord}</span>
                </p>
              )}
            </div>
          </div>

          {liveAlert.expectedWord && (
            <button
              onClick={() => handlePronounceWord(liveAlert.expectedWord!)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-emerald-300 hover:text-white flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>استمع لنطقها</span>
            </button>
          )}
        </div>
      )}

      {/* Main Recitation Arena */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 sm:space-y-8 relative overflow-hidden">
        {/* Live Progress Bar (in liveTest mode) */}
        {activeMode === 'liveTest' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span>نسبة إنجاز الآية:</span>
                <span className="font-bold text-white text-sm">{progressPercent}%</span>
              </span>
              <div className="flex items-center gap-3 text-slate-400 text-[11px] sm:text-xs">
                <span>الأخطاء: <strong className="text-rose-400">{mistakesHistory.length}</strong></span>
                <span>الوقت: <strong className="text-slate-200">{liveTimer} ث</strong></span>
              </div>
            </div>
            <div className="w-full h-2.5 sm:h-3 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Word-by-word Quranic Text Display with Real-time Status */}
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-950/70 border border-emerald-500/20 text-center space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-3">
            <span className="font-bold text-emerald-400 font-quran text-sm">
              {isBasmalahSelected ? 'البسملة المباركة' : `سورة ${selectedSurah.name} • الآية (${selectedAyahNumber})`}
            </span>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>صحيح</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block mr-2"></span>
              <span>الحالية</span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block mr-2"></span>
              <span>تنبيه</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 dir-rtl py-2" dir="rtl">
            {words.map((word, idx) => {
              const status = wordStatuses[idx] || (idx === currentWordIndex ? 'current' : 'pending');
              const isCurrent = idx === currentWordIndex && isLiveListening && !isTestFinished;

              let style = 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700';

              if (status === 'correct') {
                style = 'bg-emerald-600/25 border-emerald-500/70 text-emerald-200 shadow-md shadow-emerald-950/50';
              } else if (status === 'mistake') {
                style = 'bg-rose-600/30 border-rose-500 text-rose-200 animate-pulse shadow-md shadow-rose-950/50';
              } else if (isCurrent) {
                style = 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/50 scale-105';
              }

              return (
                <div
                  key={idx}
                  onClick={() => handlePronounceWord(word)}
                  className={`relative cursor-pointer group px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border font-quran text-xl sm:text-3xl font-bold transition-all duration-200 flex items-center justify-center gap-1.5 min-h-[44px] ${style}`}
                  title="اضغط للاستماع لنطق هذه الكلمة"
                >
                  <span>{word}</span>
                  {status === 'correct' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  {status === 'mistake' && (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  {isCurrent && (
                    <span className="absolute -top-2.5 px-1.5 py-0.2 rounded bg-amber-500 text-[9px] text-slate-950 font-sans font-bold shadow">
                      اقرأ
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
            اضغط على أي كلمة في الآية للاستماع لنطقها السليم قبل أو أثناء التلاوة.
          </p>
        </div>

        {/* Active In-Context Tajweed Rules for this verse */}
        {verseRules.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>أحكام التجويد ومخارج الحروف البارزة في هذه الآية:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {verseRules.map((rule, idx) => (
                <div key={idx} className={`p-2.5 rounded-xl border ${rule.color} space-y-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{rule.name}</span>
                    <span className="text-[10px] opacity-75">{rule.category}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{rule.tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mode 1 Controls: Live Speech Recognition */}
        {activeMode === 'liveTest' && (
          <div className="flex flex-col items-center justify-center gap-4 w-full">
            {!isLiveListening && !isTestFinished ? (
              <button
                onClick={startLiveListening}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-sm sm:text-lg shadow-xl shadow-emerald-950/60 hover:scale-105 active:scale-95 transition-all group cursor-pointer min-h-[48px]"
              >
                <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>بدء اختبار القراءة المباشر</span>
              </button>
            ) : isLiveListening ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <button
                  onClick={stopLiveListening}
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-rose-600 text-white font-bold text-sm sm:text-lg shadow-xl shadow-rose-950/60 animate-pulse hover:bg-rose-500 active:scale-95 transition-all cursor-pointer min-h-[48px]"
                >
                  <Square className="w-5 h-5" />
                  <span>إيقاف اختبار القراءة</span>
                </button>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 text-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>جاري التعرف على كلماتك ومقارنتها بالآية الكريمة لحظياً...</span>
                </div>
              </div>
            ) : (
              /* Finished state */
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4 w-full">
                <button
                  onClick={resetAllStates}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold hover:bg-slate-700 transition-colors min-h-[44px] cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة قراءة الآية</span>
                </button>
                <button
                  onClick={handleNextAyah}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-lg shadow-emerald-950/40 hover:from-emerald-500 hover:to-teal-500 transition-all min-h-[44px] cursor-pointer"
                >
                  <span>الانتقال للآية التالية</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Interactive Manual Buttons */}
            <div className="flex items-center justify-center gap-2 pt-1 text-xs flex-wrap w-full">
              <span className="text-slate-400 w-full sm:w-auto text-center sm:text-right">أو النقر للتأكيد اليدوي:</span>
              <button
                onClick={() => handleManualWordValidate(true)}
                disabled={isTestFinished}
                className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 font-semibold hover:bg-emerald-900/60 disabled:opacity-40 transition-colors cursor-pointer min-h-[38px] text-center"
              >
                + كلمة صحيحة
              </button>
              <button
                onClick={() => handleManualWordValidate(false)}
                disabled={isTestFinished}
                className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 font-semibold hover:bg-rose-900/60 disabled:opacity-40 transition-colors cursor-pointer min-h-[38px] text-center"
              >
                - كلمة خاطئة (تنبيه)
              </button>
            </div>
          </div>
        )}

        {/* Mode 2 Controls: Voice Recording & Waveform Analyzer */}
        {activeMode === 'audioRecording' && (
          <div className="flex flex-col items-center justify-center gap-5 w-full bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
            {/* Audio Wave Visualizer */}
            {isRecording && (
              <div className="flex items-center justify-center gap-1.5 h-12 w-full max-w-xs">
                {Array.from({ length: 12 }).map((_, i) => {
                  const factor = ((i % 4) + 1) * 0.25;
                  const height = Math.max(8, Math.min(48, Math.round(audioLevel * factor * 0.5)));
                  return (
                    <span
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-emerald-500 to-teal-300 rounded-full transition-all duration-75"
                      style={{ height: `${height}px` }}
                    ></span>
                  );
                })}
              </div>
            )}

            {/* Recording Controls */}
            {!isRecording ? (
              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                <button
                  onClick={startAudioRecording}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-xl shadow-emerald-950/50 hover:scale-105 transition-all cursor-pointer min-h-[46px]"
                >
                  <Mic className="w-5 h-5" />
                  <span>بدء تسجيل تلاوتك للآية</span>
                </button>

                {audioUrl && (
                  <button
                    onClick={togglePlayRecordedAudio}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-sm border border-emerald-500/30 transition-all cursor-pointer min-h-[46px]"
                  >
                    {isPlayingRecorded ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlayingRecorded ? 'إيقاف التسجيل' : 'استمع لتسجيلك الصوتي'}</span>
                  </button>
                )}

                {audioUrl && (
                  <button
                    onClick={requestAIReport}
                    disabled={loadingAnalysis}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-lg shadow-teal-950/40 transition-all cursor-pointer min-h-[46px] disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>تحليل التسجيل بالذكاء الاصطناعي</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-rose-400 text-sm font-bold animate-pulse">
                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                  <span>جاري التسجيل: {String(Math.floor(recordTimer / 60)).padStart(2, '0')}:{String(recordTimer % 60).padStart(2, '0')}</span>
                </div>
                <button
                  onClick={stopAudioRecording}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 text-white font-bold text-sm shadow-xl shadow-rose-950/50 animate-pulse hover:bg-rose-500 cursor-pointer min-h-[46px]"
                >
                  <Square className="w-5 h-5" />
                  <span>إنهاء التسجيل واعتماده</span>
                </button>
              </div>
            )}

            {/* Audio Comparison Banner if recorded */}
            {audioUrl && !isRecording && (
              <div className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-300">
                  تم تسجيل <strong className="text-emerald-400 font-quran">{rawAyahText.slice(0, 30)}...</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlayRecordedAudio}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 font-semibold"
                  >
                    {isPlayingRecorded ? 'إيقاف صوتك' : 'صوتك أنت'}
                  </button>
                  <button
                    onClick={handlePlayModelRecitation}
                    className="px-3 py-1.5 rounded-lg bg-teal-600/20 text-teal-300 border border-teal-500/30 hover:bg-teal-600/30 font-semibold"
                  >
                    {isPlayingModelAudio ? 'إيقاف الشيخ' : `صوت ${selectedReciter.name.split(' ')[1] || 'الشيخ'}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Post-Test Analysis Report */}
      {(isTestFinished || analysisResult || loadingAnalysis) && (
        <div className="p-6 sm:p-10 rounded-3xl bg-slate-900 border border-emerald-500/40 space-y-6 shadow-2xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 text-2xl font-bold font-quran">
                {analysisResult ? `${analysisResult.score}%` : `${progressPercent}%`}
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white font-quran">تقرير الإتقان والتجويد الذكي</h3>
                <p className="text-sm text-emerald-400">
                  {analysisResult?.accuracy || 'تم إنهاء اختبار الآية بنجاح'}
                </p>
              </div>
            </div>
            <button
              onClick={requestAIReport}
              disabled={loadingAnalysis}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAnalysis ? 'animate-spin' : ''}`} />
              <span>{loadingAnalysis ? 'جاري التحليل المعمق...' : 'إعادة توليد التقرير'}</span>
            </button>
          </div>

          {loadingAnalysis ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-sm text-slate-300 font-medium">جاري فحص مخارج الحروف وأحكام التجويد للآية عبر الذكاء الاصطناعي...</p>
            </div>
          ) : analysisResult ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Feedback */}
              <div className="p-6 rounded-2xl bg-slate-850 border border-slate-800 space-y-4">
                <h4 className="font-bold text-emerald-400 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  <span>ملاحظات الأداء والترتيل</span>
                </h4>
                <p className="text-slate-300 text-sm leading-relaxed">{analysisResult.feedback}</p>
                
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-sm font-semibold flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{analysisResult.encouragement}</span>
                </div>
              </div>

              {/* Mistakes & Corrections */}
              <div className="p-6 rounded-2xl bg-slate-850 border border-slate-800 space-y-4">
                <h4 className="font-bold text-amber-400 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>تنبيهات ومخارج الحروف والتجويد</span>
                </h4>
                
                {analysisResult.mistakes && analysisResult.mistakes.length > 0 ? (
                  <div className="space-y-3">
                    {analysisResult.mistakes.map((m, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                        <span className="text-xs font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          {m.rule}
                        </span>
                        <p className="text-xs text-slate-300 mt-1">{m.description}</p>
                        <p className="text-xs text-emerald-400 font-semibold">التصحيح السليم: {m.correction}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">أحكام التجويد ومخارج الحروف سليمة تماماً ومتقنة، تبارك الرحمن!</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
