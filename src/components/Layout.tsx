import React, { useState } from 'react';
import { Trophy, LogOut, LogIn, LayoutGrid, Award, UserCircle, Activity, ChevronLeft, ShieldCheck, Search, X, Bell, Gamepad2, Zap } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

import { NotificationCenter } from './NotificationCenter';

interface LayoutProps {
  children: React.ReactNode;
  onBack?: () => void;
  isDetail?: boolean;
  activeTab: 'arena' | 'standings' | 'bracket' | 'profile';
  setActiveTab: (tab: 'arena' | 'standings' | 'bracket' | 'profile') => void;
  onSelectTournament?: (id: string) => void;
}

export function Layout({ children, onBack, isDetail, activeTab, setActiveTab, onSelectTournament }: LayoutProps) {
  const { user, userData, login, logout, isAdmin } = useFirebase();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchId.trim();
    if (!term || !onSelectTournament) return;
    setIsSearching(true);
    try {
      // First try direct match
      const directRef = doc(db, 'tournaments', term);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        onSelectTournament(directSnap.id);
        setIsSearchOpen(false);
        setSearchId('');
        return;
      }

      // If not direct, search by short ID prefix
      const q = query(collection(db, 'tournaments'), limit(50));
      const querySnap = await getDocs(q);
      const found = querySnap.docs.find(d => d.id.toLowerCase().startsWith(term.toLowerCase()));
      
      if (found) {
        onSelectTournament(found.id);
        setIsSearchOpen(false);
        setSearchId('');
      } else {
        alert("Arena not found. Please verify the Arena ID.");
      }
    } catch (error) {
      console.error(error);
      alert("Error accessing Arena database.");
    } finally {
      setIsSearching(false);
    }
  };

  const navItems = [
    { id: 'arena', label: 'Arena', icon: LayoutGrid },
    { id: 'standings', label: 'Standings', icon: Award },
    { id: 'bracket', label: 'Bracket', icon: Activity },
    { id: 'profile', label: 'Profile', icon: UserCircle },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0B1221] flex flex-col font-sans">
      {/* Sophisticated Header */}
      <header className="sticky top-0 w-full z-50 bg-[#0B1221]/80 backdrop-blur-xl border-b border-white/5 shadow-lg">
        <div className="max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDetail && activeTab === 'arena' && (
              <button 
                onClick={onBack}
                className="p-2 hover:bg-white/5 rounded-xl transition-all mr-1"
              >
                <ChevronLeft className="w-5 h-5 text-zinc-400" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-[16px] font-black tracking-tight text-white uppercase italic leading-none">FC ARENA VS</span>
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] mt-1 opacity-80">Elite Engine</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all text-zinc-400 hover:text-white"
            >
              <Search className="w-5 h-5" />
            </button>

            <NotificationCenter />
            {isAdmin && (
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/5 text-white text-[8px] font-black uppercase tracking-widest rounded-full border border-white/5">
                <ShieldCheck className="w-3 h-3 text-amber-500" />
                ADMIN
              </span>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[11px] font-black text-white italic">{user.displayName || 'Spark Play'}</span>
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                    {userData?.role === 'publisher' ? 'Arena Publisher' : 'Elite Member'}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg shadow-black/20 cursor-pointer" onClick={() => setActiveTab('profile')}>
                  {(userData?.photoURL || user.photoURL) ? (
                    <img src={userData?.photoURL || user.photoURL || ''} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="w-5 h-5 text-zinc-500" />
                  )}
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="px-6 py-2.5 bg-amber-500 text-black rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-95 italic"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-8 pb-24 px-4 sm:px-6 max-w-7xl mx-auto w-full relative z-10">
        {children}
      </main>

      {/* Bottom Navigation (Mobile/Standard) */}
      <nav className="fixed bottom-0 w-full z-50 bg-[#0B1221]/95 backdrop-blur-xl border-t border-white/5 pb-safe">
        <div className="max-w-7xl mx-auto flex items-center justify-around h-16 px-2">
          {navItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id === 'arena' && isDetail && onBack) {
                  onBack();
                }
              }}
              className={`flex flex-col items-center justify-center min-w-[64px] h-full transition-all ${
                activeTab === item.id ? 'text-amber-500' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <item.icon className={`w-6 h-6 ${activeTab === item.id ? 'fill-amber-500/10' : ''}`} />
              <span className="text-[10px] font-black tracking-widest uppercase mt-1 italic">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Footer (Desktop Only) */}
      <footer className="hidden sm:block border-t border-white/5 py-12 px-6 bg-black/20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-xl">
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">FC Mobile Community</p>
          </div>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">© 2026 FC ARENA VS • DESIGNED FOR ELITES</p>
        </div>
      </footer>

      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsLoginModalOpen(false)} 
              className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-[#111827] border border-white/10 rounded-[56px] p-12 shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              {/* Background Accents */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#38bdf8]/5 blur-[100px] rounded-full pointer-events-none" />

              <div className="relative z-10 space-y-12 text-center">
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-amber-500/10 rounded-[32px] flex items-center justify-center mx-auto border border-amber-500/20 shadow-inner">
                    <Trophy className="w-10 h-10 text-amber-500 fill-amber-500/20" />
                  </div>
                  <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Elite Access</h2>
                  <p className="text-zinc-500 text-sm italic max-w-sm mx-auto">Select your arena status to initialize your neural synchronization and career logs.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <button 
                    onClick={() => { login('player'); setIsLoginModalOpen(false); }}
                    className="group relative flex flex-col items-center p-8 bg-white/[0.03] border border-white/5 rounded-[40px] hover:bg-white/[0.05] hover:border-amber-500/30 transition-all duration-500 text-center space-y-4"
                  >
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      <Gamepad2 className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase italic leading-none">Arena Player</h3>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2 italic">Compete & Earn</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => { login('publisher'); setIsLoginModalOpen(false); }}
                    className="group relative flex flex-col items-center p-8 bg-white/[0.03] border border-white/5 rounded-[40px] hover:bg-white/[0.05] hover:border-[#38bdf8]/30 transition-all duration-500 text-center space-y-4"
                  >
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      <Zap className="w-7 h-7 text-[#38bdf8]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase italic leading-none">Arena Publisher</h3>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2 italic">Host & Manage</p>
                    </div>
                  </button>
                </div>

                <button 
                  onClick={() => setIsLoginModalOpen(false)}
                  className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.3em] hover:text-white transition-all italic"
                >
                  Terminate Request
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSearchOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-[#1A2233] border border-white/10 rounded-[40px] w-full max-w-lg p-8 sm:p-10 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Access Arena</h2>
                <button onClick={() => setIsSearchOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-zinc-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSearch} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Enter Full Arena ID</label>
                  <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input 
                      required 
                      type="text" 
                      value={searchId} 
                      onChange={e => setSearchId(e.target.value)} 
                      placeholder="e.g. 5jK8lM9..."
                      className="w-full h-16 pl-14 pr-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-amber-500" 
                    />
                  </div>
                  <p className="text-[9px] text-zinc-600 font-bold italic px-2">Ask the tournament organizer for the full Arena ID.</p>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isSearching}
                  className="w-full py-5 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[12px] italic shadow-xl shadow-amber-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSearching ? 'Synchronizing...' : 'Join Arena'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
