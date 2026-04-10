import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { UserProfile } from './types';
import { Users, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from './AuthContext';

const OnlineUsers: React.FC = () => {
  const { profile } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Listen to all users marked as online
    const q = query(
      collection(db, 'users'),
      where('isOnline', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const users = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(user => {
          // Additional safety check: only show if lastActive is within 10 minutes
          // (in case a user closed the tab and updatePresence(false) failed)
          if (!user.lastActive) return true;
          const lastActiveTime = user.lastActive.toDate().getTime();
          return lastActiveTime > fiveMinutesAgo;
        });
      
      // Sort by name
      setOnlineUsers(users.sort((a, b) => a.name.localeCompare(b.name)));
    }, (error) => {
      console.error('Error listening to online users:', error);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-app-primary" />
                <span className="font-bold text-sm uppercase tracking-widest">ผู้ใช้งานออนไลน์</span>
              </div>
              <span className="bg-app-primary text-[10px] font-black px-2 py-0.5 rounded-full">
                {onlineUsers.length}
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {onlineUsers.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs font-medium text-slate-400">ไม่มีผู้ใช้งานอื่นออนไลน์</p>
                </div>
              ) : (
                onlineUsers.map((user) => (
                  <div 
                    key={user.uid}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-sm uppercase group-hover:bg-app-primary/10 group-hover:text-app-primary transition-colors">
                        {user.name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <Circle size={8} className="fill-emerald-500 text-emerald-500" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {user.name} {user.uid === profile?.uid && <span className="text-app-primary text-[10px] font-black ml-1">(คุณ)</span>}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                        {user.role} {user.shift ? `• กะ ${user.shift}` : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl transition-all active:scale-95 ${
          isOpen 
            ? 'bg-slate-900 text-white' 
            : 'bg-white text-slate-900 border border-slate-100 hover:border-app-primary'
        }`}
      >
        <div className="relative">
          <Users size={20} className={isOpen ? 'text-app-primary' : 'text-slate-400'} />
          {onlineUsers.length > 0 && !isOpen && (
            <div className="absolute -top-2 -right-2 bg-app-primary text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {onlineUsers.length}
            </div>
          )}
        </div>
        <span className="font-bold text-sm uppercase tracking-widest">
          {isOpen ? 'ปิดหน้าต่าง' : 'ใครออนไลน์อยู่?'}
        </span>
      </button>
    </div>
  );
};

export default OnlineUsers;
