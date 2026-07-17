import React, { useState, useEffect } from 'react';
import { ChevronLeft, Gift, Coins, X, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';
import analytics from '../utils/analytics';

// Import Games Overlays
import SnakeGame from '../components/games/SnakeGame';
import SpeedTapGame from '../components/games/SpeedTap/SpeedTapGame';
import TicTacToeGame from '../components/games/TicTacToe/TicTacToeGame';
import QuizGame from '../components/games/QuizGame/QuizGame';

// Import Icons
import speedTapImg from '../assets/GamesIcons/speed_tap.webp';
import snakeImg from '../assets/GamesIcons/snake.webp';
import ticTacToeImg from '../assets/GamesIcons/tic_tac_toe.webp';
import quizImg from '../assets/GamesIcons/quiz.webp';
import categoryForUImg from '../assets/CategorySection/categoryForU-removebg-preview.webp';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const GAME_ASSETS = {
  speedTap: { title: 'Speed Tap', icon: speedTapImg },
  snake: { title: 'Snake & Chase', icon: snakeImg },
  ticTacToe: { title: 'Tic Tac Toe', icon: ticTacToeImg },
  quiz: { title: 'Quiz Game', icon: quizImg }
};

export default function GamesPage() {
  const navigate = useNavigate();
  const { coins, addCoins, user } = useApp();
  
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState(null); // 'quiz' | 'speedTap' | 'ticTacToe' | 'snake' | null
  const [selectedGameKey, setSelectedGameKey] = useState('speedTap');
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const fetchGames = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/games`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setGames(data.data);
        // Find if the currently selected game is active, else default to the first active game
        const activeKeys = data.data.map(g => g.key);
        if (data.data.length > 0 && !activeKeys.includes(selectedGameKey)) {
          setSelectedGameKey(data.data[0].key);
        }
      }
    } catch (err) {
      console.error('Failed to load games list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, [user]);

  const handleOpenGame = (gameKey) => {
    const isGameActive = games.some(g => g.key === gameKey);
    if (!isGameActive) {
      toast.error("This game is currently inactive!");
      return;
    }
    analytics.trackGamePlay(gameKey, 'start');
    setActiveGame(gameKey);
  };

  // Ref to distinguish: was the game closed via the in-app button (true)
  // or via the hardware back button (false/undefined)?
  const closingFromButtonRef = React.useRef(false);

  // Shared close handler — called by onClose (the in-app arrow button)
  const handleCloseGame = React.useCallback(() => {
    closingFromButtonRef.current = true;   // mark: this is a button-close
    window.history.back();                 // pop the dummy entry we pushed
    // popstate will fire; listener below reads the flag and just cleans up
  }, []);

  // Intercept the mobile hardware back button while a game overlay is open.
  // Push a dummy history entry when the game opens so pressing back
  // fires popstate instead of leaving /games entirely.
  useEffect(() => {
    if (!activeGame) return;

    // Push a dummy state so the back button has somewhere to "go back to"
    window.history.pushState({ gameOverlay: true }, '');
    closingFromButtonRef.current = false;

    const handlePopState = () => {
      if (closingFromButtonRef.current) {
        // Closed via in-app button — history.back() already consumed the dummy
        // entry; just close the overlay state.
        closingFromButtonRef.current = false;
      }
      // Either way (button or hardware back), close the overlay
      setActiveGame(null);
      fetchGames();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeGame]);

  const handleRecordPlay = async (gameKey, scoreAmount) => {
    analytics.trackGamePlay(gameKey, 'complete', scoreAmount);
    try {
      const token = localStorage.getItem('userToken');
      if (!token) {
        // Fallback for guest play
        if (scoreAmount > 0) {
          addCoins(scoreAmount);
          toast.success(`You won ${scoreAmount} Coins! Log in to save streak progress.`);
        }
        return;
      }
      const res = await fetch(`${API_BASE}/games/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ gameKey })
      });
      const data = await res.json();
      if (data.success) {
        if (data.pointsAwarded > 0) {
          toast.success(`🎉 Streak Completed! You won ${data.pointsAwarded} Coins!`, { duration: 5000 });
          addCoins(data.pointsAwarded);
        } else if (data.cycleCompleted) {
          toast.success('Streak Cycle Completed! Rules limits met.');
        } else {
          toast.success(`Game play recorded! Daily target: ${data.playCountToday} plays today.`);
        }
        fetchGames();
      } else {
        toast.error(data.message || 'Game limit reached or not counted.');
      }
    } catch (err) {
      console.error('Failed to record game play', err);
      // Fail-safe fallback if API is offline
      if (scoreAmount > 0) {
        addCoins(scoreAmount);
      }
    }
  };

  const shareUrl = window.location.origin;
  const shareText = encodeURIComponent('Come play games & win real rewards on Aramish! 🎮🎁');

  const openShareModal = () => setShowShareModal(true);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const shareOptions = [
    {
      label: 'WhatsApp',
      color: '#25D366',
      bg: '#f0fdf4',
      icon: '💬',
      action: () => window.open(`https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}`, '_blank'),
    },
    {
      label: 'Telegram',
      color: '#229ED9',
      bg: '#eff8ff',
      icon: '✈️',
      action: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${shareText}`, '_blank'),
    },
    {
      label: 'Twitter',
      color: '#1DA1F2',
      bg: '#eff8ff',
      icon: '🐦',
      action: () => window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`, '_blank'),
    },
  ];

  // Find currently selected game data
  const selectedGameData = games.find(g => g.key === selectedGameKey) || games[0];
  const totalStreakDays = selectedGameData?.userProgress?.currentStreakDays || 0;
  const maxConfiguredDays = selectedGameData?.requiredDays || 3;
  const streakRange = Array.from({ length: maxConfiguredDays }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-screen bg-[#FFF6F2] relative font-sans">
      
      <div className="flex-grow overflow-y-auto pb-24 bg-[#FFF6F2]">
        {/* Playground Header */}
        <div className="sticky top-0 bg-gold/10 border-b-2 border-[#0B132B]/20 backdrop-blur-md z-20 shadow-sm">
          <div className="flex items-center justify-between px-5 py-2.5 md:max-w-3xl md:mx-auto">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#071226]" />
            </button>
            <div className="flex flex-col items-center">
              <h1 className="text-xl font-black text-[#071226] uppercase tracking-tighter leading-none">PLAYGROUND <span className="text-amber-400">✦</span></h1>
              <p className="text-[10px] font-medium text-slate-600 mt-0.5">Play Games, Win Rewards!</p>
            </div>
            <div className="w-6 h-6"></div>
          </div>
        </div>

        <div className="px-5 mt-2 space-y-6 md:max-w-3xl md:mx-auto">

          {/* Wallet Card */}
          <div className="relative w-full h-44 rounded-2xl p-5 text-white overflow-hidden shadow-lg"
               style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #0B132B 100%)' }}>
            <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-surface/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 flex flex-col h-full justify-between w-1/2">
              <div>
                <p className="text-sm font-bold opacity-90">My Coins</p>
                <p className="text-[10px] uppercase tracking-widest opacity-80 mb-1">Balance</p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center border-2 border-white/30 shadow-inner">
                    <span className="text-[10px] font-black text-amber-900">M</span>
                  </div>
                  <span className="text-3xl font-black">{coins}</span>
                </div>
              </div>
              <button onClick={() => navigate('/wallet')} className="bg-surface text-[#0B132B] text-[10px] font-black px-4 py-1.5 rounded-full w-max shadow-md flex items-center gap-1 active:scale-95 transition-transform">
                My Wallet <ChevronLeft className="w-3 h-3 rotate-180" />
              </button>
            </div>

            <div className="absolute bottom-[-10px] right-[-20px] w-48 h-48 z-10 pointer-events-none">
              <img src={categoryForUImg} alt="Gift Box" className="w-full h-full object-contain drop-shadow-2xl" />
            </div>
          </div>

          {/* Fun Zone Section */}
          {/* Top Games Section */}
          {games.length > 0 ? (
            <>
              <div>
                <h2 className="text-xl font-black text-[#071226] mb-4">Top Games</h2>

                <div className="grid grid-cols-4 gap-3">
                  {[
                    { id: 'speedTap', key: 'speedTap' },
                    { id: 'snake', key: 'snake' },
                    { id: 'ticTacToe', key: 'ticTacToe' },
                    { id: 'quiz', key: 'quiz' }
                  ]
                  .filter(gRef => games.some(g => g.key === gRef.key))
                  .map(gRef => {
                    const dbGame = games.find(g => g.key === gRef.key);
                    const details = {
                      title: dbGame?.name || GAME_ASSETS[gRef.id].title,
                      icon: GAME_ASSETS[gRef.id].icon
                    };
                    const isSelected = selectedGameKey === gRef.key;
                    return (
                      <div 
                        key={gRef.id} 
                        onClick={() => setSelectedGameKey(gRef.key)} 
                        className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform font-bold"
                      >
                        <div className={`w-16 h-16 rounded-2xl bg-surface shadow-sm p-1 overflow-hidden flex items-center justify-center border-2 transition-all ${
                          isSelected ? 'border-[#0B132B] ring-4 ring-orange-100 scale-105' : 'border-white/10 hover:border-white/10'
                        }`}>
                          <img src={details.icon} alt={details.title} className="w-full h-full object-cover rounded-xl" />
                        </div>
                        <span className={`text-[9px] text-center leading-tight transition-colors ${
                          isSelected ? 'text-[#0B132B] font-black' : 'text-slate-600'
                        }`}>{details.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Daily Streak */}
              <div className="bg-surface rounded-[2rem] p-5 shadow-sm border border-white/10 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-[#071226] text-sm flex items-center gap-1">
                      🔥 {selectedGameData?.name || 'Daily'} Streak
                    </h3>
                    {selectedGameData && (
                      <p className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded mt-1 w-max">
                        Target Today: {selectedGameData?.userProgress?.todayPlayCount || 0} / {selectedGameData?.requiredPlaysPerDay} plays
                      </p>
                    )}
                  </div>
                  <span className="text-[#0B132B] font-black text-xs bg-gold/10 px-3 py-1 rounded-full">{totalStreakDays} Days</span>
                </div>
                
                <p className="text-[10px] text-slate-500 font-medium">
                  Play {selectedGameData?.requiredPlaysPerDay} games daily for {maxConfiguredDays} days to win <span className="font-bold text-[#0B132B]">{selectedGameData?.rewardPoints} Coins</span>!
                </p>
                
                <div className="flex justify-between relative py-2">
                  <div className="absolute top-5 left-0 w-full h-[2px] bg-surface z-0"></div>
                  <div 
                    className="absolute top-5 left-0 h-[2px] bg-[#0B132B] z-0 transition-all duration-500" 
                    style={{ width: `${Math.min((totalStreakDays / maxConfiguredDays) * 100, 100)}%` }}
                  ></div>
                  
                  {streakRange.map((day) => {
                    const isPast = day <= totalStreakDays;
                    const isGift = day === Math.floor(maxConfiguredDays / 2) || day === maxConfiguredDays;
                    return (
                      <div key={day} className="flex flex-col items-center gap-1.5 relative z-10 bg-surface px-0.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                          isPast 
                            ? 'bg-[#0B132B] text-white font-bold' 
                            : isGift 
                              ? 'bg-amber-100 text-amber-500' 
                              : 'bg-surface text-transparent'
                        }`}>
                          {isPast ? '✓' : isGift ? <Gift className="w-3 h-3" /> : ''}
                        </div>
                        <span className="text-[8px] font-medium text-slate-500">Day {day}</span>
                      </div>
                    );
                  })}
                </div>

                <button 
                  onClick={() => handleOpenGame(selectedGameKey)}
                  className="w-full bg-[#071226] text-white text-xs font-black py-3 rounded-xl shadow-md active:scale-95 transition-all uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-800"
                >
                  Play {selectedGameData?.name || 'Game'} Now
                </button>
              </div>
            </>
          ) : (
            <div className="bg-surface rounded-3xl p-8 text-center border border-white/10 shadow-sm flex flex-col items-center justify-center gap-3">
              <span className="text-4xl">🎮</span>
              <div>
                <h3 className="font-black text-[#071226] text-sm">Playground Closed</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">No games are currently enabled by the admin. Please try again later!</p>
              </div>
            </div>
          )}

          {/* Invite Banner */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl py-6 px-4 flex items-center justify-between border border-gold/20 shadow-sm mb-6 relative overflow-hidden">
            <div className="absolute left-[-10px] top-[-10px] w-28 h-28 opacity-30 pointer-events-none">
               <img src={categoryForUImg} alt="Gift" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-3 relative z-10 ml-6">
              <div>
                <h4 className="font-black text-[#071226] text-[15px]">Invite Friends</h4>
                <p className="text-xs text-[#0B132B] font-bold mt-0.5">&amp; Earn 100 Coins</p>
              </div>
            </div>
            <button onClick={openShareModal} className="bg-[#0B132B] text-white text-xs font-black px-5 py-2.5 rounded-full shadow-md active:scale-95 transition-transform z-10 relative">
              Invite Now
            </button>
          </div>

        </div>
      </div>

      {/* Dedicated Full Screen Game Overlays */}
      {activeGame === 'snake' && (
        <SnakeGame 
          onClose={handleCloseGame} 
          addCoins={(amount) => handleRecordPlay('snake', amount)} 
        />
      )}
      {activeGame === 'speedTap' && (
        <SpeedTapGame 
          onClose={handleCloseGame} 
          addCoins={(amount) => handleRecordPlay('speedTap', amount)} 
        />
      )}
      {activeGame === 'ticTacToe' && (
        <TicTacToeGame 
          onClose={handleCloseGame} 
          addCoins={(amount) => handleRecordPlay('ticTacToe', amount)} 
        />
      )}
      {activeGame === 'quiz' && (
        <QuizGame 
          onClose={handleCloseGame} 
          addCoins={(amount) => handleRecordPlay('quiz', amount)} 
          questions={selectedGameData?.questions}
        />
      )}

      {/* Custom Share Modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center"
          onClick={() => setShowShareModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Bottom Sheet */}
          <div
            className="relative w-full max-w-md bg-surface rounded-t-3xl shadow-2xl p-6 pb-10 animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'slideUp 0.3s ease-out' }}
          >
            {/* Handle */}
            <div className="w-10 h-1.5 bg-surface rounded-full mx-auto mb-5" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black text-[#071226]">Invite Friends</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Share & earn 100 coins per invite</p>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-slate-500 hover:bg-surface transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Share Options */}
            <div className="flex justify-around mb-6">
              {shareOptions.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => { opt.action(); setShowShareModal(false); }}
                  className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
                    style={{ background: opt.bg, border: `1.5px solid ${opt.color}20` }}
                  >
                    {opt.icon}
                  </div>
                  <span className="text-[11px] font-bold text-slate-600">{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-surface" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">or copy link</span>
              <div className="flex-1 h-px bg-surface" />
            </div>

            {/* Copy Link Row */}
            <div className="flex items-center gap-3 bg-surface border border-white/10 rounded-2xl px-4 py-3">
              <span className="flex-1 text-xs text-slate-500 font-medium truncate">{shareUrl}</span>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 bg-[#0B132B] text-white text-[11px] font-black px-3 py-1.5 rounded-xl active:scale-95 transition-all shadow-sm flex-shrink-0"
              >
                {linkCopied ? <Check size={12} /> : <Copy size={12} />}
                {linkCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
