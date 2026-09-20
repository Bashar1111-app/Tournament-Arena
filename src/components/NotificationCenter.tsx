import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bell, Info, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  content: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
  createdAt: any;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(docs);
      
      if (docs.length > 0) {
        const lastReadId = localStorage.getItem('last_read_notification');
        if (lastReadId !== docs[0].id) {
          setHasUnread(true);
        }
      }
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen && notifications.length > 0) {
      localStorage.setItem('last_read_notification', notifications[0].id);
      setHasUnread(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={toggleDropdown}
        className="relative p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all group"
      >
        <Bell className={`w-5 h-5 transition-colors ${hasUnread ? 'text-amber-500' : 'text-zinc-400 group-hover:text-white'}`} />
        {hasUnread && (
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-green-500 rounded-full border-2 border-[#0B1221] shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 bg-[#1A2233] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden z-[100]"
          >
            <div className="p-4 border-b border-white/5 bg-white/5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 italic">Arena Notifications</h3>
            </div>

            <div className="max-h-[400px] overflow-y-auto no-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div key={n.id} className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors flex gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${
                      n.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                      n.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                      'bg-[#38bdf8]/10 border-[#38bdf8]/20 text-[#38bdf8]'
                    }`}>
                      {n.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                       n.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
                       <Info className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white italic leading-relaxed mb-1">
                        {n.content}
                      </p>
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-600 uppercase italic">
                        <Clock className="w-3 h-3" />
                        {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center">
                  <Bell className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-700 italic">No broadcasts yet</p>
                </div>
              )}
            </div>
            
            <div className="p-3 bg-black/20 text-center">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600 italic">FC Arena Protocol v2.6</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
