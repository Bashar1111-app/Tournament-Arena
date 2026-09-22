import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { UserCircle, Trophy, Target, Shield, Clock, LogOut, Facebook, Phone, Mail, Fingerprint, Save, Edit3, Lock, Bell, Star, Zap, Camera, Loader2, Gamepad2, Send, Copy, CheckCircle2, UserCog, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc, addDoc, collection, serverTimestamp, updateDoc, query, where, collectionGroup, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import imageCompression from 'browser-image-compression';

interface UserProfileData {
  gameName: string;
  ovr: number;
  gameUid: string;
  facebookLink: string;
  phone: string;
  messengerLink?: string;
  gamePassword?: string;
  photoURL?: string;
}

function AdminNotificationManager() {
  const [content, setContent] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'success'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        content,
        type,
        active: true,
        createdAt: serverTimestamp()
      });
      setContent('');
      alert("Announcement broadcasted successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to broadcast.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea 
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Enter announcement text..."
        className="w-full h-24 p-4 bg-black/20 border border-white/5 rounded-2xl font-black text-white text-xs italic outline-none focus:ring-1 focus:ring-amber-500 resize-none"
        required
      />
      <div className="flex gap-2">
        {(['info', 'warning', 'success'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest italic border transition-all ${
              type === t 
                ? 'bg-amber-500 text-black border-amber-500' 
                : 'bg-white/5 text-zinc-500 border-white/5 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic hover:bg-zinc-200 transition-all disabled:opacity-50"
      >
        {isSubmitting ? 'Transmitting...' : 'Initiate Broadcast'}
      </button>
    </form>
  );
}

interface ProfileProps {
  onSelectTournament?: (id: string) => void;
}

export function Profile({ onSelectTournament }: ProfileProps) {
  const { user, userData, logout, isAdmin } = useFirebase();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState<UserProfileData>({
    gameName: '',
    ovr: 100,
    gameUid: '',
    facebookLink: '',
    phone: '',
    messengerLink: '',
    gamePassword: '',
    photoURL: ''
  });
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const [myTournaments, setMyTournaments] = useState<any[]>([]);
  const [joinedTournaments, setJoinedTournaments] = useState<any[]>([]);
  const [matchStats, setMatchStats] = useState({ played: 0, won: 0 });

  useEffect(() => {
    if (!user) return;

    // 1. User Profile Sync
    const profileUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setProfileData(snapshot.data() as UserProfileData);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Profile sync listener error:", err);
      setLoading(false);
    });

    // 2. Stats & Tournaments Sync
    let tournamentsUnsubscribe: (() => void) | null = null;
    let joinedUnsubscribe: (() => void) | null = null;
    let joinedDetailsUnsubscribe: (() => void) | null = null;
    let matchesUnsubscribe: (() => void) | null = null;

    if (userData?.role === 'publisher') {
      const q = query(collection(db, 'tournaments'), where('createdBy', '==', user.uid));
      tournamentsUnsubscribe = onSnapshot(q, (snapshot) => {
        setPublishedCount(snapshot.size);
        setMyTournaments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => console.warn("Publisher tournaments listener error:", err));
    }

    const joinedQ = query(collectionGroup(db, 'participants'), where('userId', '==', user.uid));
    joinedUnsubscribe = onSnapshot(joinedQ, (joinedSnapshot) => {
      const participantDocs = joinedSnapshot.docs;
      const tournamentIds = Array.from(new Set(participantDocs.map(doc => doc.ref.parent.parent?.id).filter(id => !!id)));
      const myParticipantIds = participantDocs.map(doc => doc.id);
      
      // Calculate Match Stats across joined tournaments
      if (myParticipantIds.length > 0 && tournamentIds.length > 0) {
        // We listen to matches for each tournament the user is in
        const unsubscribers: (() => void)[] = [];
        const tournamentMatches: Record<string, any[]> = {};

        tournamentIds.forEach(tId => {
          const q = query(collection(db, 'tournaments', tId, 'matches'), where('status', '==', 'completed'));
          const unsub = onSnapshot(q, (snapshot) => {
            tournamentMatches[tId] = snapshot.docs.map(doc => doc.data());
            
            // Re-calculate stats whenever any tournament matches update
            let played = 0;
            let won = 0;
            Object.values(tournamentMatches).flat().forEach(data => {
              const isParticipant = 
                (data.homeParticipantId && myParticipantIds.includes(data.homeParticipantId)) || 
                (data.awayParticipantId && myParticipantIds.includes(data.awayParticipantId));
              
              if (isParticipant) {
                played++;
                if ((data.winners || []).some((wId: string) => myParticipantIds.includes(wId))) {
                  won++;
                }
              }
            });
            setMatchStats({ played, won });
          }, (err) => console.warn(`Match stats listener error for ${tId}:`, err));
          unsubscribers.push(unsub);
        });
        
        matchesUnsubscribe = () => unsubscribers.forEach(unsub => unsub());
      }
      
      // Unsubscribe from previous details listener if any
      if (joinedDetailsUnsubscribe) joinedDetailsUnsubscribe();

      if (tournamentIds.length > 0) {
        const tourneysQ = query(collection(db, 'tournaments'), where('__name__', 'in', tournamentIds.slice(0, 10)));
        joinedDetailsUnsubscribe = onSnapshot(tourneysQ, (tourneysSnapshot) => {
          setJoinedTournaments(tourneysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => console.warn("Joined tournaments details listener error:", err));
      } else {
        setJoinedTournaments([]);
      }
    }, (err) => console.warn("Joined tournaments mapping listener error:", err));

    return () => {
      profileUnsubscribe();
      if (tournamentsUnsubscribe) tournamentsUnsubscribe();
      if (joinedUnsubscribe) joinedUnsubscribe();
      if (joinedDetailsUnsubscribe) joinedDetailsUnsubscribe();
      if (matchesUnsubscribe) matchesUnsubscribe();
    };
  }, [user, userData]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const options = {
        maxSizeMB: 0.1, // Approximately 100 KB
        maxWidthOrHeight: 500,
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(file, options);
      const base64 = await imageCompression.getDataUrlFromFile(compressedFile);
      
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: base64
      });
      
      setProfileData(prev => ({ ...prev, photoURL: base64 }));
    } catch (error) {
      console.error("Compression/Upload error:", error);
      alert("Failed to process image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
      setIsEditing(false);
    } catch (error) {
      alert("Failed to update profile. Please check permissions.");
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
          <UserCircle className="w-10 h-10 text-zinc-700" />
        </div>
        <h2 className="text-2xl font-display font-black text-white uppercase italic mb-2">Private Arena</h2>
        <p className="text-zinc-500 text-sm max-w-xs italic mb-8">Sign in to view your career statistics and elite achievements.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto space-y-12 pb-20 pt-24"
    >
      {/* Modern Gaming Profile Card Based on New Screenshot */}
      <div className="relative bg-[#0B1221] border border-white/10 rounded-[56px] p-8 pt-24 shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
        
        {/* Floating Stars with Glow (as seen in image) */}
        <div className="absolute top-20 -left-6 text-red-500/40 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse">★</div>
        <div className="absolute top-40 -left-2 text-red-500/20 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-bounce text-xs" style={{ animationDelay: '1s' }}>★</div>
        <div className="absolute top-10 -right-4 text-red-500/40 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse">★</div>
        <div className="absolute top-32 -right-8 text-red-500/30 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-bounce" style={{ animationDelay: '0.5s' }}>★</div>

        {/* Profile Picture Header Block */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 flex flex-col items-center">
          <div className="relative w-full aspect-square bg-gradient-to-br from-[#FF2D55] to-[#D4002D] rounded-[48px] shadow-[0_20px_40px_rgba(255,45,85,0.3)] p-1 flex items-center justify-center group overflow-visible">
            <div className="relative w-[75%] aspect-square rounded-full border-4 border-black bg-zinc-900 overflow-hidden shadow-2xl">
              {isUploading ? (
                <div className="w-full h-full flex items-center justify-center bg-black/60">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              ) : (profileData.photoURL || user.photoURL) ? (
                <img src={profileData.photoURL || user.photoURL || ''} alt="Profile" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                  <UserCircle className="w-12 h-12" />
                </div>
              )}
              {/* Online Status Dot on Avatar */}
              <div className="absolute bottom-[15%] right-[15%] w-3 h-3 bg-emerald-400 rounded-full border-2 border-black shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
              
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => document.getElementById('photo-upload')?.click()}>
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            
            {/* Label below avatar - Only show if no photo exists */}
            {!(profileData.photoURL || user.photoURL) && (
              <div className="absolute bottom-10 text-[8px] font-black text-white/50 uppercase tracking-[0.2em] text-center leading-tight">
                PLAYER PROFILE<br/>PICTURE
              </div>
            )}

            {/* Cyan Ribbon Name Badge */}
            <div className="absolute -bottom-4 w-[115%] h-11 bg-cyan-400 rounded-2xl flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(34,211,238,0.4)] border-b-4 border-cyan-500 overflow-hidden group/name px-2">
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_3s_infinite]"></div>
               <span className="relative text-black font-black uppercase tracking-tighter text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[85%]">
                 {profileData.gameName || user.displayName || 'LEGEND'}
               </span>
               <div className="relative w-4 h-4 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                 <CheckCircle2 className="w-2.5 h-2.5 text-white" />
               </div>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="mt-12 flex flex-col items-center space-y-8">
          
          {/* Elite OVR Badge */}
          <div className="bg-[#1A2233]/80 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/5 flex items-center gap-2 shadow-inner group">
             <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 group-hover:rotate-45 transition-transform" />
             <span className="text-white font-black text-xs tracking-widest italic uppercase">
               {profileData.ovr} OVR
             </span>
          </div>

          {/* Info Sections */}
          <div className="w-full space-y-6">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-2">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">GAME I'D NAME</span>
                <span className="text-[8px] font-black text-indigo-500/60 uppercase tracking-widest italic">Active Tag</span>
              </div>
              <div 
                onClick={() => copyToClipboard(profileData.gameName, 'Game Name')}
                className="w-full h-16 bg-[#1A2233] border border-white/10 rounded-2xl flex items-center justify-between px-6 cursor-pointer group hover:border-amber-500/30 transition-all shadow-lg"
              >
                <span className="text-sm font-black text-white italic tracking-wide">{profileData.gameName || '---'}</span>
                <Copy className="w-4 h-4 text-zinc-600 group-hover:text-amber-500 transition-colors" />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-2">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">GAME I'D</span>
                <span className="text-[8px] font-black text-zinc-500/40 uppercase tracking-widest italic">UID</span>
              </div>
              <div 
                onClick={() => copyToClipboard(profileData.gameUid, 'Game ID')}
                className="w-full h-16 bg-[#1A2233] border border-white/10 rounded-2xl flex items-center justify-between px-6 cursor-pointer group hover:border-[#38bdf8]/30 transition-all shadow-lg"
              >
                <span className="text-sm font-mono font-black text-white/80 tracking-[0.1em]">{profileData.gameUid || '---'}</span>
                <Copy className="w-4 h-4 text-zinc-600 group-hover:text-[#38bdf8] transition-colors" />
              </div>
            </div>
          </div>

          {/* New Tear-drop Social Icons */}
          <div className="flex items-center justify-center gap-8 w-full py-4">
            {[
              { icon: Facebook, link: profileData.facebookLink, active: !!profileData.facebookLink },
              { icon: MessageCircle, link: `https://wa.me/${profileData.phone}`, active: !!profileData.phone },
              { icon: Send, link: profileData.messengerLink, active: !!profileData.messengerLink }
            ].map((social, i) => (
              <a 
                key={i}
                href={social.link}
                target="_blank"
                rel="noreferrer"
                className="relative w-16 h-16 bg-gradient-to-br from-[#FF2D55] to-[#D4002D] rounded-t-[32px] rounded-br-[32px] rounded-bl-[4px] flex items-center justify-center shadow-[0_10px_20px_rgba(255,45,85,0.2)] hover:scale-110 active:scale-95 transition-all group"
              >
                <social.icon className="w-7 h-7 text-white fill-current" />
                {/* Glowing status dot on icons */}
                <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black ${social.active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-zinc-600'}`}></div>
                {/* Red outer glow */}
                <div className="absolute inset-0 bg-[#FF2D55]/20 blur-xl rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </a>
            ))}
          </div>

          {/* Main Action Button */}
          <button 
            onClick={() => setIsEditing(true)}
            className="w-full h-16 bg-gradient-to-r from-[#4A72FF] to-[#38bdf8] text-white rounded-3xl font-black text-sm uppercase tracking-wider italic shadow-[0_15px_30px_rgba(74,114,255,0.3)] hover:shadow-[0_20px_40px_rgba(74,114,255,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border-b-4 border-[#2D4599]"
          >
            <UserCog className="w-5 h-5" />
            Edit Profile Ditels
          </button>
        </div>
      </div>

      <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

      {/* Logout Button directly below profile card */}
      <button 
        onClick={logout}
        className="w-full py-5 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-[32px] border border-red-500/20 font-black text-sm uppercase tracking-[0.3em] italic transition-all flex items-center justify-center gap-3 shadow-lg"
      >
        <LogOut className="w-5 h-5" />
        Terminate Active Session
      </button>

      {/* Player Career Statistics Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-white/5 rounded-[32px] p-6 text-center rgb-border">
          <p className="text-[9px] font-black text-zinc-600 uppercase italic tracking-widest mb-2">Played</p>
          <span className="text-2xl font-black text-white italic">{matchStats.played}</span>
        </div>
        <div className="bg-[#111827] border border-white/5 rounded-[32px] p-6 text-center rgb-border">
          <p className="text-[9px] font-black text-emerald-500 uppercase italic tracking-widest mb-2">Wins</p>
          <span className="text-2xl font-black text-white italic">{matchStats.won}</span>
        </div>
        <div className="bg-[#111827] border border-white/5 rounded-[32px] p-6 text-center rgb-border">
          <p className="text-[9px] font-black text-amber-500 uppercase italic tracking-widest mb-2">Win Rate</p>
          <span className="text-2xl font-black text-white italic">
            {matchStats.played > 0 ? Math.round((matchStats.won / matchStats.played) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Events Hosted (For Publishers) */}
      {userData?.role === 'publisher' && (
        <div className="bg-[#111827] border border-white/5 rounded-[32px] p-6 text-center rgb-border">
          <p className="text-[9px] font-black text-zinc-600 uppercase italic tracking-widest mb-1">Total Arenas Hosted</p>
          <span className="text-3xl font-black text-white italic">{publishedCount}</span>
        </div>
      )}

      {/* Admin Section remains at bottom */}
      {isAdmin && (
        <div className="bg-black/40 border border-white/5 rounded-[40px] p-10 flex flex-col md:flex-row items-center justify-between gap-8 group">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center border border-white/10 group-hover:border-amber-500/30 transition-all">
              <Shield className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white uppercase italic leading-none">Command Broadcast</h3>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.3em] mt-1 italic">Level 5 Clearance Required</p>
            </div>
          </div>
          <div className="relative z-10 w-full md:w-auto">
            <AdminNotificationManager />
          </div>
        </div>
      )}

      {/* Edit Modal remains similar but with messenger field */}

      {/* Publisher: My Tournaments Section */}
        {userData?.role === 'publisher' && myTournaments.length > 0 && (
          <div className="md:col-span-3 space-y-8 mt-12 mb-12">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-amber-500/10 rounded-[24px] flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/5">
                  <Gamepad2 className="w-7 h-7 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Your Published Arenas</h3>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Live Engine Deployments</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {myTournaments.map((t) => (
                <motion.div
                  key={`my-${t.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5 }}
                  onClick={() => onSelectTournament?.(t.id)}
                  className="bg-[#111827] border border-white/5 rounded-[40px] p-8 hover:border-amber-500/30 transition-all group shadow-xl cursor-pointer rgb-border"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                      <span className="text-[10px] font-black text-amber-500 uppercase italic tracking-[0.2em]">
                        {t.status}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:rotate-12 transition-transform">
                      <Trophy className="w-5 h-5 text-zinc-500" />
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-white uppercase italic mb-3 tracking-tight line-clamp-1">{t.name}</h4>
                  <div className="flex items-center gap-6 text-zinc-500">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-[11px] font-black uppercase italic tracking-widest">{t.entryType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      <span className="text-[11px] font-black uppercase italic tracking-widest">{t.prize}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Player: Joined Tournaments Section */}
        {joinedTournaments.length > 0 && (
          <div className="md:col-span-3 space-y-8 mt-12 mb-12">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#38bdf8]/10 rounded-[24px] flex items-center justify-center border border-[#38bdf8]/20 shadow-lg shadow-[#38bdf8]/5">
                  <Trophy className="w-7 h-7 text-[#38bdf8]" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Your Enrolled Arenas</h3>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Personal Combat History</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {joinedTournaments.map((t) => (
                <motion.div
                  key={`joined-${t.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5 }}
                  onClick={() => onSelectTournament?.(t.id)}
                  className="bg-[#111827] border border-white/5 rounded-[40px] p-8 hover:border-[#38bdf8]/30 transition-all group shadow-xl cursor-pointer rgb-border"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className="px-4 py-1.5 bg-[#38bdf8]/10 border border-[#38bdf8]/20 rounded-full">
                      <span className="text-[10px] font-black text-[#38bdf8] uppercase italic tracking-[0.2em]">
                        {t.status}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:rotate-12 transition-transform">
                      <Target className="w-5 h-5 text-zinc-500" />
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-white uppercase italic mb-3 tracking-tight line-clamp-1">{t.name}</h4>
                  <div className="flex items-center gap-6 text-zinc-500">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-[11px] font-black uppercase italic tracking-widest">{t.entryType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      <span className="text-[11px] font-black uppercase italic tracking-widest">{t.prize}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Global Security Badge (Notice System) - ONLY FOR ADMINS */}
        {isAdmin && (
          <div className="md:col-span-3 mt-12 bg-black/40 border border-white/5 rounded-[40px] p-10 flex flex-col md:flex-row items-center justify-between gap-8 group">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center border border-white/10 group-hover:border-amber-500/30 transition-all">
                <Shield className="w-8 h-8 text-amber-500" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white uppercase italic leading-none">Command Broadcast</h3>
                <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.3em] mt-1 italic">Level 5 Clearance Required</p>
              </div>
            </div>
            <div className="relative z-10">
              <AdminNotificationManager />
            </div>
          </div>
        )}

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditing(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }} 
              className="relative bg-[#1A2233] border border-white/10 rounded-[40px] w-full max-w-lg p-8 sm:p-10 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <h2 className="text-2xl font-black text-white mb-8 uppercase italic italic tracking-tight">Sync Profile Data</h2>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Game Name</label>
                    <input required type="text" value={profileData.gameName} onChange={e => setProfileData({...profileData, gameName: e.target.value})} className="w-full h-14 px-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-amber-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Team OVR</label>
                    <input required type="number" value={profileData.ovr} onChange={e => setProfileData({...profileData, ovr: parseInt(e.target.value) || 100})} className="w-full h-14 px-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-amber-500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 italic">Game UID</label>
                  <input type="text" value={profileData.gameUid} onChange={e => setProfileData({...profileData, gameUid: e.target.value})} className="w-full h-14 px-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#38bdf8] uppercase tracking-widest px-2 italic">Facebook Link</label>
                  <input type="url" value={profileData.facebookLink} onChange={e => setProfileData({...profileData, facebookLink: e.target.value})} className="w-full h-14 px-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-[#38bdf8]" placeholder="https://facebook.com/..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-2 italic">Messenger Link</label>
                  <input type="url" value={profileData.messengerLink} onChange={e => setProfileData({...profileData, messengerLink: e.target.value})} className="w-full h-14 px-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-indigo-500" placeholder="https://m.me/..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-green-500 uppercase tracking-widest px-2 italic">WhatsApp Number</label>
                  <input type="tel" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} className="w-full h-14 px-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-green-500" />
                </div>
                <div className="space-y-2 p-6 bg-red-500/5 rounded-[28px] border border-red-500/10">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="w-3 h-3 text-red-500" />
                    <label className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">Sensitive Game Password</label>
                  </div>
                  <input type="text" value={profileData.gamePassword} onChange={e => setProfileData({...profileData, gamePassword: e.target.value})} className="w-full h-14 px-6 bg-black/20 border border-white/5 rounded-2xl font-black text-white italic outline-none focus:ring-1 focus:ring-red-500" placeholder="Stored for account recovery" />
                  <p className="mt-2 text-[9px] text-zinc-600 font-bold italic px-2">Only you and the Arena Admin can access this data.</p>
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-4 text-zinc-500 font-black uppercase tracking-widest text-[10px] italic">Discard</button>
                  <button type="submit" className="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] italic shadow-xl shadow-amber-500/10 flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
