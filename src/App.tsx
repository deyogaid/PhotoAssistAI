/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ChangeEvent, MouseEvent } from 'react';
import { 
  Camera, 
  Users, 
  Palette, 
  Wind, 
  Sparkles, 
  Copy, 
  Download, 
  Check, 
  RefreshCw,
  Layout,
  ChevronRight,
  Image as ImageIcon,
  Zap,
  UploadCloud,
  X,
  History,
  LogOut,
  LogIn,
  Maximize,
  Trash2,
  Settings,
  Lock,
  ExternalLink,
  ShieldCheck,
  ArrowLeft,
  User as UserIcon,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PromptInput, GenerationResult, PhotoType } from './types';
import { AIProviderName } from './ai/types';
import { aiRouter } from './ai/router';
import { 
  PRESETS, 
  PHOTO_TYPES, 
  STYLE_OPTIONS, 
  CONDITION_OPTIONS, 
  ASPECT_RATIO_OPTIONS 
} from './constants';
import { generateSmartPrompt, generateImageFromPrompt, analyzeImage, generatePhotoGuidance } from './services/gemini';
import { auth, db } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  
  const [input, setInput] = useState<PromptInput>({
    photoType: 'portrait',
    subjectCount: 1,
    outfitColor: '',
    conditions: [],
    targetStyle: 'studio-minimalist',
    intensity: 50,
    aspectRatio: '1:1',
    relationship_context: '',
  });

  const [showStyleGallery, setShowStyleGallery] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [openFormSections, setOpenFormSections] = useState<string[]>(['type', 'ratio']);
  const [openResultSections, setOpenResultSections] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showDownloadToast, setShowDownloadToast] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [userPresets, setUserPresets] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [refinementFeedback, setRefinementFeedback] = useState('');
  const [refining, setRefining] = useState(false);

  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftDirection, setDraftDirection] = useState('');
  const [preparingPrompt, setPreparingPrompt] = useState(false);

  const [userApiKeys, setUserApiKeys] = useState<Partial<Record<AIProviderName, string>>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const savedKeys = localStorage.getItem('photoassist_api_keys');
    if (savedKeys) {
      try {
        const parsed = JSON.parse(savedKeys);
        setUserApiKeys(parsed);
        aiRouter.updateUserKeys(parsed);
      } catch (e) {
        console.error("Failed to load keys", e);
      }
    }
  }, []);

  const saveApiKeys = (keys: Partial<Record<AIProviderName, string>>) => {
    setUserApiKeys(keys);
    localStorage.setItem('photoassist_api_keys', JSON.stringify(keys));
    aiRouter.updateUserKeys(keys);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setUserPresets([]);
      return;
    }

    // Generations listener
    const qGen = query(
      collection(db, 'generations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubGen = onSnapshot(qGen, (snapshot) => {
      const docs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as any[];
      
      const formatted = docs.map(d => ({
        id: d.id,
        ...d.result,
        input: d.input,
        createdAt: d.createdAt
      }));
      
      setHistory(formatted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'generations');
    });

    // User Presets listener
    const qPresets = query(
      collection(db, 'user_presets'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubPresets = onSnapshot(qPresets, (snapshot) => {
      const docs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setUserPresets(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'user_presets');
    });

    return () => {
      unsubGen();
      unsubPresets();
    }
  }, [user]);

  const login = async () => {
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setUser(result.user);
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      if (error.code === 'auth/popup-blocked') {
        alert("Pop-up diblokir oleh browser. Mohon izinkan pop-up untuk login dengan Google.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Just silent
      } else {
        alert("Gagal masuk: " + (error.message || "Terjadi kesalahan tidak dikenal"));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => signOut(auth);

  const downloadImage = async (base64Data: string, fileName: string) => {
    setDownloading(true);
    
    // Brief delay to simulate HD processing/packaging
    await new Promise(resolve => setTimeout(resolve, 800));

    const link = document.createElement('a');
    link.href = base64Data;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setDownloading(false);
    setShowDownloadToast(true);
    setTimeout(() => setShowDownloadToast(false), 3000);
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setUploadedImage(base64);
      setAnalyzing(true);
      
      try {
        const analysis = await analyzeImage(base64);
        setInput(prev => {
          const mergedConditions = Array.from(new Set([
            ...prev.conditions, 
            ...(analysis.conditions || [])
          ]));
          return {
            ...prev,
            ...analysis,
            conditions: mergedConditions
          };
        });
        
        // Auto-trigger prompt preparation for better efficiency/lazy-user support
        if (base64) {
          // Wrap in a timeout to ensure state has updated
          setTimeout(() => {
            handlePreparePrompt();
          }, 500);
        }
      } catch (error: any) {
        console.error("Analysis failed", error);
        if (error.message === "QUOTA_EXHAUSTED") {
          alert("Batas penggunaan gratis (quota) Anda telah habis. Mohon tunggu beberapa saat, atau gunakan 'GPT Auth' di menu atas untuk menghubungkan akun privat Anda.");
        } else {
          alert("Gagal menganalisa gambar. Pastikan format benar.");
        }
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const createThumbnail = (base64: string, maxWidth = 400): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = base64;
    });
  };

  const handlePreparePrompt = async () => {
    if (!user) {
      alert("Silahkan login untuk melanjutkan.");
      return;
    }

    setPreparingPrompt(true);
    try {
      const gInput = { ...input, subjectCount: input.subjectCount || 1 };
      const { prompt, creativeDirection } = await generateSmartPrompt(gInput, uploadedImage);
      setDraftPrompt(prompt);
      setDraftDirection(creativeDirection);
    } catch (error: any) {
      console.error("Prompt preparation failed", error);
      if (error.message === "QUOTA_EXHAUSTED") {
        alert("Batas penggunaan gratis (quota) Anda telah habis. Mohon tunggu beberapa saat, atau gunakan 'GPT Auth' di menu atas untuk menghubungkan akun privat Anda.");
      } else {
        alert("Gagal menyiapkan prompt. Coba lagi.");
      }
    } finally {
      setPreparingPrompt(false);
    }
  };

  const handleGenerate = async () => {
    if (!user) {
      alert("Silahkan login untuk menyimpan history.");
      return;
    }

    if (!draftPrompt) {
      await handlePreparePrompt();
      return;
    }

    setLoading(true);
    setRefinementFeedback('');
    try {
      const gInput = { ...input, subjectCount: input.subjectCount || 1 };
      const imageUrl = await generateImageFromPrompt(draftPrompt, input.aspectRatio, uploadedImage);
      
      const res: GenerationResult = {
        prompt: draftPrompt,
        creativeDirection: draftDirection,
        imageUrl,
        input: gInput
      };
      
      setResult(res);

      try {
        // Create a smaller thumbnail specifically for database history
        let historyImageUrl = '';
        if (res.imageUrl) {
          try {
            historyImageUrl = await createThumbnail(res.imageUrl);
          } catch (thumbErr) {
            console.error("Thumbnail failed", thumbErr);
          }
        }

        await addDoc(collection(db, 'generations'), {
          userId: user.uid,
          input: gInput,
          result: {
            ...res,
            imageUrl: historyImageUrl // Store ONLY the thumbnail in DB
          },
          createdAt: serverTimestamp()
        });

        // Auto-save as preset
        const comboExists = [
          ...PRESETS.map(p => p.config), 
          ...userPresets.map(up => up.config)
        ].some(c => 
          c.photoType === gInput.photoType && 
          c.targetStyle === gInput.targetStyle && 
          c.intensity === gInput.intensity
        );

        if (!comboExists) {
          const styleLabel = STYLE_OPTIONS.find(s => s.value === gInput.targetStyle)?.label || 'Custom';
          await addDoc(collection(db, 'user_presets'), {
            userId: user.uid,
            name: `Preset ${styleLabel}`,
            config: {
              photoType: gInput.photoType,
              targetStyle: gInput.targetStyle,
              intensity: gInput.intensity
            },
            createdAt: serverTimestamp()
          });
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, 'generations');
      }

    } catch (error: any) {
      if (error.message === "QUOTA_EXHAUSTED") {
        alert("Batas penggunaan gratis (quota) Anda telah habis. Mohon tunggu beberapa saat, atau gunakan 'GPT Auth' di menu atas untuk menghubungkan akun privat Anda.");
      } else {
        alert("Terjadi kesalahan saat generate image. Mohon coba lagi.");
      }
    } finally {
      setLoading(false);
      setDraftPrompt(''); // Clear draft after successful generation
      setDraftDirection('');
    }
  };

  const handleRefine = async () => {
    if (!result || !refinementFeedback.trim()) return;
    
    setRefining(true);
    try {
      const res = await generatePhotoGuidance(
        input, 
        uploadedImage, 
        result, 
        refinementFeedback
      );
      setResult(res);
      setRefinementFeedback('');

      // Save refined result to history as well
      try {
        let historyImageUrl = '';
        if (res.imageUrl) {
          try {
            historyImageUrl = await createThumbnail(res.imageUrl);
          } catch (thumbErr) {
            console.error("Thumbnail failed", thumbErr);
          }
        }
        await addDoc(collection(db, 'generations'), {
          userId: user?.uid,
          input: input,
          result: {
            ...res,
            imageUrl: historyImageUrl
          },
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.error("Failed to save refined result", e);
      }
    } catch (error: any) {
      if (error.message === "QUOTA_EXHAUSTED") {
        alert("Batas penggunaan gratis (quota) Anda telah habis. Mohon tunggu beberapa saat, atau gunakan 'GPT Auth' di menu atas untuk menghubungkan akun privat Anda.");
      } else {
        alert("Gagal memperbarui hasil.");
      }
    } finally {
      setRefining(false);
    }
  };

  const deleteGeneration = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'generations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `generations/${id}`);
    }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setInput(prev => ({
      ...prev,
      ...preset.config,
    }));
  };

  const toggleFormSection = (id: string) => {
    setOpenFormSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleCondition = (val: string) => {
    setInput(prev => ({
      ...prev,
      conditions: prev.conditions.includes(val)
        ? prev.conditions.filter(c => c !== val)
        : [...prev.conditions, val]
    }));
  };

  const toggleResultSection = (id: string) => {
    setOpenResultSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Background decorative elements */}
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-100/50 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-2xl shadow-emerald-100/50 border border-slate-100 p-8 relative z-10 text-center"
        >
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-200 rotate-12 mb-8">
            <Sparkles size={40} />
          </div>
          
          <a 
            href="https://ais-pre-sww3kxvzp6zypusf5kxk52-517328850702.asia-southeast1.run.app"
            className="text-3xl font-bold tracking-tight text-slate-900 mb-2 hover:opacity-80 transition-opacity"
          >
            PhotoAssist<span className="text-emerald-600">AI</span>
          </a>
          <p className="text-slate-500 text-sm leading-relaxed mb-10">
            Masuk ke ruang kerja pribadi Anda. Semua riwayat, preset, dan pengaturan API key disimpan secara aman untuk akun Anda sendiri.
          </p>

          <div className="space-y-4">
            <button 
              onClick={login}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 px-6 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <RefreshCw className="animate-spin" size={20} />
              ) : (
                <LogIn size={20} />
              )}
              <span>{isLoggingIn ? 'Menghubungkan...' : 'Masuk dengan Akun Google Pribadi'}</span>
            </button>
            
            <button 
              onClick={() => {
                // If they are on a deep link, this just resets to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-600 py-3 px-6 rounded-2xl font-medium hover:bg-slate-50 transition-all active:scale-[0.98]"
            >
              <ArrowLeft size={18} />
              <span>Kembali ke Atas</span>
            </button>

            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Secure Auth by Firebase
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl text-left border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-emerald-600 mb-2 shadow-sm">
                <Camera size={14} />
              </div>
              <p className="text-[11px] font-bold text-slate-800">Advanced Presets</p>
              <p className="text-[9px] text-slate-400 mt-1">Coretan sinematik siap pakai.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl text-left border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-emerald-600 mb-2 shadow-sm">
                <Zap size={14} />
              </div>
              <p className="text-[11px] font-bold text-slate-800">AI Analysis</p>
              <p className="text-[9px] text-slate-400 mt-1">Deteksi masalah secara real-time.</p>
            </div>
          </div>
        </motion.div>

        <footer className="mt-8 text-[11px] text-slate-400 font-medium">
          PhotoAssistAI © 2024 • Powered by Gemini Pro Vision
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 transition-transform hover:scale-105">
              <Sparkles size={18} className="sm:w-5 sm:h-5" />
            </div>
            <a 
              href="https://ais-pre-sww3kxvzp6zypusf5kxk52-517328850702.asia-southeast1.run.app"
              className="font-bold text-lg sm:text-xl tracking-tight text-slate-800 hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              PhotoAssist<span className="text-emerald-600">AI</span>
            </a>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {user && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Sesi Aktif</span>
              </div>
            )}
            <button 
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all border border-transparent active:border-slate-200"
              title="AI Settings"
            >
              <ShieldCheck size={18} className={Object.values(userApiKeys).some(v => !!v) ? 'text-emerald-600' : 'text-slate-400'} />
              <span className="hidden md:inline">GPT Auth</span>
            </button>
            <div className="hidden sm:block h-6 w-px bg-slate-200" />
            {user ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    showHistory ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <History size={16} />
                  <span className="hidden sm:inline">Library</span>
                </button>
                <div className="hidden sm:block h-6 w-px bg-slate-200" />
                <div className="flex items-center gap-2 sm:gap-3 group relative cursor-help">
                  <div className="flex flex-col items-end hidden md:flex">
                    <span className="text-[11px] font-bold text-slate-800 leading-none">{user.displayName}</span>
                    <span className="text-[9px] text-slate-400 mt-1">{user.email}</span>
                  </div>
                  <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-slate-200 shadow-sm" />
                  
                  {/* Tooltip for extra confirmation */}
                  <div className="absolute top-full right-0 mt-2 p-3 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[60] w-max max-w-[240px]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Sesi Akun Terdeteksi</p>
                        <p className="text-[10px] text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </div>

                  <button onClick={logout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors rounded-lg active:bg-rose-50" title="Logout">
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={login}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                <LogIn size={16} />
                <span>Masuk dengan Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 items-start">
          
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 space-y-8 relative">
              
              {/* Image Upload Area */}
              <section className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <UploadCloud size={14} />
                  Analisa Foto Mentah
                </label>
                
                <div className="relative group">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    id="file-upload"
                  />
                  {!uploadedImage ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 group-hover:border-emerald-400 group-hover:bg-emerald-50 transition-all">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:bg-white shadow-sm transition-all">
                        <ImageIcon size={24} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-700">Upload Foto Mentah</p>
                        <p className="text-[10px] text-slate-400 mt-1">AI akan mendeteksi subjek & lighting secara otomatis</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200">
                      <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setUploadedImage(null); }}
                          className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/40 transition-all"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      {analyzing && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                          <RefreshCw className="animate-spin text-emerald-600" size={32} />
                          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest animate-pulse">Menganalisa Foto...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Presets - Hidden by default */}
              <section className="space-y-3">
                <button 
                  onClick={() => setShowPresets(!showPresets)}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-emerald-600 transition-colors py-2"
                >
                  <div className="flex items-center gap-2">
                    <Layout size={14} />
                    <span>Quick Presets & Modes</span>
                  </div>
                  <ChevronRight size={14} className={`transform transition-transform ${showPresets ? 'rotate-90' : ''}`} />
                </button>
                
                <AnimatePresence>
                  {showPresets && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {PRESETS.map(p => (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            key={p.id}
                            onClick={() => { applyPreset(p); setShowPresets(false); }}
                            className={`p-3 text-left border rounded-xl transition-all group ${
                              input.targetStyle === p.config.targetStyle && input.photoType === p.config.photoType
                              ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                              : 'border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 bg-white text-slate-400'
                            }`}
                            id={`preset-${p.id}`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className={`font-semibold text-[11px] ${input.targetStyle === p.config.targetStyle && input.photoType === p.config.photoType ? 'text-emerald-700' : 'text-slate-700 group-hover:text-emerald-700'}`}>{p.name}</div>
                              {input.targetStyle === p.config.targetStyle && input.photoType === p.config.photoType && <Check size={10} className="text-emerald-600" />}
                            </div>
                            <div className="text-[9px] text-slate-400 leading-tight">{p.description}</div>
                          </motion.button>
                        ))}
                      </div>

                      {userPresets.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Custom Modes (Auto-Saved)</p>
                          <div className="grid grid-cols-2 gap-2">
                            {userPresets.map(up => (
                              <button
                                key={up.id}
                                onClick={() => { 
                                  setInput(prev => ({ ...prev, ...up.config }));
                                  setShowPresets(false);
                                }}
                                className="p-3 text-left border border-emerald-100 rounded-xl bg-emerald-50/20 hover:bg-emerald-50 transition-all group"
                              >
                                <div className="font-semibold text-[11px] text-emerald-800">{up.name}</div>
                                <div className="text-[9px] text-emerald-600/60 leading-tight mt-0.5">
                                  {up.config.photoType} • {up.config.intensity}%
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

               {/* Form Controls */}
              <div className="space-y-2">
                {/* Jenis Foto Section */}
                <div className="border-b border-slate-100 pb-2">
                <div 
                  onClick={() => toggleFormSection('type')}
                  className="w-full flex items-center justify-between py-3 group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleFormSection('type')}
                >
                  <div className="flex items-center gap-3 text-slate-700">
                    <div className={`p-1.5 rounded-lg transition-colors ${openFormSections.includes('type') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 group-hover:text-slate-600'}`}>
                      <Camera size={16} />
                    </div>
                    <span className="text-sm font-bold">Jenis Foto</span>
                  </div>
                  <ChevronRight size={16} className={`text-slate-300 transition-transform ${openFormSections.includes('type') ? 'rotate-90' : ''}`} />
                </div>
                  
                  <AnimatePresence>
                    {openFormSections.includes('type') && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-4 pt-1">
                          {PHOTO_TYPES.map(t => (
                            <button
                              key={t.value}
                              onClick={() => setInput({ ...input, photoType: t.value as PhotoType })}
                              className={`px-3 py-3 sm:py-2 text-[11px] font-bold rounded-xl border transition-all active:scale-[0.98] ${
                                input.photoType === t.value 
                                ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Aspect Ratio Section */}
                <div className="border-b border-slate-100 pb-2">
                <div 
                  onClick={() => toggleFormSection('ratio')}
                  className="w-full flex items-center justify-between py-3 group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleFormSection('ratio')}
                >
                  <div className="flex items-center gap-3 text-slate-700">
                    <div className={`p-1.5 rounded-lg transition-colors ${openFormSections.includes('ratio') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 group-hover:text-slate-600'}`}>
                      <Maximize size={16} />
                    </div>
                    <span className="text-sm font-bold">Aspect Ratio</span>
                  </div>
                  <ChevronRight size={16} className={`text-slate-300 transition-transform ${openFormSections.includes('ratio') ? 'rotate-90' : ''}`} />
                </div>
                  
                  <AnimatePresence>
                    {openFormSections.includes('ratio') && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-4 pt-1">
                          {ASPECT_RATIO_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setInput({ ...input, aspectRatio: opt.value as any })}
                              className={`py-3 sm:py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all border active:scale-[0.98] ${
                                input.aspectRatio === opt.value
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                              }`}
                              title={opt.description}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users size={18} />
                      <label className="text-sm font-semibold">Subjek</label>
                    </div>
                    <input 
                      type="number" 
                      min="1" 
                      max="20"
                      value={input.subjectCount || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInput({ ...input, subjectCount: val === '' ? 0 : parseInt(val) });
                      }}
                      className="w-full px-3 py-3 sm:py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                      id="input-subjects"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Palette size={18} />
                      <label className="text-sm font-semibold">Warna Outfit</label>
                    </div>
                    <input 
                      type="text" 
                      placeholder="e.g. Navy Blue"
                      value={input.outfitColor}
                      onChange={(e) => setInput({ ...input, outfitColor: e.target.value })}
                      className="w-full px-3 py-3 sm:py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                      id="input-outfit"
                    />
                  </div>
                </div>

                {input.subjectCount > 1 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 p-3 bg-emerald-50/20 border border-emerald-100 rounded-xl"
                  >
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Users size={14} />
                      <label className="text-[11px] font-bold uppercase tracking-tight">Konteks Hubungan Subjek</label>
                    </div>
                    <input 
                      type="text" 
                      placeholder="e.g. Romantic couple, family, professional"
                      value={input.relationship_context}
                      onChange={(e) => setInput({ ...input, relationship_context: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-emerald-900"
                    />
                    <p className="text-[9px] text-emerald-600/60 leading-tight italic">
                      AI mendeteksi hubungan antar subjek untuk emosi foto yang lebih akurat.
                    </p>
                  </motion.div>
                )}

                <div className="space-y-3 pb-2">
                  <div className="flex items-center gap-2 text-slate-700 py-3">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <Wind size={16} />
                    </div>
                    <label className="text-sm font-bold">Masalah di Foto Mentah</label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CONDITION_OPTIONS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => toggleCondition(c.value)}
                        className={`px-3 py-1.5 rounded-full text-[11px] border transition-all ${
                          input.conditions.includes(c.value)
                          ? 'bg-emerald-600 border-emerald-600 text-white font-semibold shadow-md'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-500'
                        }`}
                        id={`condition-${c.value}`}
                      >
                        {c.label}
                      </button>
                    ))}
                    
                    {/* Render Custom/AI Specific conditions that aren't in defaults */}
                    {input.conditions.filter(c => !CONDITION_OPTIONS.some(opt => opt.value === c)).map(customVal => (
                      <button
                        key={customVal}
                        onClick={() => toggleCondition(customVal)}
                        className="px-3 py-1.5 rounded-full text-[11px] border transition-all bg-emerald-600 border-emerald-600 text-white font-semibold shadow-md flex items-center gap-1"
                      >
                        {customVal}
                        <X size={10} />
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="Input masalah manual... (Tekan Enter)"
                      className="flex-1 px-3 py-3 sm:py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val && !input.conditions.includes(val)) {
                            setInput({ ...input, conditions: [...input.conditions, val] });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-700 py-3">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <Zap size={16} />
                    </div>
                    <label className="text-sm font-bold">Style Tujuan</label>
                  </div>
                  
                  <button
                    onClick={() => setShowStyleGallery(true)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-left flex items-center justify-between hover:border-emerald-300 hover:bg-emerald-50/30 transition-all group"
                    id="btn-open-styles"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center text-xl">
                        {STYLE_OPTIONS.find(s => s.value === input.targetStyle)?.icon || '🎨'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-700">
                          {STYLE_OPTIONS.find(s => s.value === input.targetStyle)?.label || 'Pilih Style'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">Klik untuk mengubah mood</div>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </button>
                </div>

                <div className="space-y-3 py-4">
                  <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                    <label>Intensitas Style</label>
                    <span className="text-emerald-600">{input.intensity}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={input.intensity}
                    onChange={(e) => setInput({ ...input, intensity: parseInt(e.target.value) })}
                    className="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                    id="slider-intensity"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                    <span>Subtle</span>
                    <span>Dramatic</span>
                  </div>
                </div>

                {/* Editable Smart Prompt Area */}
                <AnimatePresence>
                  {draftPrompt && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="space-y-3 pt-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                          <Zap size={12} className="animate-pulse" />
                          Review Smart Prompt
                        </label>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={handlePreparePrompt}
                            disabled={preparingPrompt || loading || analyzing}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md"
                            title="Terapkan perubahan pengaturan ke prompt"
                          >
                            <RefreshCw size={10} className={preparingPrompt ? 'animate-spin' : ''} />
                            Apply Settings
                          </button>
                          <button 
                            onClick={() => setDraftPrompt('')}
                            className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
                          >
                            <X size={10} />
                            Cancel
                          </button>
                        </div>
                      </div>
                      <textarea 
                        value={draftPrompt}
                        onChange={(e) => setDraftPrompt(e.target.value)}
                        className="w-full p-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl text-[11px] font-mono leading-relaxed text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[120px]"
                        placeholder="Edit prompt teknis Anda di sini..."
                        spellCheck={false}
                      />
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-[9px] text-slate-500 italic">
                          💡 Anda bisa menambahkan detail teknis pencahayaan atau lensa secara manual di atas untuk hasil yang lebih spesifik.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Primary Action Button */}
                <button
                  onClick={!draftPrompt ? handlePreparePrompt : handleGenerate}
                  disabled={loading || analyzing || preparingPrompt || (!uploadedImage && !draftPrompt)}
                  className={`w-full py-5 rounded-2xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-3 shadow-xl ${
                    loading || analyzing || preparingPrompt || (!uploadedImage && !draftPrompt)
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : draftPrompt 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                      : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200'
                  } hover:scale-[1.02] active:scale-[0.98]`}
                  id="btn-main-action"
                >
                  {loading || analyzing || preparingPrompt ? (
                    <>
                      <RefreshCw size={20} className="animate-spin" />
                      <span>{analyzing ? 'Menganalisa Foto...' : preparingPrompt ? 'Menyiapkan Smart Prompt...' : 'Sedang Generate...'}</span>
                    </>
                  ) : (
                    <>
                      {!uploadedImage && !draftPrompt ? (
                        <>
                          <ImageIcon size={20} />
                          <span>Upload Foto Dahulu</span>
                        </>
                      ) : !draftPrompt ? (
                        <>
                          <Zap size={20} />
                          <span>Siapkan Smart Prompt</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={20} />
                          <span>Generate Masterpiece</span>
                        </>
                      )}
                    </>
                  )}
                </button>
                
                {draftPrompt && !loading && (
                   <button 
                    onClick={handlePreparePrompt}
                    className="w-full py-2 text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                   >
                     <RefreshCw size={12} />
                     Regenerate AI Suggestion
                   </button>
                )}

                <p className="text-center text-slate-400 text-[10px] px-6">
                  Tip: Hasil terbaik didapat dengan mengisi masalah foto mentah selengkap mungkin.
                </p>
              </div>
            </div>
          </div>

          {/* Main Output Area */}
          <div className="lg:col-span-8 space-y-6">
            {/* User Session Info Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                  <UserIcon size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Ruang Kerja Aktif</p>
                  <p className="text-sm font-semibold text-slate-700">{user?.displayName || user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg shadow-sm">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-tight">Sesi Terautentikasi</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {showHistory ? (
                <motion.div 
                  key="history"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800">Library History Anda</h2>
                    <button onClick={() => setShowHistory(false)} className="text-xs font-bold text-emerald-600 hover:underline">Balik ke Generator</button>
                  </div>
                  
                  {history.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto">
                        <History size={32} />
                      </div>
                      <p className="text-slate-500">Belum ada history generasi.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {history.map((h) => (
                        <div 
                          key={h.id} 
                          onClick={() => { 
                            setResult(h); 
                            if (h.input) setInput(h.input);
                            setShowHistory(false); 
                          }}
                          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-slate-100 flex items-center justify-center">
                            {h.imageUrl ? (
                              <img src={h.imageUrl} alt="History" className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center gap-1 opacity-20">
                                <ImageIcon size={24} />
                                <span className="text-[8px] font-bold uppercase tracking-widest">No Preview</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                              {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleDateString() : 'Baru saja'}
                            </p>
                            <p className="text-sm font-semibold text-slate-700 line-clamp-2">{h.prompt}</p>
                          </div>
                          <button 
                            onClick={(e) => deleteGeneration(h.id!, e)}
                            className="absolute top-6 right-6 p-2 bg-white/20 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : result ? (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Image Preview Card */}
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
                        <ImageIcon size={14} />
                        <span>Visual Mood Direction</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-200" />
                        <div className="w-2 h-2 rounded-full bg-slate-200" />
                        <div className="w-2 h-2 rounded-full bg-slate-200" />
                      </div>
                    </div>
                    <div className="aspect-square bg-white relative group">
                      {result.imageUrl ? (
                        <>
                          <img 
                            src={result.imageUrl} 
                            alt="AI Reference Mood" 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute bottom-4 right-4 z-20">
                            <button 
                              onClick={() => downloadImage(result.imageUrl!, `photoassist-${Date.now()}.png`)}
                              disabled={downloading}
                              className={`px-4 py-2 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 transform transition-all active:scale-95 ${
                                downloading ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                              id="btn-download-image"
                            >
                              {downloading ? (
                                <RefreshCw className="animate-spin" size={14} />
                              ) : (
                                <Download size={14} />
                              )}
                              <span>{downloading ? 'Processing...' : 'Download HD'}</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                          <ImageIcon size={48} className="opacity-20" />
                          <span className="text-sm">Preview sedang diproses...</span>
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                   {/* Prompt Card */}
                  <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-200/60 overflow-hidden">
                    <div className="p-6 space-y-4">
                      {/* Smart Output (Technical Prompt) Accordion */}
                      <div className="border-b border-slate-100 pb-4">
                        <div 
                          onClick={() => toggleResultSection('prompt')}
                          className="w-full flex items-center justify-between py-2 group cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && toggleResultSection('prompt')}
                        >
                          <div className="flex items-center gap-3 text-emerald-600">
                             <div className={`p-1.5 rounded-lg transition-colors ${openResultSections.includes('prompt') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 group-hover:text-slate-600'}`}>
                              <Zap size={16} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Smart Prompt Output</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  copyToClipboard(result.prompt);
                                  window.open('https://chatgpt.com', '_blank');
                                }}
                                className="p-2 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors relative group/gpt"
                                title="Open in ChatGPT"
                              >
                                <MessageSquare size={16} />
                                <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover/gpt:opacity-100 whitespace-nowrap pointer-events-none">Copy & Open ChatGPT</span>
                              </button>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  copyToClipboard(result.prompt);
                                  window.open('https://gemini.google.com', '_blank');
                                }}
                                className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors relative group/gemini"
                                title="Open in Gemini"
                              >
                                <ImageIcon size={16} />
                                <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover/gemini:opacity-100 whitespace-nowrap pointer-events-none">Copy & Open Gemini (Visual)</span>
                              </button>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(result.prompt); }}
                              className="p-3 sm:p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors relative group/copy active:bg-slate-100"
                              title="Copy Prompt"
                            >
                              {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                            </button>
                            <ChevronRight size={16} className={`text-slate-300 transition-transform ${openResultSections.includes('prompt') ? 'rotate-90' : ''}`} />
                          </div>
                        </div>
                        
                        <AnimatePresence>
                          {openResultSections.includes('prompt') && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100/80 font-mono text-sm leading-relaxed text-slate-700 select-all">
                                {result.prompt}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Director's Note Accordion */}
                      <div className="border-b border-slate-100 pb-4 pt-2">
                        <div 
                          onClick={() => toggleResultSection('guidance')}
                          className="w-full flex items-center justify-between py-2 group cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && toggleResultSection('guidance')}
                        >
                          <div className="flex items-center gap-3 text-slate-400">
                            <div className={`p-1.5 rounded-lg transition-colors ${openResultSections.includes('guidance') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 group-hover:text-slate-600'}`}>
                              <Sparkles size={16} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Director's Notes</span>
                          </div>
                          <ChevronRight size={16} className={`text-slate-300 transition-transform ${openResultSections.includes('guidance') ? 'rotate-90' : ''}`} />
                        </div>

                        <AnimatePresence>
                          {openResultSections.includes('guidance') && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 p-5 bg-emerald-50/30 rounded-2xl border border-emerald-100/50">
                                <div className="flex gap-3">
                                  <p className="text-sm text-slate-700 leading-relaxed italic">
                                    "{result.creativeDirection}"
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Refinement UI */}
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Punya feedback? Sempurnakan hasil:</label>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                          <input 
                            type="text"
                            placeholder="Contoh: 'Buat lighting lebih warm'..."
                            value={refinementFeedback}
                            onChange={(e) => setRefinementFeedback(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                            className="flex-1 px-4 py-3.5 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            disabled={refining}
                          />
                          <button
                            onClick={handleRefine}
                            disabled={refining || !refinementFeedback.trim()}
                            className="w-full sm:w-auto px-6 py-3.5 sm:py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                          >
                            {refining ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                            <span>Update</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div key="empty" className="h-[600px] bg-white border border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-12 text-center space-y-6">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                    <ImageIcon size={40} strokeWidth={1.5} />
                  </div>
                  <div className="max-w-xs space-y-2">
                    <h3 className="font-bold text-lg text-slate-800 italic">Mulai Workflow Anda</h3>
                    <p className="text-sm text-slate-500">Pilih preset di sebelah kiri atau atur konfigurasi foto mentah Anda untuk mendapatkan arahan studio profesional.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-4">
                    <div className="p-4 bg-slate-50/50 rounded-2xl text-left border border-slate-100">
                      <div className="w-6 h-6 bg-white rounded flex items-center justify-center text-emerald-600 shadow-sm mb-2 text-xs font-bold">1</div>
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-tighter">Smart AI Output</p>
                      <p className="text-[10px] text-slate-400 mt-1">Prompt MJ/SDXL yang sudah di-optimize otomatis.</p>
                    </div>
                    <div className="p-4 bg-slate-50/50 rounded-2xl text-left border border-slate-100">
                      <div className="w-6 h-6 bg-white rounded flex items-center justify-center text-emerald-600 shadow-sm mb-2 text-xs font-bold">2</div>
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-tighter">Visual Reference</p>
                      <p className="text-[10px] text-slate-400 mt-1">Gunakan preview sebagai referensi moodboard.</p>
                    </div>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Style Gallery Modal */}
      <AnimatePresence>
        {showStyleGallery && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStyleGallery(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 top-[5%] bottom-[5%] sm:top-[10%] sm:bottom-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-2xl bg-white rounded-3xl shadow-2xl z-[101] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xl text-slate-800">Pilih Visual Mood</h3>
                  <p className="text-xs text-slate-500 mt-1">Sesuaikan style akhir untuk hasil studio yang optimal.</p>
                </div>
                <button 
                  onClick={() => setShowStyleGallery(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {STYLE_OPTIONS.map((style) => (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      key={style.value}
                      onClick={() => {
                        setInput({ ...input, targetStyle: style.value });
                        setShowStyleGallery(false);
                      }}
                      className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-4 ${
                        input.targetStyle === style.value
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-md shadow-emerald-100'
                        : 'border-slate-100 hover:border-emerald-200 bg-white'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
                        {style.icon}
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          {style.label}
                          {input.targetStyle === style.value && <Check size={14} className="text-emerald-600" />}
                        </div>
                        <p className="text-[10px] leading-relaxed text-slate-500 font-medium">{style.description}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setShowStyleGallery(false)}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-200 transition-all hover:bg-slate-800"
                >
                  Gunakan Style Ini
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {showDownloadToast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 border border-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white">
              <Check size={18} strokeWidth={3} />
            </div>
            <div>
              <p className="text-sm font-bold">Download Berhasil!</p>
              <p className="text-[10px] text-slate-400">File High Definition telah disimpan ke perangkat Anda.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Integration Hub Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl relative z-10 overflow-hidden mx-auto"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">AI Integration Hub</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Secure GPT Authentication</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-start gap-4">
                  <div className="p-2 bg-white rounded-xl shadow-sm text-emerald-600">
                    <Lock size={18} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-900">Privasi Akun Publik</p>
                    <p className="text-[11px] text-emerald-700/70 leading-relaxed">
                      Terhubung dengan layanan AI publik menggunakan API Key Anda sendiri. Data kunci disimpan secara lokal di browser Anda untuk keamanan maksimal dan akses tanpa batas.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* OpenAI / ChatGPT Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex items-center justify-center bg-slate-900 text-white rounded-lg">
                          <Zap size={16} />
                        </div>
                        <span className="text-sm font-bold text-slate-800">OpenAI (ChatGPT)</span>
                      </div>
                      <a 
                        href="https://platform.openai.com/api-keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-emerald-600 font-bold hover:underline flex items-center gap-1"
                      >
                        Dapatkan Key <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="relative">
                      <input 
                        type="password"
                        placeholder="sk-..."
                        value={userApiKeys.openai || ''}
                        onChange={(e) => saveApiKeys({ ...userApiKeys, openai: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* OpenRouter Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-800 rounded-lg">
                          <Sparkles size={16} />
                        </div>
                        <span className="text-sm font-bold text-slate-800">OpenRouter (Full Access)</span>
                      </div>
                      <a 
                        href="https://openrouter.ai/keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-emerald-600 font-bold hover:underline flex items-center gap-1"
                      >
                        Dapatkan Key <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="relative">
                      <input 
                        type="password"
                        placeholder="sk-or-v1-..."
                        value={userApiKeys.openrouter || ''}
                        onChange={(e) => saveApiKeys({ ...userApiKeys, openrouter: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Together AI Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg">
                          <Wind size={16} />
                        </div>
                        <span className="text-sm font-bold text-slate-800">Together AI (Open Models)</span>
                      </div>
                      <a 
                        href="https://api.together.xyz/settings/api-keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-emerald-600 font-bold hover:underline flex items-center gap-1"
                      >
                        Dapatkan Key <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="relative">
                      <input 
                        type="password"
                        placeholder="Together API Key..."
                        value={userApiKeys.together || ''}
                        onChange={(e) => saveApiKeys({ ...userApiKeys, together: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                  >
                    <Check size={20} />
                    <span>Terapkan Koneksi Privat</span>
                  </button>
                  
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full py-3 bg-white border border-slate-200 text-slate-500 rounded-2xl font-bold hover:bg-slate-50 hover:text-slate-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={18} />
                    <span>Kembali ke Menu Utama</span>
                  </button>

                  <p className="text-center text-[9px] text-slate-400 font-medium pt-1">
                    Sistem akan otomatis menggunakan kunci privat Anda jika tersedia untuk menghindari antrian kuota publik.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-slate-200/60 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="text-slate-400 text-xs">
            © 2026 PhotoAssist AI. Built for Professional Photographers. 
            <br />Empowering creativity through AI Assistant Intelligence.
          </div>
          <div className="flex justify-end gap-6 text-slate-300">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"><Sparkles size={12}/> High Quality MJ Ready</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"><Zap size={12}/> Studio Optimized</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
