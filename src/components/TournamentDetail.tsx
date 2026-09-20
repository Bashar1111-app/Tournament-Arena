import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, setDoc, serverTimestamp, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { useFirebase } from '../contexts/FirebaseContext';
import { Users, Plus, Trophy, Trash2, Edit3, X, Save, UserPlus, ChevronRight, LayoutGrid, GitMerge, ListOrdered, Tv, Shield, Zap, CheckCircle, Clock, FileText, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface Participant {
  id: string;
  userId: string;
  displayName: string;
  teamName: string;
  ovr: number;
  group?: string;
  phone?: string;
  fbLink?: string;
  gameUid?: string;
  status: 'pending' | 'approved' | 'rejected';
  registeredAt: any;
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
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'completed';
  stage: 'group' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'final';
  group?: string;
  updatedAt?: any;
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
  const [activeTab, setActiveTab] = useState<'group' | 'knockout' | 'players' | 'admin' | 'requests' | 'rules'>(initialTab || 'group');

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
        updatedAt: serverTimestamp()
      });
      setIsMatchModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `tournaments/${tournamentId}/matches`);
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 italic">FC Arena Invitational · 2026</span>
          <h1 className="font-display text-[32px] font-black text-white uppercase italic tracking-tighter leading-none mt-1">
            {activeTab === 'group' ? 'Group Stage' : activeTab === 'knockout' ? 'Knockout Stage' : activeTab === 'players' ? 'Athletes' : activeTab === 'admin' ? 'Command Center' : 'Registration'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* User Registration Status */}
          {userParticipant ? (
            <div className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border shadow-sm ${
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
      <div className="flex p-1.5 bg-white/5 rounded-2xl gap-1.5 border border-white/5 shadow-inner">
        {[
          { id: 'group', label: 'Arena', icon: LayoutGrid },
          { id: 'knockout', label: 'Bracket', icon: GitMerge },
          { id: 'players', label: 'Standings', icon: ListOrdered },
          { id: 'rules', label: 'Rules', icon: FileText },
          ...(isAdmin || isOwner ? [{ id: 'requests', label: `Requests (${pendingRequests.length})`, icon: UserPlus }] : []),
          ...(isAdmin || isOwner ? [{ id: 'admin', label: 'Control', icon: Shield }] : [])
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all italic ${
              activeTab === tab.id ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
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
            <div className="bg-white/5 rounded-[32px] overflow-hidden border border-white/5 shadow-2xl">
              <div className="grid grid-cols-12 px-6 py-4 bg-black/40 text-zinc-500 font-black text-[9px] tracking-widest uppercase italic border-b border-white/5">
                <div className="col-span-2 text-center">POS</div>
                <div className="col-span-4">ELITE PLAYER</div>
                <div className="col-span-1 text-center">P</div>
                <div className="col-span-1 text-center">W</div>
                <div className="col-span-1 text-center">D</div>
                <div className="col-span-1 text-center">L</div>
                <div className="col-span-1 text-right">GD</div>
                <div className="col-span-1 text-right pr-2 text-amber-500">PTS</div>
              </div>
              <div className="divide-y divide-white/5">
                {getGroupParticipants(activeGroup).map((p, i) => (
                  <div key={p.id} className="grid grid-cols-12 px-6 py-5 items-center hover:bg-white/5 transition-all group">
                    <div className="col-span-2 flex items-center justify-center">
                      <span className={`text-[16px] font-black italic ${i < 2 ? 'text-amber-500' : 'text-zinc-600'}`}>{i + 1}</span>
                    </div>
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
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

            {/* Group Fixtures */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">Group Fixtures</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.filter(m => m.stage === 'group' && m.group === activeGroup).map(m => (
                  <MatchCard key={m.id} match={m} participants={participants} onEdit={() => { setEditingMatchId(m.id); setScoreForm({ home: m.homeScore || 0, away: m.awayScore || 0 }); }} isAdmin={isAdmin || isOwner} />
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
                        key={m.id} 
                        match={m} 
                        participants={participants} 
                        onEdit={() => { setEditingMatchId(m.id); setScoreForm({ home: m.homeScore || 0, away: m.awayScore || 0 }); }} 
                        isAdmin={isAdmin || isOwner} 
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

        {activeTab === 'rules' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
            <div className="bg-[#111827] border border-white/5 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <FileText className="w-32 h-32 text-amber-500" />
              </div>
              
              <div className="relative z-10 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                    <Shield className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Arena Protocol</h3>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Official Guidelines & Rules</p>
                  </div>
                </div>

                <div className="prose prose-invert max-w-none">
                  <div className="p-8 bg-black/40 rounded-3xl border border-white/5 min-h-[300px]">
                    {tournament.rules ? (
                      <p className="text-zinc-400 text-sm italic leading-relaxed whitespace-pre-wrap">
                        {tournament.rules}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                        <Clock className="w-10 h-10 text-zinc-800 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 italic">No specific rules have been defined for this arena.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <p className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest italic">Failure to comply with protocol may result in immediate arena disqualification.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'players' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {approvedParticipants.map(p => (
              <div key={p.id} className="bg-white/5 border border-white/5 rounded-[28px] p-6 flex items-center justify-between group hover:border-amber-500/30 transition-all shadow-xl">
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
                  <div key={p.id} className="bg-white/5 border border-white/5 rounded-[32px] p-8 shadow-2xl space-y-6">
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
             <div className="bg-white/5 border border-white/5 rounded-[40px] p-10 shadow-2xl">
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
             
             <div className="bg-white/5 border border-white/5 rounded-[40px] p-10 shadow-2xl">
                <h3 className="text-2xl font-display font-black text-white uppercase italic italic tracking-tight mb-8">Arena Logistics</h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                  {approvedParticipants.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 group">
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMatchModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-[#1A2233] border border-white/10 rounded-[40px] w-full max-w-lg p-10 shadow-2xl">
               <h2 className="text-2xl font-black text-white mb-8 uppercase italic italic tracking-tight">Deploy New Match</h2>
               <form onSubmit={handleCreateMatch} className="space-y-6">
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
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsMatchModalOpen(false)} className="flex-1 py-4 text-zinc-500 font-black uppercase tracking-widest text-[10px] italic">Cancel</button>
                    <button className="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic shadow-xl shadow-amber-500/10">Deploy</button>
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

function MatchCard({ match, participants, onEdit, isAdmin }: { match: Match, participants: Participant[], onEdit: () => void, isAdmin: boolean }) {
  const home = participants.find(p => p.id === match.homeParticipantId);
  const away = participants.find(p => p.id === match.awayParticipantId);

  return (
    <div className="relative bg-white/5 rounded-[28px] p-6 transition-all shadow-xl border border-white/5 hover:border-white/10 group overflow-hidden">
      {/* Match Status Strip */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${match.status === 'completed' ? 'bg-zinc-600' : 'bg-amber-500 animate-pulse'}`}></span>
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-500 italic">{match.stage.replace('_', ' ')} · {match.group ? `Group ${match.group}` : 'Knockout'}</span>
        </div>
        {match.status === 'completed' && (
          <div className="flex items-center gap-1.5 text-zinc-600">
            <CheckCircle className="w-3 h-3" />
            <span className="text-[8px] font-black uppercase tracking-widest">VERIFIED</span>
          </div>
        )}
      </div>

      {/* Contenders Versus Layout */}
      <div className="flex flex-col gap-3">
        {/* Home */}
        <div className={`flex items-center justify-between p-3 rounded-2xl relative ${match.status === 'completed' && match.homeScore! > match.awayScore! ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-black/20 border border-white/5'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center font-black text-amber-500 text-[10px] italic border border-white/5">
              {home?.displayName.substring(0, 1)}
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-black italic ${match.status === 'completed' && match.homeScore! > match.awayScore! ? 'text-amber-500' : 'text-white'}`}>{home?.displayName || 'TBD'}</span>
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{home?.ovr || '--'} OVR</span>
            </div>
          </div>
          <span className={`text-2xl font-black italic ${match.status === 'completed' ? (match.homeScore! > match.awayScore! ? 'text-amber-500' : 'text-zinc-500') : 'text-zinc-800'}`}>
            {match.status === 'completed' ? match.homeScore : '-'}
          </span>
        </div>

        {/* Away */}
        <div className={`flex items-center justify-between p-3 rounded-2xl relative ${match.status === 'completed' && match.awayScore! > match.homeScore! ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-black/20 border border-white/5'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center font-black text-amber-500 text-[10px] italic border border-white/5">
              {away?.displayName.substring(0, 1)}
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-black italic ${match.status === 'completed' && match.awayScore! > match.homeScore! ? 'text-amber-500' : 'text-white'}`}>{away?.displayName || 'TBD'}</span>
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{away?.ovr || '--'} OVR</span>
            </div>
          </div>
          <span className={`text-2xl font-black italic ${match.status === 'completed' ? (match.awayScore! > match.homeScore! ? 'text-amber-500' : 'text-zinc-500') : 'text-zinc-800'}`}>
            {match.status === 'completed' ? match.awayScore : '-'}
          </span>
        </div>
      </div>

      {/* Admin Quick Action */}
      {isAdmin && (
        <div className="mt-6 flex justify-end">
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-zinc-500 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest italic transition-all">
            <Edit3 className="w-3 h-3" />
            Commit Result
          </button>
        </div>
      )}
    </div>
  );
}
