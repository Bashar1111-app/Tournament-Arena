import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, setDoc, serverTimestamp, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb, OperationType, handleFirestoreError } from '../lib/firebase';
import { useFirebase } from '../contexts/FirebaseContext';
import { Users, Plus, Trophy, Trash2, Edit3, X, Save, UserPlus, ChevronRight, LayoutGrid, GitMerge, ListOrdered, Tv, Shield, Zap, CheckCircle, Clock, FileText, ExternalLink, MessageSquare, Upload, Facebook } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

import { MatchChat } from './MatchChat';
import { ResultReportModal } from './ResultReportModal';

interface Participant {
  id: string;
  userId: string;
  displayName: string;
  teamName: string;
  ovr: number;
  photoURL?: string;
  group?: string;
  phone?: string;
  fbLink?: string;
  gameUid?: string;
  status: 'pending' | 'approved' | 'rejected';
  registeredAt: any;
  eliteScore: number;
  stats?: {
    played: number;
    won: number;
    lost: number;
    drawn: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  };
}

interface Match {
  id: string;
  homeParticipantId: string;
  awayParticipantId: string;
  homeId?: string;
  awayId?: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'reported' | 'completed';
  stage: 'group' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'final';
  group?: string;
  reportedBy?: string;
  screenshotUrl?: string;
  updatedAt?: any;
  scheduledTime?: any; // New field for countdown
  stats?: any;
}

interface Tournament {
  id: string;
  name: string;
  format: 'league' | 'knockout' | 'group_knockout';
  status: 'upcoming' | 'ongoing' | 'completed';
  description?: string;
  createdBy: string;
  rules?: string;
}

interface TournamentDetailProps {
  tournamentId: string;
  onBack: () => void;
  initialTab?: 'group' | 'knockout' | 'players' | 'admin' | 'requests' | 'rules';
}

export function TournamentDetail({ tournamentId, onBack, initialTab }: TournamentDetailProps) {
  const { user, isAdmin, userData } = useFirebase();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<'group' | 'knockout' | 'players' | 'ranking' | 'admin' | 'requests' | 'rules'>(initialTab || 'group');
  const [activeMatchChat, setActiveMatchChat] = useState<{ matchId: string, homeName: string, awayName: string, isGlobal?: boolean } | null>(null);
  const [lastSeenMessages, setLastSeenMessages] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(`lastSeen_${tournamentId}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [latestMessages, setLatestMessages] = useState<Record<string, number>>({});

  useEffect(() => {
    // Listen for latest messages in all relevant chat rooms to show green dot
    const chatRooms = [
      `chats/${tournamentId}/global`,
      ...matches.map(m => `chats/${tournamentId}/${m.id}`)
    ];

    const unsubscribers = chatRooms.map(path => {
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
  }, [tournamentId, matches]);

  const updateLastSeen = (chatPath: string) => {
    const now = Date.now();
    const updated = { ...lastSeenMessages, [chatPath]: now };
    setLastSeenMessages(updated);
    localStorage.setItem(`lastSeen_${tournamentId}`, JSON.stringify(updated));
  };

  const hasUnread = (chatPath: string) => {
    const latest = latestMessages[chatPath] || 0;
    const lastSeen = lastSeenMessages[chatPath] || 0;
    return latest > lastSeen;
  };
  const [reportingMatch, setReportingMatch] = useState<{ matchId: string, homeName: string, awayName: string } | null>(null);
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [activeGroup, setActiveGroup] = useState('A');
  const [activeKnockoutStage, setActiveKnockoutStage] = useState<Match['stage']>('round_of_16');
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [regForm, setRegForm] = useState({ displayName: '', teamName: '', ovr: 100 });
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [matchForm, setMatchForm] = useState({ homeId: '', awayId: '', stage: 'group' as Match['stage'], group: 'A' });
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [scoreForm, setScoreForm] = useState({ home: 0, away: 0 });

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

  const MatchCard = ({ match, participants, onEdit, isAdmin, userParticipant, onChat, onReport, onApprove }: { 
    match: Match, 
    participants: Participant[], 
    onEdit: () => void, 
    isAdmin: boolean,
    userParticipant?: Participant,
    onChat: (matchId: string, homeName: string, awayName: string) => void,
    onReport: (matchId: string, homeName: string, awayName: string) => void,
    onApprove: (match: Match) => void
  }) => {
    const home = participants.find(p => p.id === match.homeParticipantId);
    const away = participants.find(p => p.id === match.awayParticipantId);
    
    const userParticipantId = participants.find(p => p.userId === user?.uid)?.id;
    const isHome = userParticipantId === match.homeParticipantId;
    const isAway = userParticipantId === match.awayParticipantId;
    const isParticipant = isHome || isAway;

    return (
      <div className="relative bg-[#0B1221] rounded-[32px] p-6 transition-all shadow-2xl border border-white/5 group overflow-hidden">
        {/* Match Header Info */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              match.status === 'completed' ? 'bg-green-500' : 
              match.status === 'reported' ? 'bg-amber-500 animate-pulse' : 
              'bg-[#38bdf8] animate-pulse'
            }`}></div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">
              {match.stage.replace('_', ' ')} {match.group ? `· Group ${match.group}` : ''}
            </span>
          </div>
          {isAdmin && (
            <button onClick={onEdit} className="p-2 hover:bg-white/5 rounded-xl transition-all text-zinc-500 hover:text-white">
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* The Duel Visualization */}
        <div className="flex items-start justify-between gap-4 mb-8">
          {/* Home Player */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 italic">Home</span>
            <div className="relative group/avatar">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[28px] bg-white/5 border-2 border-white/5 overflow-hidden shadow-lg transition-transform group-hover/avatar:scale-105">
                {home?.photoURL ? (
                  <img src={home.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-zinc-700" />
                  </div>
                )}
              </div>
              {match.status === 'completed' && match.homeScore! > match.awayScore! && (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-[#0B1221]">
                  <Trophy className="w-4 h-4 text-black" />
                </div>
              )}
            </div>
            <span className="text-sm font-black text-white mt-4 italic truncate w-full text-center">{home?.displayName || 'TBD'}</span>
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">{home?.ovr || '--'} OVR</span>
            
            {/* Social Links for Players */}
            {isParticipant && home?.fbLink && (
              <div className="flex gap-2 mt-3">
                <a href={home.fbLink} target="_blank" rel="noreferrer" className="p-1.5 bg-[#1877F2]/10 rounded-lg hover:bg-[#1877F2]/20 text-[#1877F2] transition-all" title="Facebook Profile">
                  <Facebook className="w-3.5 h-3.5" />
                </a>
                <a href={`https://m.me/${home.fbLink.replace(/\/$/, '').split('/').pop()}`} target="_blank" rel="noreferrer" className="p-1.5 bg-[#00B2FF]/10 rounded-lg hover:bg-[#00B2FF]/20 text-[#00B2FF] transition-all" title="Messenger">
                  <MessageSquare className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Center VS & Score/Timer */}
          <div className="flex flex-col items-center justify-center pt-8">
            {match.status === 'completed' || match.status === 'reported' ? (
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl sm:text-4xl font-black text-white italic">{match.homeScore}</span>
                <span className="text-sm font-black text-zinc-700 italic">VS</span>
                <span className="text-3xl sm:text-4xl font-black text-white italic">{match.awayScore}</span>
              </div>
            ) : (
              <span className="text-4xl sm:text-5xl font-black text-white/10 italic mb-2 tracking-tighter">VS</span>
            )}

            {match.status === 'scheduled' && (
              <MatchCountdown deadline={match.scheduledTime} />
            )}

            {match.status === 'completed' && (
              <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                <span className="text-[8px] font-black text-green-500 uppercase tracking-widest italic">Completed</span>
              </div>
            )}
          </div>

          {/* Away Player */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            <span className="text-[10px] font-black text-[#38bdf8] uppercase tracking-widest mb-3 italic">Away</span>
            <div className="relative group/avatar">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[28px] bg-white/5 border-2 border-white/5 overflow-hidden shadow-lg transition-transform group-hover/avatar:scale-105">
                {away?.photoURL ? (
                  <img src={away.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-zinc-700" />
                  </div>
                )}
              </div>
              {match.status === 'completed' && match.awayScore! > match.homeScore! && (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-[#0B1221]">
                  <Trophy className="w-4 h-4 text-black" />
                </div>
              )}
            </div>
            <span className="text-sm font-black text-white mt-4 italic truncate w-full text-center">{away?.displayName || 'TBD'}</span>
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">{away?.ovr || '--'} OVR</span>
            
            {/* Social Links for Players */}
            {isParticipant && away?.fbLink && (
              <div className="flex gap-2 mt-3">
                <a href={away.fbLink} target="_blank" rel="noreferrer" className="p-1.5 bg-[#1877F2]/10 rounded-lg hover:bg-[#1877F2]/20 text-[#1877F2] transition-all" title="Facebook Profile">
                  <Facebook className="w-3.5 h-3.5" />
                </a>
                <a href={`https://m.me/${away.fbLink.replace(/\/$/, '').split('/').pop()}`} target="_blank" rel="noreferrer" className="p-1.5 bg-[#00B2FF]/10 rounded-lg hover:bg-[#00B2FF]/20 text-[#00B2FF] transition-all" title="Messenger">
                  <MessageSquare className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Player Action Controls (Image 2 style) */}
        {isParticipant && match.status !== 'completed' && (
          <div className="space-y-4 pt-2 border-t border-white/5">
            <div className="grid grid-cols-2 gap-3">
              {match.status === 'scheduled' && isHome && (
                <button 
                  onClick={() => onReport(match.id, home?.displayName || 'TBD', away?.displayName || 'TBD')}
                  className="py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/10 flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Result
                </button>
              )}
              {match.status === 'reported' && isAway && (
                <button 
                  onClick={() => onApprove(match)}
                  className="py-4 bg-green-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic hover:bg-green-400 transition-all shadow-xl shadow-green-500/10 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirm Result
                </button>
              )}
              <button 
                onClick={() => {
                  onChat(match.id, home?.displayName || 'TBD', away?.displayName || 'TBD');
                  updateLastSeen(`chats/${tournamentId}/${match.id}`);
                }}
                className={`py-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-amber-500 border border-white/5 flex items-center justify-center gap-2 relative ${(!isHome && match.status === 'scheduled') || (!isAway && match.status === 'reported') ? 'col-span-2' : ''}`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest italic">Match Chat</span>
                {hasUnread(`chats/${tournamentId}/${match.id}`) && (
                  <span className="absolute top-3 right-3 w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Screenshots/Status for others */}
        {match.status === 'reported' && (isHome || isAdmin) && (
          <div className="mt-4 p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">Awaiting Verification</span>
            </div>
            {match.screenshotUrl && (
              <button 
                onClick={() => setViewingScreenshot(match.screenshotUrl!)}
                className="text-[9px] font-black text-amber-500 uppercase tracking-widest hover:underline"
              >
                View Proof
              </button>
            )}
          </div>
        )}
      </div>
    );
  };


  const userParticipant = participants.find(p => p.userId === user?.uid);
  const isUserRegistered = !!userParticipant;
  const isOwner = tournament?.createdBy === user?.uid;

  useEffect(() => {
    const unsubT = onSnapshot(doc(db, 'tournaments', tournamentId), (snapshot) => {
      if (snapshot.exists()) setTournament({ id: snapshot.id, ...snapshot.data() } as Tournament);
    });

    const unsubP = onSnapshot(query(collection(db, 'tournaments', tournamentId, 'participants')), (snapshot) => {
      setParticipants(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
    });

    const unsubM = onSnapshot(query(collection(db, 'tournaments', tournamentId, 'matches')), (snapshot) => {
      setMatches(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
    });

    return () => { unsubT(); unsubP(); unsubM(); };
  }, [tournamentId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("Please log in to register.");
    try {
      // Fetch user profile for validation
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const profile = userSnap.data();

      if (!profile) {
        return alert("Profile not found. Please create your profile first.");
      }

      const requiredFields = ['gameName', 'ovr', 'gameUid', 'facebookLink', 'phone'];
      const missing = requiredFields.filter(f => !profile[f]);

      if (missing.length > 0) {
        return alert(`Profile incomplete! Please complete your Profile first (missing: ${missing.join(', ')}).`);
      }

      await setDoc(doc(db, 'tournaments', tournamentId, 'participants', user.uid), {
        userId: user.uid,
        displayName: profile.gameName,
        photoURL: profile.photoURL || user.photoURL || '',
        teamName: '',
        ovr: profile.ovr,
        phone: profile.phone,
        fbLink: profile.facebookLink,
        gameUid: profile.gameUid,
        status: 'pending',
        registeredAt: serverTimestamp(),
        stats: { played: 0, won: 0, lost: 0, drawn: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
      });
      setIsRegistering(false);
      alert("Registration request sent! Awaiting admin approval.");
    } catch (error) {
      console.error(error);
      alert("Registration failed.");
    }
  };

  const handleApproveRequest = async (pId: string) => {
    if (!isAdmin && !isOwner) return;
    try {
      await updateDoc(doc(db, 'tournaments', tournamentId, 'participants', pId), {
        status: 'approved'
      });
    } catch (error) {
      alert("Failed to approve.");
    }
  };

  const handleRejectRequest = async (pId: string) => {
    if (!isAdmin && !isOwner) return;
    try {
      await deleteDoc(doc(db, 'tournaments', tournamentId, 'participants', pId));
    } catch (error) {
      alert("Failed to reject.");
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isOwner) return;
    try {
      const matchId = `match_${Date.now()}`;
      await setDoc(doc(db, 'tournaments', tournamentId, 'matches', matchId), {
        homeParticipantId: matchForm.homeId,
        awayParticipantId: matchForm.awayId,
        status: 'scheduled',
        stage: matchForm.stage,
        group: matchForm.stage === 'group' ? matchForm.group : null,
        scheduledTime: (matchForm as any).scheduledTime ? new Date((matchForm as any).scheduledTime) : serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsMatchModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `tournaments/${tournamentId}/matches`);
    }
  };

  const handleUpdateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isOwner || !editingMatchId) return;
    try {
      await updateDoc(doc(db, 'tournaments', tournamentId, 'matches', editingMatchId), {
        homeParticipantId: matchForm.homeId,
        awayParticipantId: matchForm.awayId,
        stage: matchForm.stage,
        group: matchForm.stage === 'group' ? matchForm.group : null,
        scheduledTime: (matchForm as any).scheduledTime ? new Date((matchForm as any).scheduledTime) : serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setEditingMatchId(null);
      setIsMatchModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${tournamentId}/matches/${editingMatchId}`);
    }
  };

  const handleUpdateScore = async (match: Match) => {
    if (!isAdmin && !isOwner) return;
    try {
      await updateDoc(doc(db, 'tournaments', tournamentId, 'matches', match.id), {
        homeScore: scoreForm.home,
        awayScore: scoreForm.away,
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      await updateParticipantStats(match.homeParticipantId);
      await updateParticipantStats(match.awayParticipantId);
      setEditingMatchId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${tournamentId}/matches/${match.id}`);
    }
  };

  const updateParticipantStats = async (participantId: string) => {
    const pMatches = matches.filter(m => m.status === 'completed' && (m.homeParticipantId === participantId || m.awayParticipantId === participantId));
    let stats = { played: 0, won: 0, lost: 0, drawn: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    pMatches.forEach(m => {
      const isHome = m.homeParticipantId === participantId;
      const myScore = isHome ? m.homeScore! : m.awayScore!;
      const opScore = isHome ? m.awayScore! : m.homeScore!;
      stats.played++;
      stats.goalsFor += myScore;
      stats.goalsAgainst += opScore;
      if (myScore > opScore) { stats.won++; stats.points += 3; }
      else if (myScore < opScore) { stats.lost++; }
      else { stats.drawn++; stats.points += 1; }
    });
    await updateDoc(doc(db, 'tournaments', tournamentId, 'participants', participantId), { stats });
  };

  const handleApproveResult = async (match: Match) => {
    try {
      await updateDoc(doc(db, 'tournaments', tournamentId, 'matches', match.id), {
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      await updateParticipantStats(match.homeParticipantId);
      await updateParticipantStats(match.awayParticipantId);
      alert("Match result verified and published!");
    } catch (error) {
      console.error(error);
      alert("Failed to approve result.");
    }
  };

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const knockoutStages: Match['stage'][] = ['round_of_32' as any, 'round_of_16', 'quarter_final', 'semi_final', 'final'];

  const approvedParticipants = participants.filter(p => p.status === 'approved');
  const pendingRequests = participants.filter(p => p.status === 'pending');

  const getGroupParticipants = (group: string) => {
    return approvedParticipants
      .filter(p => p.group === group)
      .sort((a, b) => (b.stats?.points || 0) - (a.stats?.points || 0) || ((b.stats?.goalsFor || 0) - (b.stats?.goalsAgainst || 0)) - ((a.stats?.goalsFor || 0) - (a.stats?.goalsAgainst || 0)));
  };

  if (!tournament) return null;

  return (
    <div className="space-y-6">
      {/* Tournament Sub-Hero Overlay */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 sm:gap-6 pt-2">
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-amber-500 italic">FC Arena Invitational · 2026</span>
            <button 
              onClick={() => {
                setActiveMatchChat({ matchId: 'global', homeName: 'TOURNAMENT', awayName: 'GLOBAL CHAT', isGlobal: true });
                updateLastSeen(`chats/${tournamentId}/global`);
              }}
              className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-all text-amber-500 border border-amber-500/20 relative group"
              title="Global Tournament Chat"
            >
              <MessageSquare className="w-3 h-3" />
              {hasUnread(`chats/${tournamentId}/global`) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-black animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              )}
            </button>
          </div>
          <h1 className="font-display text-[32px] font-black text-white uppercase italic tracking-tighter leading-none mt-1">
            {activeTab === 'group' ? 'Group Stage' : activeTab === 'knockout' ? 'Knockout Stage' : activeTab === 'players' ? 'Athletes' : activeTab === 'admin' ? 'Command Center' : 'Registration'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* User Registration Status */}
          {userParticipant ? (
            <div className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border shadow-sm rgb-border ${
              userParticipant.status === 'approved' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 
              userParticipant.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
              'bg-red-500/10 border-red-500/20 text-red-500'
            }`}>
              {userParticipant.status === 'approved' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              <span className="text-[10px] font-black tracking-widest uppercase italic">
                {userParticipant.status === 'approved' ? 'Joined' : 'Pending'}
              </span>
            </div>
          ) : tournament.status === 'upcoming' && (
            <button 
              onClick={handleRegister}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic shadow-xl shadow-amber-500/20 hover:scale-105 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Join Tournament
            </button>
          )}

          <button 
            onClick={() => {
              navigator.clipboard.writeText(tournamentId);
              alert("Arena ID copied to clipboard!");
            }}
            className="flex items-center gap-2 bg-white/5 px-4 py-2.5 rounded-2xl border border-white/5 shadow-sm text-zinc-500 hover:text-white transition-all group"
          >
            <span className="text-[9px] font-black tracking-widest uppercase italic opacity-50 font-mono">ID: {tournamentId.slice(0, 8)}</span>
            <div className="w-px h-3 bg-white/10 mx-1"></div>
            <span className="text-[9px] font-black tracking-widest uppercase italic group-hover:text-amber-500">Copy</span>
          </button>
        </div>
      </div>

      {/* Segmented Filter Selector */}
      <div className="flex p-1.5 bg-white/5 rounded-2xl gap-1.5 border border-white/5 shadow-inner rgb-border overflow-x-auto no-scrollbar">
        {[
          { id: 'group', label: 'Arena', icon: LayoutGrid },
          { id: 'knockout', label: 'Bracket', icon: GitMerge },
          { id: 'ranking', label: 'Ranking', icon: Trophy },
          { id: 'players', label: 'Athletes', icon: ListOrdered },
          { id: 'rules', label: 'Rules', icon: FileText },
          ...(isAdmin || isOwner ? [{ id: 'requests', label: `Requests (${pendingRequests.length})`, icon: UserPlus }] : []),
          ...(isAdmin || isOwner ? [{ id: 'admin', label: 'Control', icon: Shield }] : [])
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[80px] sm:min-w-0 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all italic ${
              activeTab === tab.id ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-8 pb-12">
        {activeTab === 'group' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Group Tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {groups.map(g => (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all italic ${
                    activeGroup === g ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-zinc-500 bg-white/5 border border-white/5'
                  }`}
                >
                  Group {g}
                </button>
              ))}
            </div>

            {/* Standings Table Elite */}
            <div className="bg-white/5 rounded-[32px] overflow-x-auto no-scrollbar border border-white/5 shadow-2xl rgb-border">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-12 px-6 py-4 bg-black/40 text-zinc-500 font-black text-[9px] tracking-widest uppercase italic border-b border-white/5">
                  <div className="col-span-1 text-center">POS</div>
                  <div className="col-span-5">ELITE PLAYER</div>
                  <div className="col-span-1 text-center">P</div>
                  <div className="col-span-1 text-center">W</div>
                  <div className="col-span-1 text-center">D</div>
                  <div className="col-span-1 text-center">L</div>
                  <div className="col-span-1 text-right">GD</div>
                  <div className="col-span-1 text-right pr-2 text-amber-500">PTS</div>
                </div>
                <div className="divide-y divide-white/5">
                  {getGroupParticipants(activeGroup).map((p, i) => (
                    <div key={`group-p-${p.id}`} className="grid grid-cols-12 px-6 py-5 items-center hover:bg-white/5 transition-all group">
                      <div className="col-span-1 flex items-center justify-center">
                        <span className={`text-[16px] font-black italic ${i < 2 ? 'text-amber-500' : 'text-zinc-600'}`}>{i + 1}</span>
                      </div>
                      <div className="col-span-5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 flex-shrink-0">
                          <Users className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-black text-white truncate italic">{p.displayName}</span>
                          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest truncate">{p.teamName} · {p.ovr} OVR</span>
                        </div>
                      </div>
                      <div className="col-span-1 text-center text-xs font-black text-zinc-500 italic">{p.stats?.played || 0}</div>
                      <div className="col-span-1 text-center text-xs font-black text-zinc-300 italic">{p.stats?.won || 0}</div>
                      <div className="col-span-1 text-center text-xs font-black text-zinc-500 italic">{p.stats?.drawn || 0}</div>
                      <div className="col-span-1 text-center text-xs font-black text-zinc-500 italic">{p.stats?.lost || 0}</div>
                      <div className="col-span-1 text-right text-xs font-black text-zinc-300 italic">{(p.stats?.goalsFor || 0) - (p.stats?.goalsAgainst || 0)}</div>
                      <div className="col-span-1 text-right pr-2 text-sm font-black text-amber-500 italic">{p.stats?.points || 0}</div>
                    </div>
                  ))}
                  {getGroupParticipants(activeGroup).length === 0 && (
                    <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-zinc-700 italic">No participants in this group yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* Group Fixtures */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">Group Fixtures</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.filter(m => m.stage === 'group' && m.group === activeGroup).map(m => (
                  <MatchCard 
                    key={`group-${m.id}`} 
                    match={m} 
                    participants={participants} 
                    onEdit={() => { 
                      setEditingMatchId(m.id); 
                      setMatchForm({ 
                        homeId: m.homeParticipantId, 
                        awayId: m.awayParticipantId, 
                        stage: m.stage, 
                        group: m.group || 'A',
                        scheduledTime: m.scheduledTime ? (m.scheduledTime.seconds ? new Date(m.scheduledTime.seconds * 1000).toISOString().slice(0, 16) : new Date(m.scheduledTime).toISOString().slice(0, 16)) : ''
                      } as any);
                      setIsMatchModalOpen(true);
                    }} 
                    isAdmin={isAdmin || isOwner} 
                    userParticipant={userParticipant}
                    onChat={(matchId, homeName, awayName) => setActiveMatchChat({ matchId, homeName, awayName })}
                    onReport={(matchId, homeName, awayName) => setReportingMatch({ matchId, homeName, awayName })}
                    onApprove={handleApproveResult}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'knockout' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 snap-x">
              {knockoutStages.map(stage => (
                <div key={stage} className="flex-none w-[300px] snap-start space-y-6">
                  <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/5 rounded-2xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white italic">
                      {stage.replace('_', ' ')}
                    </h3>
                    <span className="ml-auto text-[9px] font-black text-zinc-600 bg-black/20 px-2 py-0.5 rounded italic">
                      {matches.filter(m => m.stage === stage).length} MATCHES
                    </span>
                  </div>
                  
                  <div className="space-y-4 px-1">
                    {matches.filter(m => m.stage === stage).map(m => (
                      <MatchCard 
                        key={`knockout-${m.id}`} 
                        match={m} 
                        participants={participants} 
                        onEdit={() => { 
                          setEditingMatchId(m.id); 
                          setMatchForm({ 
                            homeId: m.homeParticipantId, 
                            awayId: m.awayParticipantId, 
                            stage: m.stage, 
                            group: m.group || 'A',
                            scheduledTime: m.scheduledTime ? (m.scheduledTime.seconds ? new Date(m.scheduledTime.seconds * 1000).toISOString().slice(0, 16) : new Date(m.scheduledTime).toISOString().slice(0, 16)) : ''
                          } as any);
                          setIsMatchModalOpen(true);
                        }} 
                        isAdmin={isAdmin || isOwner} 
                        userParticipant={userParticipant}
                        onChat={(matchId, homeName, awayName) => setActiveMatchChat({ matchId, homeName, awayName })}
                        onReport={(matchId, homeName, awayName) => setReportingMatch({ matchId, homeName, awayName })}
                        onApprove={handleApproveResult}
                      />
                    ))}
                    {matches.filter(m => m.stage === stage).length === 0 && (
                      <div className="py-20 border border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-center px-6">
                        <Clock className="w-6 h-6 text-zinc-800 mb-3" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-700 italic">Waiting for Qualifiers</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'ranking' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white/5 border border-white/5 rounded-[40px] overflow-x-auto no-scrollbar shadow-2xl rgb-border">
              <div className="min-w-[700px]">
                <div className="p-8 border-b border-white/5 bg-black/20 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-display font-black text-white uppercase italic tracking-tight">Arena Ranking</h3>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Global performance leaderboard · 2026</p>
                  </div>
                  <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                    <Trophy className="w-6 h-6 text-amber-500" />
                  </div>
                </div>
                
                <div className="p-2">
                  <div className="grid grid-cols-12 px-6 py-4 text-zinc-500 font-black text-[9px] tracking-widest uppercase italic border-b border-white/5">
                    <div className="col-span-1 text-center">RANK</div>
                    <div className="col-span-5">ELITE PLAYER</div>
                    <div className="col-span-2 text-center">RATING</div>
                    <div className="col-span-2 text-center">RECORD</div>
                    <div className="col-span-2 text-right pr-4">ARENA PTS</div>
                  </div>
                  
                  <div className="divide-y divide-white/5">
                    {approvedParticipants
                      .map(p => {
                        // Calculate Performance Score (Elite Rating)
                        let eliteScore = (p.stats?.points || 0) * 10; // Base points from wins/draws
                        
                        // Filter all matches where this player was involved and AI scanned stats exist
                        const playerMatches = matches.filter(m => 
                          (m.status === 'reported' || m.status === 'completed') && 
                          (m.homeId === p.id || m.awayId === p.id) &&
                          m.stats
                        );

                        playerMatches.forEach(m => {
                          const isHome = m.homeId === p.id;
                          const s = isHome ? m.stats?.home : m.stats?.away;
                          if (s) {
                            // Performance multipliers
                            eliteScore += (isHome ? (m.homeScore || 0) : (m.awayScore || 0)) * 2; // Goals bonus
                            eliteScore += (Number(s.possession) || 0) / 10; // Possession weight
                            eliteScore += (Number(s.passAccuracy) || 0) / 20; // Pass accuracy weight
                            
                            if (s.shots && typeof s.shots === 'string') {
                              const match = s.shots.match(/\((\d+)\)/);
                              const onGoal = match ? parseInt(match[1]) : 0;
                              eliteScore += onGoal * 1.5; // Precision shots bonus
                            }
                          }
                        });

                        return { ...p, eliteScore };
                      })
                      .filter(p => (p.stats?.played || 0) > 0)
                      .sort((a, b) => (b.eliteScore || 0) - (a.eliteScore || 0))
                      .map((p, i) => (
                        <motion.div 
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                          key={`ranking-${p.id}`} 
                          className={`grid grid-cols-12 px-6 py-6 items-center hover:bg-white/5 transition-all group relative ${i === 0 ? 'bg-amber-500/5' : ''}`}
                        >
                          <div className="col-span-1 flex items-center justify-center relative">
                            {i < 3 ? (
                              <div className="relative">
                                <span className={`text-3xl font-black italic ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-zinc-300' : 'text-amber-700'}`}>{i + 1}</span>
                                <div className="absolute -top-4 -left-4">
                                  <Trophy className={`w-4 h-4 ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-zinc-300' : 'text-amber-700'} opacity-20`} />
                                </div>
                              </div>
                            ) : (
                              <span className="text-xl font-black italic text-zinc-700">{i + 1}</span>
                            )}
                          </div>
                          
                          <div className="col-span-5 flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all flex-shrink-0 ${i === 0 ? 'bg-amber-500/20 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
                              {p.photoURL ? (
                                <img src={p.photoURL} alt="" className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                <Users className={`w-6 h-6 ${i === 0 ? 'text-amber-500' : 'text-zinc-600'}`} />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className={`text-lg font-black italic truncate ${i === 0 ? 'text-amber-500' : 'text-white'}`}>{p.displayName}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest truncate">{p.teamName || 'NO CLUB'}</span>
                                <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, starI) => {
                                    const rating = (p.eliteScore / (p.stats?.played || 1) / 100) * 5;
                                    return (
                                      <Zap key={starI} className={`w-2 h-2 ${starI < Math.round(rating || 1) ? 'text-amber-500' : 'text-zinc-800'}`} />
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="col-span-2 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="text-sm font-black text-white italic">{p.ovr}</span>
                              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">OVR RATING</span>
                            </div>
                          </div>
                          
                          <div className="col-span-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-xs font-black text-green-500 italic">{p.stats?.won || 0}W</span>
                              <span className="text-[10px] text-zinc-700">/</span>
                              <span className="text-xs font-black text-red-500 italic">{p.stats?.lost || 0}L</span>
                            </div>
                          </div>
                          
                          <div className="col-span-2 text-right pr-4">
                            <div className="flex flex-col items-end">
                              <span className="text-2xl font-black text-amber-500 italic leading-none">{Math.round(p.eliteScore || 0)}</span>
                              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1">ARENA RATING</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      
                    {approvedParticipants.filter(p => (p.stats?.played || 0) > 0).length === 0 && (
                      <div className="p-24 text-center space-y-4">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-dashed border-white/10">
                          <Trophy className="w-8 h-8 text-zinc-800" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-zinc-700 italic">Ranking data will appear once match results are verified by AI</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl flex items-start gap-4">
              <Zap className="w-6 h-6 text-amber-500 mt-1" />
              <div>
                <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest italic mb-1">How Ranking Works</p>
                <p className="text-[10px] font-medium text-amber-500/60 leading-relaxed italic">The Arena Ranking system calculates your standing based on verified AI match results. Win matches to earn 3 points, draws earn 1 point. Top ranked players qualify for Elite seasonal rewards.</p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'players' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {approvedParticipants.map(p => (
              <div key={`players-${p.id}`} className="bg-white/5 border border-white/5 rounded-[28px] p-6 flex items-center justify-between group hover:border-amber-500/30 transition-all shadow-xl rgb-border">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-black text-black italic text-lg shadow-lg shadow-amber-500/10">
                    {p.displayName.substring(0, 1)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white italic">{p.displayName}</span>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">{p.teamName} · {p.ovr} OVR</span>
                  </div>
                </div>
                {p.group && <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded italic">GP {p.group}</span>}
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'requests' && (isAdmin || isOwner) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-6">
            {pendingRequests.length === 0 ? (
              <div className="py-20 bg-white/5 rounded-[40px] border border-dashed border-white/5 flex flex-col items-center justify-center text-center">
                <Clock className="w-10 h-10 text-zinc-800 mb-4" />
                <h3 className="text-xl font-black text-white/20 uppercase italic">No Pending Requests</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pendingRequests.map(p => (
                  <div key={`req-${p.id}`} className="bg-white/5 border border-white/5 rounded-[32px] p-8 shadow-2xl space-y-6 rgb-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center font-black text-black italic text-2xl">
                          {p.displayName.substring(0, 1)}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-white italic">{p.displayName}</h3>
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">Requesting Access</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">OVR</span>
                        <p className="text-xl font-black text-white italic leading-none">{p.ovr}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1 italic">FC UID</p>
                        <p className="text-[11px] font-bold text-white font-mono truncate">{p.gameUid || '---'}</p>
                      </div>
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1 italic">Phone</p>
                        <p className="text-[11px] font-bold text-white font-mono">{p.phone || '---'}</p>
                      </div>
                    </div>

                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-2 italic">Facebook Verification</p>
                      <a href={p.fbLink} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-amber-500 italic flex items-center gap-2 hover:underline">
                        Visit Profile <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleRejectRequest(p.id)}
                        className="flex-1 py-4 bg-white/5 text-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] italic hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                      >
                        Decline
                      </button>
                      <button 
                        onClick={() => handleApproveRequest(p.id)}
                        className="flex-[2] py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Grant Access
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'admin' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-white/5 border border-white/5 rounded-[40px] p-10 shadow-2xl rgb-border">
                <h3 className="text-2xl font-display font-black text-white uppercase italic italic tracking-tight mb-8">Deploy Control</h3>
                <div className="space-y-6">
                  <button onClick={() => setIsMatchModalOpen(true)} className="w-full h-16 bg-amber-500 text-black rounded-[24px] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-amber-500/10 italic hover:bg-amber-400 transition-all flex items-center justify-center gap-3">
                    <Plus className="w-5 h-5" />
                    New Match Deployment
                  </button>
                  <div className="p-6 bg-black/20 rounded-3xl border border-white/5 space-y-4">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Tournament Status</p>
                    <div className="flex gap-2">
                      {['upcoming', 'ongoing', 'completed'].map(s => (
                        <button key={s} onClick={async () => await updateDoc(doc(db, 'tournaments', tournamentId), { status: s })} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest italic transition-all ${tournament.status === s ? 'bg-white text-black' : 'bg-white/5 text-zinc-500 hover:text-white'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
             </div>
             
             <div className="bg-white/5 border border-white/5 rounded-[40px] p-10 shadow-2xl rgb-border">
                <h3 className="text-2xl font-display font-black text-white uppercase italic italic tracking-tight mb-8">Arena Logistics</h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                  {approvedParticipants.map(p => (
                    <div key={`admin-${p.id}`} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 group">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-white italic">{p.displayName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-zinc-600 italic uppercase">Group Assignment</span>
                          {p.phone && <span className="text-[9px] font-black text-amber-500/50 italic select-all">| {p.phone}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select 
                          value={p.group || ''}
                          onChange={async (e) => await updateDoc(doc(db, 'tournaments', tournamentId, 'participants', p.id), { group: e.target.value })}
                          className="bg-[#1A2233] border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black text-amber-500 uppercase tracking-widest outline-none italic"
                        >
                          <option value="">NONE</option>
                          {groups.map(g => <option key={g} value={g}>GP {g}</option>)}
                        </select>
                        <button onClick={async () => confirm('Eject player?') && await deleteDoc(doc(db, 'tournaments', tournamentId, 'participants', p.id))} className="p-2 text-zinc-700 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </motion.div>
        )}
      </div>

      {/* Forms & Modals Elite */}
      <AnimatePresence>
        {activeMatchChat && (
          <MatchChat 
            tournamentId={tournamentId}
            matchId={activeMatchChat.matchId}
            homePlayerName={activeMatchChat.homeName}
            awayPlayerName={activeMatchChat.awayName}
            participants={participants}
            onClose={() => setActiveMatchChat(null)}
          />
        )}

        {reportingMatch && (
          <ResultReportModal 
            tournamentId={tournamentId}
            matchId={reportingMatch.matchId}
            homePlayerName={reportingMatch.homeName}
            awayPlayerName={reportingMatch.awayName}
            onClose={() => setReportingMatch(null)}
          />
        )}

        {viewingScreenshot && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setViewingScreenshot(null)} 
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }} 
              className="relative max-w-4xl w-full flex flex-col items-center gap-6"
            >
              <img src={viewingScreenshot} alt="Result Proof" className="w-full h-auto max-h-[80vh] object-contain rounded-3xl border border-white/10 shadow-2xl" />
              <button 
                onClick={() => setViewingScreenshot(null)}
                className="px-8 py-3 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs italic shadow-xl shadow-amber-500/20"
              >
                Close Preview
              </button>
            </motion.div>
          </div>
        )}
        {isRegistering && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRegistering(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-[#1A2233] border border-white/10 rounded-[40px] w-full max-w-md p-10 shadow-2xl">
               <h2 className="text-2xl font-black text-white mb-8 uppercase italic italic tracking-tight">Arena Registration</h2>
               <form onSubmit={handleRegister} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Agent Alias</label>
                    <input required type="text" value={regForm.displayName} onChange={e => setRegForm({...regForm, displayName: e.target.value})} className="w-full h-14 px-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-amber-500" placeholder={user?.displayName || 'In-game Name'} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Elite Team Name</label>
                    <input required type="text" value={regForm.teamName} onChange={e => setRegForm({...regForm, teamName: e.target.value})} className="w-full h-14 px-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-amber-500" placeholder="e.g. Blue Titans" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Current Team OVR</label>
                    <input required type="number" min="60" max="150" value={regForm.ovr} onChange={e => setRegForm({...regForm, ovr: parseInt(e.target.value) || 100})} className="w-full h-14 px-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-amber-500" />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsRegistering(false)} className="flex-1 py-4 text-zinc-500 font-black uppercase tracking-widest text-[10px] italic">Cancel</button>
                    <button className="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic shadow-xl shadow-amber-500/10">Deploy</button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}

        {isMatchModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsMatchModalOpen(false); setEditingMatchId(null); }} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-[#1A2233] border border-white/10 rounded-[40px] w-full max-w-lg p-10 shadow-2xl">
               <h2 className="text-2xl font-black text-white mb-8 uppercase italic italic tracking-tight">{editingMatchId ? 'Update Match Logistics' : 'Deploy New Match'}</h2>
               <form onSubmit={editingMatchId ? handleUpdateMatch : handleCreateMatch} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Stage</label>
                      <select required value={matchForm.stage} onChange={e => setMatchForm({...matchForm, stage: e.target.value as any})} className="w-full h-14 px-5 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none">
                        <option value="group">Group Stage</option>
                        <option value="round_of_32">Round of 32</option>
                        <option value="round_of_16">Round of 16</option>
                        <option value="quarter_final">Quarter Finals</option>
                        <option value="semi_final">Semi Finals</option>
                        <option value="final">Final</option>
                      </select>
                    </div>
                    {matchForm.stage === 'group' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Group</label>
                        <select required value={matchForm.group} onChange={e => setMatchForm({...matchForm, group: e.target.value})} className="w-full h-14 px-5 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none">
                          {groups.map(g => <option key={g} value={g}>Group {g}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Home Contender</label>
                    <select required value={matchForm.homeId} onChange={e => setMatchForm({...matchForm, homeId: e.target.value})} className="w-full h-14 px-5 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none">
                      <option value="">Select Home</option>
                      {participants.map(p => <option key={p.id} value={p.id}>{p.displayName} {p.group ? `(GP ${p.group})` : ''}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Away Contender</label>
                    <select required value={matchForm.awayId} onChange={e => setMatchForm({...matchForm, awayId: e.target.value})} className="w-full h-14 px-5 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none">
                      <option value="">Select Away</option>
                      {participants.map(p => <option key={p.id} value={p.id}>{p.displayName} {p.group ? `(GP ${p.group})` : ''}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Match Deadline (Timer Target)</label>
                    <input 
                      required
                      type="datetime-local" 
                      value={(matchForm as any).scheduledTime || ''} 
                      onChange={e => setMatchForm({...matchForm, scheduledTime: e.target.value} as any)} 
                      className="w-full h-14 px-5 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => { setIsMatchModalOpen(false); setEditingMatchId(null); }} className="flex-1 py-4 text-zinc-500 font-black uppercase tracking-widest text-[10px] italic">Cancel</button>
                    <button className="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic shadow-xl shadow-amber-500/10">
                      {editingMatchId ? 'Update' : 'Deploy'}
                    </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}

        {editingMatchId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingMatchId(null)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-[#1A2233] border border-white/10 rounded-[40px] w-full max-w-sm p-10 shadow-2xl">
               <h2 className="text-xl font-black text-white mb-10 text-center uppercase italic">Update Arena Results</h2>
               <div className="flex items-center justify-between gap-6 mb-10">
                  <div className="flex-1 text-center">
                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-3 tracking-widest italic">Home</p>
                    <input type="number" value={scoreForm.home} onChange={e => setScoreForm({...scoreForm, home: parseInt(e.target.value) || 0})} className="w-full py-6 text-5xl font-black text-center bg-black/20 border border-white/5 rounded-2xl text-white italic outline-none focus:ring-1 focus:ring-amber-500" />
                  </div>
                  <div className="text-zinc-800 font-black text-2xl pt-8 italic">:</div>
                  <div className="flex-1 text-center">
                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-3 tracking-widest italic">Away</p>
                    <input type="number" value={scoreForm.away} onChange={e => setScoreForm({...scoreForm, away: parseInt(e.target.value) || 0})} className="w-full py-6 text-5xl font-black text-center bg-black/20 border border-white/5 rounded-2xl text-white italic outline-none focus:ring-1 focus:ring-amber-500" />
                  </div>
               </div>
               <div className="flex gap-4">
                  <button onClick={() => setEditingMatchId(null)} className="flex-1 py-4 text-zinc-500 font-black uppercase tracking-widest text-[10px] italic">Cancel</button>
                  <button onClick={() => { const m = matches.find(m => m.id === editingMatchId); if(m) handleUpdateScore(m); }} className="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic shadow-xl shadow-amber-500/10">Commit</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
