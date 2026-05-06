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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PromptInput, GenerationResult, PhotoType } from './types';
import { PRESETS, PHOTO_TYPES, STYLE_OPTIONS, CONDITION_OPTIONS } from './constants';
import { generatePhotoGuidance, analyzeImage } from './services/gemini';
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
  });

  const [showStyleGallery, setShowStyleGallery] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

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
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
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
        // System updates fields automatically based on analysis
        // Auto-generation is removed to allow manual review as per user request
      } catch (error) {
        console.error("Analysis failed", error);
        alert("Gagal menganalisa gambar. Pastikan format benar.");
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!user) {
      alert("Silahkan login untuk menyimpan history.");
      return;
    }

    setLoading(true);
    try {
      const gInput = { ...input, subjectCount: input.subjectCount || 1 };
      const res = await generatePhotoGuidance(gInput, uploadedImage);
      setResult(res);

      try {
        // Exclude large base64 image from Firestore to avoid 1MB limit
        const { imageUrl, ...restOfResult } = res;
        await addDoc(collection(db, 'generations'), {
          userId: user.uid,
          input: gInput,
          result: restOfResult,
          createdAt: serverTimestamp()
        });

        // Auto-save as preset if combination is unique
        const comboExists = [
          ...PRESETS.map(p => p.config), 
          ...userPresets.map(up => up.config)
        ].some(c => 
          c.photoType === gInput.photoType && 
          c.targetStyle === gInput.targetStyle && 
          c.intensity === gInput.intensity
        );

        if (!comboExists) {
          await addDoc(collection(db, 'user_presets'), {
            userId: user.uid,
            name: `Mode ${STYLE_OPTIONS.find(s => s.value === gInput.targetStyle)?.label || 'Custom'}`,
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

    } catch (error) {
      alert("Terjadi kesalahan saat generate. Mohon coba lagi.");
    } finally {
      setLoading(false);
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

  const toggleCondition = (val: string) => {
    setInput(prev => ({
      ...prev,
      conditions: prev.conditions.includes(val)
        ? prev.conditions.filter(c => c !== val)
        : [...prev.conditions, val]
    }));
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Sparkles size={18} />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">PhotoAssist<span className="text-emerald-600">AI</span></span>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    showHistory ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <History size={16} />
                  <span>Library</span>
                </button>
                <div className="h-6 w-px bg-slate-200" />
                <div className="flex items-center gap-3">
                  <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-slate-200" />
                  <button onClick={logout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors" title="Logout">
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

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Sidebar - Input Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className={`bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 space-y-8 transition-opacity ${!user && 'opacity-50 pointer-events-none'}`}>
              {!user && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-6 text-center">
                  <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 space-y-4">
                    <History size={40} className="mx-auto text-slate-300" />
                    <div>
                      <p className="font-bold text-slate-800">Login Diperlukan</p>
                      <p className="text-xs text-slate-500 mt-1">Simpan history & gunakan fitur analisa foto secara gratis.</p>
                    </div>
                    <button onClick={login} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold">Login Sekarang</button>
                  </div>
                </div>
              )}
              
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
                          <button
                            key={p.id}
                            onClick={() => { applyPreset(p); setShowPresets(false); }}
                            className="p-3 text-left border border-slate-100 rounded-xl hover:border-emerald-200 hover:bg-emerald-50 transition-all group bg-white"
                            id={`preset-${p.id}`}
                          >
                            <div className="font-semibold text-[11px] group-hover:text-emerald-700">{p.name}</div>
                            <div className="text-[9px] text-slate-400 leading-tight mt-0.5">{p.description}</div>
                          </button>
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
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Camera size={18} />
                    <label className="text-sm font-semibold">Jenis Foto</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {PHOTO_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setInput({ ...input, photoType: t.value as PhotoType })}
                        className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                          input.photoType === t.value 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                        id={`type-${t.value}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                      id="input-outfit"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Wind size={18} />
                    <label className="text-sm font-semibold">Masalah di Foto Mentah</label>
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
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
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

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Zap size={18} />
                    <label className="text-sm font-semibold">Style Tujuan</label>
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
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
              </div>

              <button 
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 group"
                id="btn-generate"
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={20} />
                    <span>Mempersiapkan Studio Look...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} className="group-hover:scale-110 transition-transform" />
                    <span>Generate Studio Lens</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main Output Area */}
          <div className="lg:col-span-8 space-y-6">
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
                    <div className="p-6 space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                            Smart Prompt Output
                          </label>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => copyToClipboard(result.prompt)}
                              className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-emerald-600 transition-all relative group"
                              title="Copy Prompt"
                              id="btn-copy-prompt"
                            >
                              {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                              {copied && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded">Copied!</span>}
                            </button>
                            <button 
                              className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors"
                              title="Save to Library"
                            >
                              <Download size={18} />
                            </button>
                          </div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-mono text-sm leading-relaxed text-slate-700">
                          {result.prompt}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Creative Guidance (Indonesian)</label>
                        <div className="prose prose-slate prose-sm max-w-none text-slate-600 leading-relaxed italic border-l-4 border-emerald-500 pl-4 py-2">
                          {result.creativeDirection}
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
              className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-white rounded-3xl shadow-2xl z-[101] overflow-hidden flex flex-col"
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
                    <button
                      key={style.value}
                      onClick={() => {
                        setInput({ ...input, targetStyle: style.value });
                        setShowStyleGallery(false);
                      }}
                      className={`p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] flex items-start gap-4 ${
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
                    </button>
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
