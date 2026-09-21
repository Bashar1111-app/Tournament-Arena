import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { seedDemoTournament } from '../lib/demoData';
import { useFirebase } from '../contexts/FirebaseContext';
import { Plus, Users, Calendar, ArrowRight, Info, Zap, Share2, Tv, Award, Copy, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface Tournament {
  id: string;
  name: string;
  format: 'league' | 'knockout' | 'group_knockout';
  status: 'upcoming' | 'ongoing' | 'completed';
  createdAt: any;
  createdBy: string;
  description?: string;
  prize?: string;
  capacity?: number;
  entryType?: 'free' | 'paid';
}

interface TournamentListProps {
  onSelectTournament: (id: string) => void;
}

function TournamentCard({ tournament, onSelect }: { tournament: Tournament, onSelect: (id: string) => void }) {
  const [joinedCount, setJoinedCount] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'tournaments', tournament.id, 'participants'),
      where('status', '==', 'approved')
    );
    return onSnapshot(q, (snapshot) => {
      setJoinedCount(snapshot.docs.length);
    });
  }, [tournament.id]);

  const capacity = tournament.capacity || 32;
  const progress = Math.min((joinedCount / capacity) * 100, 100);
  const slotsLeft = Math.max(capacity - joinedCount, 0);

  return (
    <motion.div 
      layoutId={tournament.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative bg-[#111827] rgb-border border-white/5 rounded-[32px] p-6 sm:p-8 shadow-2xl overflow-hidden group hover:border-amber-500/20 transition-all"
    >
      {/* Background Icon Watermark */}
      <div className="absolute bottom-[-20px] right-[-10px] opacity-[0.03] group-hover:scale-110 transition-transform duration-700 pointer-events-none">
        <Trophy className="w-48 h-48 text-white" />
      </div>

      {/* Top Badges Row */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
        <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border ${
          tournament.status === 'ongoing' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
          tournament.status === 'upcoming' ? 'bg-[#38bdf8]/10 border-[#38bdf8]/20 text-[#38bdf8]' :
          'bg-zinc-800/50 border-white/5 text-zinc-500'
        }`}>
          <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${tournament.status === 'ongoing' ? 'bg-amber-500 animate-pulse' : tournament.status === 'upcoming' ? 'bg-[#38bdf8]' : 'bg-zinc-600'}`}></span>
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest italic">
            {tournament.status === 'ongoing' ? 'Live' : tournament.status === 'upcoming' ? 'Open' : 'End'}
          </span>
        </div>
        
        {/* Entry Type Badge */}
        <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border ${
          tournament.entryType === 'paid' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-500'
        }`}>
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest italic">{tournament.entryType === 'paid' ? 'Paid' : 'Free'}</span>
        </div>

        {/* Prize Pool Badge */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 ml-auto">
          <Award className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest italic">{tournament.prize || 'No Prize'}</span>
        </div>
      </div>

      {/* Tournament Title */}
      <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tighter mb-4 leading-tight">
        {tournament.name}
      </h3>

      {/* Arena ID Pill */}
      <div className="inline-flex items-center gap-3 px-4 py-2.5 bg-black/40 border border-white/5 rounded-2xl mb-8 group/id cursor-pointer active:scale-95 transition-all" onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(tournament.id);
        alert("Arena ID copied!");
      }}>
        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] italic">Arena ID:</span>
        <span className="text-[11px] font-mono font-black text-zinc-300 italic">{tournament.id.slice(0, 8)}</span>
        <Copy className="w-3.5 h-3.5 text-zinc-600 group-hover/id:text-amber-500 transition-colors" />
      </div>

      {/* Slots Info Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-zinc-400">
          <Users className="w-4 h-4" />
          <span className="text-[11px] font-black uppercase tracking-widest italic">{capacity} Elite Players</span>
        </div>
        <div className="px-3 py-1 bg-[#38bdf8]/10 rounded-lg">
          <span className="text-[9px] font-black text-[#38bdf8] uppercase tracking-widest italic">{slotsLeft} Slots Left</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden mb-3">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute inset-0 bg-gradient-to-r from-[#38bdf8] via-[#38bdf8] to-amber-500 rounded-full"
        />
      </div>

      {/* Progress Stats */}
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest italic mb-8">
        <span className="text-zinc-500">{joinedCount} / {capacity} Joined</span>
        <span className="text-zinc-500">{Math.round(progress)}% Filled</span>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onSelect(tournament.id)}
          className="flex-1 h-12 sm:h-16 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl sm:rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] sm:text-[12px] italic shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 sm:gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          Enter Arena
        </button>
        <button 
          className="h-12 w-12 sm:h-16 sm:w-16 bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white border border-white/5 rounded-2xl sm:rounded-[24px] flex items-center justify-center transition-all group/share"
          onClick={(e) => {
            e.stopPropagation();
            alert("Share feature synchronized!");
          }}
        >
          <Share2 className="w-4 h-4 sm:w-5 sm:h-5 group-hover/share:scale-110 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
}

export function TournamentList({ onSelectTournament }: TournamentListProps) {
  const { user, userData, isAdmin } = useFirebase();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFeeWindow, setShowFeeWindow] = useState(false);
  const [newTournament, setNewTournament] = useState({ 
    name: '', 
    description: '', 
    format: 'league' as const, 
    prize: '৳500 Prize', 
    capacity: 32, 
    entryType: 'free' as 'free' | 'paid',
    rules: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming'>('all');

  const canCreate = isAdmin || userData?.role === 'publisher';

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
      setTournaments(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tournaments');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    
    if (isAdmin) {
      // Admins bypass the fee window
      processCreate();
    } else {
      // Publishers must see the fee window
      setShowFeeWindow(true);
    }
  };

  const processCreate = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'tournaments'), {
        ...newTournament,
        status: 'upcoming',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        publisherRole: userData?.role || 'admin',
        rules: newTournament.rules
      });
      setNewTournament({ 
        name: '', 
        description: '', 
        format: 'league', 
        prize: '৳500 Prize', 
        capacity: 32, 
        entryType: 'free',
        rules: '' 
      });
      setIsModalOpen(false);
      setShowFeeWindow(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tournaments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTournaments = tournaments.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'live') return t.status === 'ongoing';
    if (filter === 'upcoming') return t.status === 'upcoming';
    return true;
  });

  const serverFee = newTournament.entryType === 'free' ? 10 : 20;

  return (
    <div className="space-y-6">
      {/* Telemetry Status Bar */}
      <div className="flex items-center justify-between py-3 px-6 rounded-[24px] bg-[#111827] rgb-border border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.5)]"></span>
          <span className="text-[10px] font-black text-[#38bdf8] tracking-[0.2em] uppercase italic">Arena Protocol v4.0 Active</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">
          <span>{tournaments.length} Active Events</span>
          <span className="text-white/10 opacity-50">•</span>
          <span>Regional Sync Stable</span>
        </div>
      </div>

      {/* Filter Pills & Admin/Publisher Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {(['all', 'live', 'upcoming'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all italic border min-w-[100px] sm:min-w-0 rgb-border ${
                filter === f 
                  ? 'bg-white text-black border-white shadow-xl scale-105' 
                  : 'bg-white/5 text-zinc-500 border-white/5 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {canCreate && (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest italic shadow-lg shadow-amber-500/10 hover:bg-amber-400"
            >
              <Plus className="w-4 h-4" />
              Launch Arena
            </button>
          </div>
        )}
      </div>

      {/* Arena Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredTournaments.map((t) => (
          <TournamentCard key={t.id} tournament={t} onSelect={onSelectTournament} />
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !showFeeWindow && setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#1A2233] border border-white/10 rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl"
            >
              {!showFeeWindow ? (
                <div className="p-10">
                  <h2 className="text-2xl font-black text-white mb-8 uppercase italic">New Arena Event</h2>
                  <form onSubmit={handleCreateRequest} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1 italic">Event Name</label>
                      <input required type="text" value={newTournament.name} onChange={e => setNewTournament({ ...newTournament, name: e.target.value })} className="w-full px-5 py-4 bg-black/20 border border-white/5 rounded-2xl focus:ring-1 focus:ring-amber-500 font-black text-white italic outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1 italic">Format</label>
                      <select value={newTournament.format} onChange={e => setNewTournament({ ...newTournament, format: e.target.value as any })} className="w-full px-5 py-4 bg-black/20 border border-white/5 rounded-2xl focus:ring-1 focus:ring-amber-500 font-black text-white italic outline-none">
                        <option value="league" className="bg-[#1A2233]">League</option>
                        <option value="knockout" className="bg-[#1A2233]">Knockout</option>
                        <option value="group_knockout" className="bg-[#1A2233]">Group + Knockout</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1 italic">Prize Pool</label>
                        <input required type="text" value={newTournament.prize} onChange={e => setNewTournament({ ...newTournament, prize: e.target.value })} className="w-full px-5 py-4 bg-black/20 border border-white/5 rounded-2xl focus:ring-1 focus:ring-amber-500 font-black text-white italic outline-none" placeholder="৳500 Prize" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1 italic">Entry Type</label>
                        <select value={newTournament.entryType} onChange={e => setNewTournament({ ...newTournament, entryType: e.target.value as any })} className="w-full px-5 py-4 bg-black/20 border border-white/5 rounded-2xl focus:ring-1 focus:ring-amber-500 font-black text-white italic outline-none">
                          <option value="free" className="bg-[#1A2233]">Free</option>
                          <option value="paid" className="bg-[#1A2233]">Paid</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1 italic">Tournament Rules & Role Guidelines</label>
                      <textarea 
                        required 
                        value={newTournament.rules} 
                        onChange={e => setNewTournament({ ...newTournament, rules: e.target.value })} 
                        className="w-full px-5 py-4 bg-black/20 border border-white/5 rounded-2xl focus:ring-1 focus:ring-amber-500 font-bold text-white italic outline-none min-h-[120px] resize-none"
                        placeholder="Define the rules, role specific guidelines, and arena protocols..."
                      />
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-zinc-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-all">Cancel</button>
                      <button type="submit" className="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-400 shadow-xl shadow-amber-500/10 italic">Next Step</button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-10 text-center space-y-8">
                  <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto border border-amber-500/20">
                    <Zap className="w-10 h-10 text-amber-500 fill-amber-500/20" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Server Access Fee</h2>
                    <p className="text-zinc-500 text-sm italic">To deploy this arena event on our elite engine, a server maintenance fee is required.</p>
                  </div>

                  <div className="p-8 bg-black/40 border border-white/5 rounded-[32px] space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest italic">Event Type</span>
                      <span className="text-[11px] font-black text-white uppercase tracking-widest italic">{newTournament.entryType === 'free' ? 'Free Tournament' : 'Paid Tournament'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest italic">Engine Utilization</span>
                      <span className="text-[11px] font-black text-white uppercase tracking-widest italic">Standard Allocation</span>
                    </div>
                    <div className="h-px bg-white/5 w-full" />
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-black text-amber-500 uppercase tracking-widest italic">Total Due</span>
                      <span className="text-[24px] font-black text-white italic">৳{serverFee}</span>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setShowFeeWindow(false)} 
                      className="flex-1 py-4 text-zinc-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
                    >
                      Back to Edit
                    </button>
                    <button 
                      onClick={processCreate}
                      disabled={isSubmitting}
                      className="flex-1 py-5 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-amber-400 shadow-xl shadow-amber-500/20 italic flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? 'Processing...' : 'Authorize & Launch'}
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-600 font-bold italic tracking-wider">Note: This fee is for server maintenance and engine access.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
