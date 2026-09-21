import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, MessageSquare, Shield } from 'lucide-react';
import { rtdb, auth } from '../lib/firebase';
import { ref, push, onValue, serverTimestamp, off, set } from 'firebase/database';

interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  senderPhoto?: string;
  text: string;
  createdAt: number;
}

interface MatchChatProps {
  tournamentId: string;
  matchId: string;
  onClose: () => void;
  homePlayerName: string;
  awayPlayerName: string;
  participants: any[];
}

export const MatchChat: React.FC<MatchChatProps> = ({ 
  tournamentId, 
  matchId, 
  onClose,
  homePlayerName,
  awayPlayerName,
  participants
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chatRef = ref(rtdb, `chats/${tournamentId}/${matchId}`);
    
    const listener = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val
        })) as Message[];
        msgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setMessages(msgs);
      } else {
        setMessages([]);
      }
      setIsLoading(false);
    });

    return () => off(chatRef, 'value', listener);
  }, [tournamentId, matchId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    try {
      const userParticipant = participants.find(p => p.userId === auth.currentUser?.uid);
      const senderName = userParticipant?.displayName || auth.currentUser.displayName || 'Player';
      const senderPhoto = userParticipant?.photoURL || auth.currentUser.photoURL || '';

      const chatRef = ref(rtdb, `chats/${tournamentId}/${matchId}`);
      const newMessageRef = push(chatRef);
      await set(newMessageRef, {
        senderId: auth.currentUser.uid,
        senderName,
        senderPhoto,
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const getPlayerName = (uid: string) => {
    const p = participants.find(p => p.userId === uid);
    return p?.displayName || 'Unknown Player';
  };

  const formatTime = (ts: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg bg-[#111827] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[80vh] rgb-border">
        {/* Chat Header */}
        <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <MessageSquare className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-white font-black uppercase italic tracking-wider text-sm">Match Tactical Chat</h3>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">
                {homePlayerName} <span className="text-amber-500">VS</span> {awayPlayerName}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
              <MessageSquare className="w-12 h-12 text-zinc-500" />
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">No messages yet. Start the strategy talk.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === auth.currentUser?.uid;
              const senderPhoto = msg.senderPhoto || participants.find(p => p.userId === msg.senderId)?.photoURL;
              const senderName = msg.senderName || participants.find(p => p.userId === msg.senderId)?.displayName || 'Player';
              
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-2 mb-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isMe && (
                    <div className="flex-shrink-0 mt-auto">
                      {senderPhoto ? (
                        <img 
                          src={senderPhoto} 
                          alt="" 
                          className="w-8 h-8 rounded-full border border-white/10 shadow-sm object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                          <Shield className="w-4 h-4 text-zinc-500" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && (
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1 italic">
                        {senderName}
                      </span>
                    )}
                    <div className={`rounded-2xl px-4 py-2.5 text-[13px] font-medium leading-relaxed ${
                      isMe 
                        ? 'bg-amber-500 text-black rounded-tr-none shadow-lg shadow-amber-500/10' 
                        : 'bg-white/10 text-white border border-white/5 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1 px-1">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* System Privacy Notice */}
        <div className="px-6 py-2 bg-black/40 flex items-center justify-center gap-2 border-y border-white/5">
          <Shield className="w-3 h-3 text-amber-500" />
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">Encrypted Neural Link Established</span>
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendMessage} className="p-6 bg-white/5 flex items-center gap-3">
          <input 
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-[13px] focus:outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-600 font-medium"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="p-3 bg-amber-500 text-black rounded-2xl shadow-lg shadow-amber-500/10 hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </motion.div>
  );
};
