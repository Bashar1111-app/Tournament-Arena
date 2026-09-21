import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { UserCircle, Trophy, Target, Shield, Clock, LogOut, Facebook, Phone, Mail, Fingerprint, Save, Edit3, Lock, Bell, Star, Zap, Camera, Loader2, Gamepad2 } from 'lucide-react';
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
    gamePassword: '',
    photoURL: ''
  });
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const [myTournaments, setMyTournaments] = useState<any[]>([]);
  const [joinedTournaments, setJoinedTournaments] = useState<any[]>([]);

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

    // 2. Publisher/Participant Stats & Tournaments Sync
    let tournamentsUnsubscribe: (() => void) | null = null;
    let joinedUnsubscribe: (() => void) | null = null;

    if (userData?.role === 'publisher') {
      const q = query(collection(db, 'tournaments'), where('createdBy', '==', user.uid));
      tournamentsUnsubscribe = onSnapshot(q, (snapshot) => {
        setPublishedCount(snapshot.size);
        setMyTournaments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => console.warn("Publisher tournaments listener error:", err));
    }

    const joinedQ = query(collectionGroup(db, 'participants'), where('userId', '==', user.uid));
    joinedUnsubscribe = onSnapshot(joinedQ, (joinedSnapshot) => {
      const tournamentIds = Array.from(new Set(joinedSnapshot.docs.map(doc => doc.ref.parent.parent?.id).filter(id => !!id)));
      
      if (tournamentIds.length > 0) {
        const tourneysQ = query(collection(db, 'tournaments'), where('__name__', 'in', tournamentIds.slice(0, 10)));
        onSnapshot(tourneysQ, (tourneysSnapshot) => {
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

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8 pb-20"
    >
      {/* Ultra-Modern Hero Profile Section */}
      <div className="relative overflow-hidden rounded-[40px] sm:rounded-[56px] bg-gradient-to-br from-[#0B1221] via-[#111827] to-[#0B1221] border border-white/10 p-6 sm:p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] rgb-border">
        {/* Animated Background Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#38bdf8]/10 blur-[120px] rounded-full pointer-events-none animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative z-10 flex flex-col items-center">
          {/* Elite Avatar with Neon Ring */}
          <div className="relative mb-10 group cursor-pointer" onClick={() => document.getElementById('photo-upload')?.click()}>
            <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full scale-110 group-hover:bg-amber-500/40 transition-all duration-700"></div>
            <div className="relative w-40 h-40 rounded-full p-1.5 bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-600 shadow-[0_0_30px_rgba(245,158,11,0.3)] group-hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] transition-all duration-700">
              <div className="w-full h-full rounded-full overflow-hidden bg-black border-4 border-[#0B1221] relative">
                {isUploading ? (
                  <div className="w-full h-full flex items-center justify-center bg-black/60">
                    <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                  </div>
                ) : (profileData.photoURL || user.photoURL) ? (
                  <img src={profileData.photoURL || user.photoURL || ''} alt="Profile" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <UserCircle className="w-20 h-20 text-zinc-700" />
                  </div>
                )}
                
                {/* Camera Overlay on Hover */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-10 h-10 text-white" />
                </div>

                {/* Edit Badge Trigger */}
                <div className="absolute bottom-2 right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center border-4 border-[#0B1221] shadow-xl group-hover:scale-110 transition-transform">
                  <Edit3 className="w-3 h-3 text-black" />
                </div>

                {/* Scanline Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-30"></div>
              </div>
            </div>
            {/* Elite OVR Floating Badge */}
            <motion.div 
              initial={{ y: 0 }}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-2 right-4 bg-white text-black px-4 py-1.5 rounded-2xl text-[12px] font-black italic shadow-[0_10px_20px_rgba(0,0,0,0.4)] border border-white/20"
            >
              <span className="text-amber-600 mr-1">{profileData.ovr}</span> OVR
            </motion.div>
          </div>
          
          {/* Premium User Branding */}
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-3 mb-1">
                <Shield className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] italic">Elite Federation Athlete</span>
                <Shield className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              </div>
              <h2 className="text-4xl sm:text-[64px] font-black text-white uppercase italic leading-tight sm:leading-none tracking-tight sm:tracking-[-0.05em] drop-shadow-2xl px-4">
                {profileData.gameName || user.displayName || 'LEGEND'}
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
              <div className="w-full sm:w-auto flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl backdrop-blur-md">
                <Fingerprint className="w-4 h-4 text-zinc-500" />
                <span className="text-[9px] sm:text-[11px] font-black text-zinc-400 uppercase tracking-widest italic">UID:</span>
                <span className="text-[9px] sm:text-[11px] font-mono font-black text-white">{profileData.gameUid || '---'}</span>
              </div>
              <div className="w-full sm:w-auto flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl backdrop-blur-md">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="text-[9px] sm:text-[11px] font-black text-white uppercase tracking-widest italic">Global Rank #1</span>
              </div>
            </div>

            <div className="flex gap-4 justify-center pt-4">
              <button 
                onClick={() => setIsEditing(true)}
                className="group relative px-10 py-5 bg-white text-black rounded-[24px] font-black text-[12px] uppercase tracking-[0.2em] italic transition-all active:scale-95 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-300 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center gap-3">
                  <Edit3 className="w-4 h-4" />
                  Synchronize Identity
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Large Stat Box */}
        <div className="md:col-span-2 relative overflow-hidden rounded-[48px] bg-[#111827] border border-white/5 p-10 group rgb-border">
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:rotate-12 transition-transform duration-700">
            {userData?.role === 'publisher' ? <Trophy className="w-40 h-40 text-amber-500" /> : <Trophy className="w-40 h-40 text-amber-500" />}
          </div>
          <h3 className="text-[11px] font-black text-amber-500 uppercase tracking-[0.4em] mb-12 italic">
            {userData?.role === 'publisher' ? 'Publishing Analytics' : 'Arena Dominance'}
          </h3>
          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic">
                {userData?.role === 'publisher' ? 'Arenas Hosted' : 'Tournament Victories'}
              </p>
              <div className="flex items-end gap-3">
                <span className="text-[56px] font-black text-white leading-none italic">
                  {userData?.role === 'publisher' ? publishedCount.toString().padStart(2, '0') : '08'}
                </span>
                <span className="text-[14px] font-black text-amber-500 uppercase italic pb-2">
                  {userData?.role === 'publisher' ? 'Events' : 'Cups Won'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic">
                {userData?.role === 'publisher' ? 'Host Reputation' : 'Win Probability'}
              </p>
              <div className="flex items-end gap-3">
                <span className="text-[56px] font-black text-white leading-none italic">
                  {userData?.role === 'publisher' ? '98' : '94'}
                </span>
                <span className="text-[14px] font-black text-[#38bdf8] uppercase italic pb-2">
                  {userData?.role === 'publisher' ? 'Level' : '% Rate'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Vertical Stat Box */}
        <div className="relative overflow-hidden rounded-[48px] bg-gradient-to-b from-amber-500 to-amber-600 p-10 flex flex-col justify-between group rgb-border">
          <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-125 transition-transform duration-700">
            <Zap className="w-20 h-20 text-white fill-white" />
          </div>
          <h3 className="text-[11px] font-black text-black/50 uppercase tracking-[0.4em] italic">Current Tier</h3>
          <div className="space-y-1">
            <p className="text-[40px] font-black text-black uppercase italic leading-tight tracking-tighter">ELITE<br/>ARENA</p>
            <p className="text-[10px] font-black text-black/60 uppercase tracking-widest italic">Division Alpha</p>
          </div>
        </div>
      </div>

      {/* Infrastructure & Security Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-[48px] bg-[#111827] border border-white/5 p-10 space-y-8 rgb-border">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black text-[#38bdf8] uppercase tracking-[0.4em] italic">Neural Links</h3>
            <div className="px-3 py-1 bg-[#38bdf8]/10 rounded-lg text-[9px] font-black text-[#38bdf8] italic uppercase">Secure</div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-[32px] group hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center border border-[#1877F2]/20">
                  <Facebook className="w-5 h-5 text-[#1877F2]" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-white uppercase italic">Facebook Auth</p>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase italic">Primary Gateway</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-zinc-500 uppercase italic">{profileData.facebookLink ? 'Authorized' : 'Pending'}</span>
            </div>
            <div className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-[32px] group hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                  <Phone className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-white uppercase italic">Mobile Sync</p>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase italic">Encrypted (Private)</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-zinc-500 font-mono italic">{profileData.phone ? `****${profileData.phone.slice(-4)}` : 'Restricted'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[48px] bg-[#111827] border border-white/5 p-10 flex flex-col justify-between group rgb-border">
          <div className="space-y-2">
            <h3 className="text-[11px] font-black text-red-500 uppercase tracking-[0.4em] italic">System Core</h3>
            <p className="text-zinc-500 text-[13px] italic opacity-80 leading-relaxed">Manage your active arena credentials and force-terminate the current neural synchronization across all nodes.</p>
          </div>
          <button 
            onClick={logout}
            className="group relative w-full py-6 bg-red-500/10 border border-red-500/20 rounded-[32px] overflow-hidden transition-all active:scale-95"
          >
            <div className="absolute inset-0 bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative flex items-center justify-center gap-3 text-red-500 group-hover:text-white font-black uppercase tracking-[0.2em] text-[11px] italic">
              <LogOut className="w-5 h-5" />
              Terminate Active Session
            </div>
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="relative overflow-hidden rounded-[56px] bg-[#111827] border border-amber-500/10 p-12 space-y-10 shadow-[0_0_40px_rgba(245,158,11,0.05)] rgb-border">
          <div className="absolute top-0 right-0 p-12 opacity-[0.02]">
            <Bell className="w-64 h-64 text-amber-500" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Bell className="w-6 h-6 text-amber-500" />
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
                  key={t.id}
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
                  key={t.id}
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
                  <label className="text-[10px] font-black text-green-500 uppercase tracking-widest px-2 italic">Mobile Number (Private)</label>
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
