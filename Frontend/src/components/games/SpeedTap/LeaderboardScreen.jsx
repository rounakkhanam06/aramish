import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Crown } from 'lucide-react';

export default function LeaderboardScreen({ bestScore, onBack }) {
  const [tab, setTab] = useState('DAILY');

  const leaderboardData = [
    { rank: 1, name: "Aryan", taps: 132, me: false },
    { rank: 2, name: "Riya", taps: 120, me: false },
    { rank: 3, name: "Kabir", taps: 116, me: false },
    { rank: 4, name: "Neha", taps: 102, me: false },
    { rank: 5, name: "You", taps: bestScore || 98, me: true },
    { rank: 6, name: "Aditya", taps: 95, me: false },
    { rank: 7, name: "Simran", taps: 89, me: false },
    { rank: 8, name: "Rohit", taps: 76, me: false },
  ].sort((a, b) => b.taps - a.taps).map((item, index) => ({ ...item, rank: index + 1 }));

  return (
    <motion.div 
      className="flex-1 flex flex-col bg-[#071226] text-white"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <div className="flex items-center gap-4 p-4 relative z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-surface/10 transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-lg font-black tracking-wide uppercase">Leaderboard</h1>
      </div>

      <div className="px-4 pb-2">
        <div className="flex bg-slate-800 rounded-lg p-1">
          {['DAILY', 'WEEKLY', 'ALL TIME'].map(t => (
            <button 
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-colors ${
                tab === t ? 'bg-[#0B132B] text-white' : 'text-slate-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-4 pt-8 pb-6 px-4">
        {/* Rank 2 */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-slate-700 rounded-full border-2 border-slate-500 mb-2 relative flex items-center justify-center overflow-hidden">
             <img src="https://api.dicebear.com/9.x/avataaars/svg?seed=Riya" className="w-full h-full bg-surface" />
             <div className="absolute -bottom-2 bg-slate-500 text-white text-[9px] font-bold px-2 rounded-full border border-slate-700 z-10">2</div>
          </div>
          <span className="text-xs font-bold">{leaderboardData[1].name}</span>
          <span className="text-[10px] text-[#0B132B] font-black">{leaderboardData[1].taps} Taps</span>
        </div>
        
        {/* Rank 1 */}
        <div className="flex flex-col items-center -mt-6">
          <Crown className="w-8 h-8 text-amber-400 mb-1 animate-bounce" />
          <div className="w-16 h-16 bg-slate-700 rounded-full border-2 border-amber-400 mb-2 relative flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(251,191,36,0.3)]">
             <img src="https://api.dicebear.com/9.x/avataaars/svg?seed=Aryan" className="w-full h-full bg-surface" />
             <div className="absolute -bottom-2 bg-amber-500 text-white text-[10px] font-black px-2.5 rounded-full border border-amber-200 z-10">1</div>
          </div>
          <span className="text-sm font-black">{leaderboardData[0].name}</span>
          <span className="text-[11px] text-[#0B132B] font-black">{leaderboardData[0].taps} Taps</span>
        </div>

        {/* Rank 3 */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-slate-700 rounded-full border-2 border-amber-700 mb-2 relative flex items-center justify-center overflow-hidden">
             <img src="https://api.dicebear.com/9.x/avataaars/svg?seed=Kabir" className="w-full h-full bg-surface" />
             <div className="absolute -bottom-2 bg-amber-700 text-white text-[9px] font-bold px-2 rounded-full border border-slate-700 z-10">3</div>
          </div>
          <span className="text-xs font-bold">{leaderboardData[2].name}</span>
          <span className="text-[10px] text-[#0B132B] font-black">{leaderboardData[2].taps} Taps</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="bg-slate-800/50 rounded-2xl p-2 space-y-1 border border-slate-700/50">
          {leaderboardData.slice(3).map((item) => (
            <div 
              key={item.rank} 
              className={`flex items-center justify-between p-3 rounded-xl ${
                item.me ? 'bg-surface/10 border border-white/20' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-400 w-4 text-center">{item.rank}</span>
                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">
                  <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${item.name}`} className="w-full h-full bg-surface" />
                </div>
                <span className={`font-bold text-sm ${item.me ? 'text-amber-400' : 'text-slate-200'}`}>
                  {item.name}
                </span>
              </div>
              <span className={`text-xs font-black ${item.me ? 'text-amber-400' : 'text-slate-400'}`}>
                {item.taps} Taps
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4">
        <button className="w-full bg-[#0B132B] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,90,31,0.4)] active:scale-95 transition-all">
          <Share2 className="w-5 h-5" />
          CHALLENGE FRIENDS
        </button>
      </div>
    </motion.div>
  );
}
