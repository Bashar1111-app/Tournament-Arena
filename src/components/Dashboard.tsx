import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, rtdb } from '../lib/firebase';
import { collection, query, where, onSnapshot, collectionGroup, getDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Gamepad2, Zap, Clock, ChevronRight, Target, Shield, Facebook, MessageCircle, Upload, MessageSquare, CheckCircle, Users, X } from 'lucide-react';
import { MatchChat } from './MatchChat';
import { ResultReportModal } from './ResultReportModal';
import { PWAInstallButton } from './PWAInstallButton';

interface DashboardProps {
  onSelectTournament: (id: string) => void;
}

export function Dashboard({ onSelectTournament }: DashboardProps) {
  const { user, userData } = useFirebase();
  const [activeMatches, setActiveMatches] = useState<any[]>([]);
  const [myTournaments, setMyTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMatchChat, setActiveMatchChat] = useState<{ matchId: string, tournamentId: string, homeName: string, awayName: string } | null>(null);
  const [reportingMatch, setReportingMatch] = useState<{ matchId: string, tournamentId: string, homeName: string, awayName: string } | null>(null);
  const [latestMessages, setLatestMessages] = useState<Record<string, number>>({});
  const [lastSeenMessages, setLastSeenMessages] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(`lastSeen_dashboard`);
    return saved ? JSON.parse(saved) : {};
  });

  const updateLastSeen = (chatPath: string) => {
    const now = Date.now();
    const updated = { ...lastSeenMessages, [chatPath]: now };
    setLastSeenMessages(updated);
    localStorage.setItem(`lastSeen_dashboard`, JSON.stringify(updated));
  };

  const hasUnread = (chatPath: string) => {
    const latest = latestMessages[chatPath] || 0;
    const lastSeen = lastSeenMessages[chatPath] || 0;
    return latest > lastSeen;
  };

  useEffect(() => {
    if (activeMatches.length === 0) return;

    const unsubscribers = activeMatches.map(m => {
      const path = `chats/${m.tournamentId}/${m.id}`;
      const chatRef = ref(rtdb, path);
      return onValue(chatRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const msgs = Object.values(data) as any[];
          const latest = Math.max(...msgs.map(m => m.createdAt || 0));
          setLatestMessages(prev => ({ ...prev, [path]: latest }));
        }
      });
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [activeMatches]);

  useEffect(() => {
    if (!user) return;

    let unsubMatches: (() => void) | null = null;
    let unsubTourneys: (() => void) | null = null;

    if (userData?.role === 'publisher') {
      const q = query(collection(db, 'tournaments'), where('createdBy', '==', user.uid));
      unsubTourneys = onSnapshot(q, (snapshot) => {
        setMyTournaments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
    } else {
      const joinedQ = query(collectionGroup(db, 'participants'), where('userId', '==', user.uid));
      const unsubJoined = onSnapshot(joinedQ, (joinedSnapshot) => {
        const myParticipantIdsByTournament: Record<string, string> = {};
        joinedSnapshot.docs.forEach(d => {
          const tId = d.ref.parent.parent?.id;
          if (tId) myParticipantIdsByTournament[tId] = d.id;
        });

        const tournamentIds = Object.keys(myParticipantIdsByTournament);

        if (tournamentIds.length > 0) {
          const unsubscribers: (() => void)[] = [];
          
          tournamentIds.forEach(tId => {
            const mq = query(collection(db, 'tournaments', tId, 'matches'), where('status', 'in', ['scheduled', 'reported']));
            const unsub = onSnapshot(mq, async (snapshot) => {
              const myPartId = myParticipantIdsByTournament[tId];
              const matchesPromises = snapshot.docs.map(async d => {
                const data = d.data();
                const isParticipant = data.homeParticipantId === myPartId || data.awayParticipantId === myPartId;
                
                if (isParticipant) {
                  const homeSnap = await getDoc(doc(db, 'tournaments', tId, 'participants', data.homeParticipantId));
                  const awaySnap = await getDoc(doc(db, 'tournaments', tId, 'participants', data.awayParticipantId));
                  const tourneySnap = await getDoc(doc(db, 'tournaments', tId));
                  
                  const homeData = homeSnap.exists() ? homeSnap.data() : null;
                  const awayData = awaySnap.exists() ? awaySnap.data() : null;

                  return {
                    id: d.id,
                    tournamentId: tId,
                    tournamentName: tourneySnap.exists() ? tourneySnap.data().name : 'Arena',
                    myParticipantId: myPartId,
                    ...data,
                    homeParticipant: { id: data.homeParticipantId, ...homeData },
                    awayParticipant: { id: data.awayParticipantId, ...awayData }
                  };
                }
                return null;
              });

              const results = await Promise.all(matchesPromises);
              const validMatches = results.filter(m => m !== null);
              
              setActiveMatches(prev => {
                const others = prev.filter(p => p.tournamentId !== tId);
                return [...others, ...validMatches];
              });
              setLoading(false);
            });
            unsubscribers.push(unsub);
          });
          unsubMatches = () => unsubscribers.forEach(u => u());
        } else {
          setLoading(false);
        }
      });

      return () => {
        unsubJoined();
        if (unsubMatches) unsubMatches();
      };
    }

    return () => {
      if (unsubTourneys) unsubTourneys();
      if (unsubMatches) unsubMatches();
    };
  }, [user, userData]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMatchChat(null);
        setReportingMatch(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleApproveResult = async (match: any) => {
    try {
      await updateDoc(doc(db, 'tournaments', match.tournamentId, 'matches', match.id), {
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      alert("Match result verified!");
    } catch (error) {
      console.error(error);
      alert("Failed to approve result.");
    }
  };

  const MatchCountdown = ({ deadline }: { deadline?: any }) => {
    const [timeLeft, setTimeLeft] = useState<string>('00:00:00');
    useEffect(() => {
      if (!deadline) return;
      const interval = setInterval(() => {
        const target = deadline.seconds ? deadline.seconds * 1000 : new Date(deadline).getTime();
        const now = new Date().getTime();
        const distance = target - now;
        if (distance < 0) {
          setTimeLeft('EXPIRED');
          clearInterval(interval);
          return;
        }
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        const seconds = Math.floor((distance % (1000 * 60)) / 1000).toString().padStart(2, '0');
        setTimeLeft(`${hours}:${minutes}:${seconds}`);
      }, 1000);
      return () => clearInterval(interval);
    }, [deadline]);
    if (!deadline) return null;
    return (
      <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
        <span className="text-[12px] font-mono font-black text-white tracking-[0.2em]">{timeLeft}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-[24px] flex items-center justify-center border shadow-lg ${
            userData?.role === 'publisher' ? 'bg-[#38bdf8]/10 border-[#38bdf8]/20' : 'bg-amber-500/10 border-amber-500/20'
          }`}>
            {userData?.role === 'publisher' ? <Zap className="w-7 h-7 text-[#38bdf8]" /> : <Gamepad2 className="w-7 h-7 text-amber-500" />}
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">
              {userData?.role === 'publisher' ? 'Management Core' : 'Active Duty'}
            </h2>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">
              {userData?.role === 'publisher' ? 'Deploy & Monitor Arenas' : 'Engage In Current Matches'}
            </p>
          </div>
        </div>
        <PWAInstallButton />
      </div>

      {userData?.role === 'publisher' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {myTournaments.length === 0 ? (
            <div className="col-span-full py-20 bg-white/5 rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
              <Trophy className="w-12 h-12 text-zinc-800 mb-4" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px] italic">No active arenas deployed</p>
            </div>
          ) : (
            myTournaments.map(t => (
              <motion.div
                key={t.id}
                whileHover={{ y: -5 }}
                onClick={() => onSelectTournament(t.id)}
                className="bg-[#111827] border border-white/5 rounded-[40px] p-8 hover:border-[#38bdf8]/30 transition-all cursor-pointer group relative overflow-hidden rgb-border"
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="px-4 py-1.5 bg-[#38bdf8]/10 border border-[#38bdf8]/20 rounded-full">
                    <span className="text-[10px] font-black text-[#38bdf8] uppercase italic tracking-[0.2em]">{t.status}</span>
                  </div>
                  <Shield className="w-5 h-5 text-zinc-700" />
                </div>
                <h3 className="text-xl font-black text-white uppercase italic mb-4 line-clamp-1">{t.name}</h3>
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Clock className="w-4 h-4 text-zinc-600" />
                     <span className="text-[10px] font-black text-zinc-600 uppercase italic">{t.format}</span>
                   </div>
                   <ChevronRight className="w-5 h-5 text-[#38bdf8] group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {activeMatches.length === 0 ? (
            <div className="py-20 bg-white/5 rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
              <Target className="w-12 h-12 text-zinc-800 mb-4" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px] italic">All neural links clear. No pending matches.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {activeMatches.map(m => {
                const home = m.homeParticipant;
                const away = m.awayParticipant;
                const isHome = m.myParticipantId === m.homeParticipantId;
                const isAway = m.myParticipantId === m.awayParticipantId;
                const chatPath = `chats/${m.tournamentId}/${m.id}`;

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative bg-[#0B1221] rounded-[40px] p-8 transition-all shadow-2xl border border-white/5 group overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">
                          {m.tournamentName} • {m.stage.replace('_', ' ')}
                        </span>
                      </div>
                      <button 
                        onClick={() => onSelectTournament(m.tournamentId)}
                        className="p-2 hover:bg-white/5 rounded-xl transition-all text-zinc-500 hover:text-white group"
                      >
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>

                    <div className="flex items-start justify-between gap-4 mb-10">
                      <div className="flex flex-col items-center flex-1 min-w-0">
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4 italic">Home</span>
                        <div className="relative w-24 h-24 rounded-[32px] bg-white/5 border-2 border-white/5 overflow-hidden shadow-lg">
                          {home?.photoURL ? (
                            <img src={home.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Users className="w-8 h-8 text-zinc-700" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-black text-white mt-4 italic truncate w-full text-center">{home?.displayName || 'TBD'}</span>
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">{home?.ovr || '--'} OVR</span>
                        
                        <div className="flex gap-2 mt-4">
                          {home?.fbLink && (
                            <>
                              <a href={home.fbLink} target="_blank" rel="noreferrer" className="p-2 bg-[#1877F2]/10 rounded-xl hover:bg-[#1877F2]/20 text-[#1877F2] transition-all">
                                <Facebook className="w-4 h-4" />
                              </a>
                              <a href={`https://m.me/${home.fbLink.replace(/\/$/, '').split('/').pop()}`} target="_blank" rel="noreferrer" className="p-2 bg-[#00B2FF]/10 rounded-xl hover:bg-[#00B2FF]/20 text-[#00B2FF] transition-all">
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center pt-10">
                        {m.status === 'reported' ? (
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-4xl font-black text-white italic">{m.homeScore}</span>
                            <span className="text-sm font-black text-zinc-700 italic">VS</span>
                            <span className="text-4xl font-black text-white italic">{m.awayScore}</span>
                          </div>
                        ) : (
                          <span className="text-5xl font-black text-white/5 italic mb-4 tracking-tighter">VS</span>
                        )}
                        <MatchCountdown deadline={m.scheduledTime} />
                      </div>

                      <div className="flex flex-col items-center flex-1 min-w-0">
                        <span className="text-[10px] font-black text-[#38bdf8] uppercase tracking-widest mb-4 italic">Away</span>
                        <div className="relative w-24 h-24 rounded-[32px] bg-white/5 border-2 border-white/5 overflow-hidden shadow-lg">
                          {away?.photoURL ? (
                            <img src={away.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Users className="w-8 h-8 text-zinc-700" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-black text-white mt-4 italic truncate w-full text-center">{away?.displayName || 'TBD'}</span>
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">{away?.ovr || '--'} OVR</span>

                        <div className="flex gap-2 mt-4">
                          {away?.fbLink && (
                            <>
                              <a href={away.fbLink} target="_blank" rel="noreferrer" className="p-2 bg-[#1877F2]/10 rounded-xl hover:bg-[#1877F2]/20 text-[#1877F2] transition-all">
                                <Facebook className="w-4 h-4" />
                              </a>
                              <a href={`https://m.me/${away.fbLink.replace(/\/$/, '').split('/').pop()}`} target="_blank" rel="noreferrer" className="p-2 bg-[#00B2FF]/10 rounded-xl hover:bg-[#00B2FF]/20 text-[#00B2FF] transition-all">
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {m.status === 'scheduled' && isHome && (
                        <button 
                          onClick={() => setReportingMatch({ matchId: m.id, tournamentId: m.tournamentId, homeName: home?.displayName || 'TBD', awayName: away?.displayName || 'TBD' })}
                          className="py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Upload Result
                        </button>
                      )}
                      {m.status === 'reported' && isAway && (
                        <button 
                          onClick={() => handleApproveResult(m)}
                          className="py-4 bg-green-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic hover:bg-green-400 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Confirm Result
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setActiveMatchChat({ matchId: m.id, tournamentId: m.tournamentId, homeName: home?.displayName || 'TBD', awayName: away?.displayName || 'TBD' });
                          updateLastSeen(chatPath);
                        }}
                        className={`py-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-amber-500 border border-white/5 flex items-center justify-center gap-2 relative ${(!isHome && m.status === 'scheduled') || (!isAway && m.status === 'reported') ? 'col-span-2' : ''}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">Match Chat</span>
                        {hasUnread(chatPath) && (
                          <span className="absolute top-3 right-3 w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg" />
                        )}
                      </button>
                    </div>

                    {m.status === 'reported' && isHome && (
                      <div className="mt-4 p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic text-center">Awaiting Opponent Verification</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {activeMatchChat && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setActiveMatchChat(null)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0B1221] w-full max-w-lg h-[90vh] sm:h-[600px] rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col border border-white/10 shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/40">
                <div>
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Match Chat</h3>
                  <p className="text-[10px] font-black text-zinc-500 uppercase italic tracking-widest">{activeMatchChat.homeName} vs {activeMatchChat.awayName}</p>
                </div>
                <button 
                  onClick={() => setActiveMatchChat(null)} 
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-500 hover:text-white transition-all pointer-events-auto"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <MatchChat 
                  tournamentId={activeMatchChat.tournamentId} 
                  matchId={activeMatchChat.matchId}
                  homePlayerName={activeMatchChat.homeName}
                  awayPlayerName={activeMatchChat.awayName}
                  onClose={() => setActiveMatchChat(null)}
                />
              </div>
            </motion.div>
          </div>
        )}

        {reportingMatch && (
          <ResultReportModal
            isOpen={!!reportingMatch}
            onClose={() => setReportingMatch(null)}
            tournamentId={reportingMatch.tournamentId}
            matchId={reportingMatch.matchId}
            homeName={reportingMatch.homeName}
            awayName={reportingMatch.awayName}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
