import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Trophy, ArrowUp, ArrowDown, ArrowLeft as ArrowLeftIcon, ArrowRight, Gift, Pause, Play } from 'lucide-react';
import DollAramish from '../../assets/DollAramish-removebg-preview.webp';

const GRID_W = 16;
const GRID_H = 20;

const INITIAL_SNAKE = [
  { x: 8, y: 10 },
  { x: 8, y: 11 },
  { x: 8, y: 12 },
];

const INITIAL_DIRECTION = 'UP';

const getRandomCoord = (excludeList = []) => {
  let coord;
  while (true) {
    coord = {
      x: Math.floor(Math.random() * GRID_W),
      y: Math.floor(Math.random() * GRID_H)
    };
    // eslint-disable-next-line no-loop-func
    const isOccupied = excludeList.some(item => item.x === coord.x && item.y === coord.y);
    if (!isOccupied) break;
  }
  return coord;
};

export default function SnakeGame({ onClose, addCoins }) {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  // To prevent multiple rapid key presses causing reverse movement bug
  const directionRef = useRef(INITIAL_DIRECTION); 
  
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [bomb, setBomb] = useState({ x: 12, y: 15 });
  
  const [status, setStatus] = useState('IDLE'); // IDLE, PLAYING, GAME_OVER
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [time, setTime] = useState(0);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const startGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    directionRef.current = INITIAL_DIRECTION;
    setScore(0);
    setTime(0);
    setEarnedCoins(0);
    setFood(getRandomCoord(INITIAL_SNAKE));
    setBomb(getRandomCoord([...INITIAL_SNAKE, food]));
    setStatus('PLAYING');
  };

  const gameOver = () => {
    setStatus('GAME_OVER');
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snakeHighScore', score.toString());
    }
    const reward = Math.floor(score / 5);
    setEarnedCoins(reward);
    if (addCoins) {
       addCoins(reward);
    }
  };

  const togglePause = () => {
    setStatus(prev => prev === 'PLAYING' ? 'PAUSED' : (prev === 'PAUSED' ? 'PLAYING' : prev));
  };

  // Timer
  useEffect(() => {
    if (status !== 'PLAYING') return;
    const timerId = setInterval(() => setTime(t => t + 1), 1000);
    return () => clearInterval(timerId);
  }, [status]);

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (status !== 'PLAYING' && status !== 'PAUSED') return;
      
      if (e.key === ' ' || e.key === 'p' || e.key === 'Escape') {
        togglePause();
        return;
      }

      if (status !== 'PLAYING') return;

      const currentDir = directionRef.current;
      switch (e.key) {
        case 'ArrowUp':
          if (currentDir !== 'DOWN') setDirection('UP');
          break;
        case 'ArrowDown':
          if (currentDir !== 'UP') setDirection('DOWN');
          break;
        case 'ArrowLeft':
          if (currentDir !== 'RIGHT') setDirection('LEFT');
          break;
        case 'ArrowRight':
          if (currentDir !== 'LEFT') setDirection('RIGHT');
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status]);

  // Update direction ref whenever it changes so game loop uses latest
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  // Game Loop
  useEffect(() => {
    if (status !== 'PLAYING') return;

    const moveSnake = () => {
      setSnake(prevSnake => {
        const head = prevSnake[0];
        const newHead = { ...head };

        switch (direction) {
          case 'UP': newHead.y -= 1; break;
          case 'DOWN': newHead.y += 1; break;
          case 'LEFT': newHead.x -= 1; break;
          case 'RIGHT': newHead.x += 1; break;
          default: break;
        }

        // 1. Wall Collision
        if (newHead.x < 0 || newHead.x >= GRID_W || newHead.y < 0 || newHead.y >= GRID_H) {
          gameOver();
          return prevSnake;
        }

        // 2. Self Collision
        if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          gameOver();
          return prevSnake;
        }

        // 3. Bomb Collision
        if (newHead.x === bomb.x && newHead.y === bomb.y) {
          gameOver();
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        // 4. Food Collision
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => s + 50);
          setFood(getRandomCoord([...newSnake, bomb]));
          
          // Move bomb every time food is eaten
          if (Math.random() > 0.5) {
             setBomb(getRandomCoord([...newSnake, food]));
          }
        } else {
          newSnake.pop(); // Remove tail if no food eaten
        }

        return newSnake;
      });
    };

    const intervalId = setInterval(moveSnake, 240);
    return () => clearInterval(intervalId);
  }, [status, direction, food, bomb]);

  // Format Time
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Swipe logic
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 30;

  const onTouchStartEvent = (e) => {
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMoveEvent = (e) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchEndEvent = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (distanceX > minSwipeDistance) handleControlClick('LEFT');
      if (distanceX < -minSwipeDistance) handleControlClick('RIGHT');
    } else {
      if (distanceY > minSwipeDistance) handleControlClick('UP');
      if (distanceY < -minSwipeDistance) handleControlClick('DOWN');
    }
  };

  // Render Helpers
  const handleControlClick = (newDir) => {
    if (status !== 'PLAYING') return;
    const currentDir = directionRef.current;
    if (newDir === 'UP' && currentDir !== 'DOWN') setDirection('UP');
    if (newDir === 'DOWN' && currentDir !== 'UP') setDirection('DOWN');
    if (newDir === 'LEFT' && currentDir !== 'RIGHT') setDirection('LEFT');
    if (newDir === 'RIGHT' && currentDir !== 'LEFT') setDirection('RIGHT');
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-[#070B19] flex flex-col font-sans animate-fade-in pb-12 overflow-y-auto overscroll-none touch-none"
      onTouchStart={onTouchStartEvent}
      onTouchMove={onTouchMoveEvent}
      onTouchEnd={onTouchEndEvent}
    >
      <div className="w-full flex-grow flex flex-col md:max-w-md md:mx-auto relative">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between p-5 pt-8">
        <button 
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/50 text-white border border-slate-700/50 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex gap-3">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-full px-4 py-2 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-white font-black text-sm font-syne tracking-wider">{highScore}</span>
          </div>
          
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-full px-4 py-2 flex items-center gap-2">
            <span className="text-white font-bold text-sm tracking-wider font-mono">{formatTime(time)}</span>
          </div>
          
          <button
            onClick={togglePause}
            disabled={status === 'IDLE' || status === 'GAME_OVER'}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/50 text-white border border-slate-700/50 active:scale-95 transition-transform disabled:opacity-50"
          >
            {status === 'PAUSED' ? <Play className="w-5 h-5 text-emerald-400" /> : <Pause className="w-5 h-5 text-gold" />}
          </button>
        </div>
      </div>

      {/* Main Game Screen UI */}
      <div className="flex-grow flex flex-col items-center px-6 pt-2">
        
        {/* Current Score Display */}
        <div className="text-white text-3xl font-black font-syne mb-2 drop-shadow-md">
          {score}
        </div>

        {/* Game Grid Box */}
        <div 
          className="w-full aspect-[4/5] rounded-3xl border-2 border-orange-500 relative overflow-hidden shadow-[0_0_25px_rgba(255,110,84,0.15)] bg-[#0A1024]"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
            backgroundSize: `${100 / GRID_W}% ${100 / GRID_H}%`
          }}
        >
          {status === 'IDLE' && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-30 backdrop-blur-sm">
               <div className="text-6xl mb-4 animate-bounce">🐍</div>
               <h2 className="text-white text-xl font-black uppercase tracking-widest mb-6 font-syne">Snake & Chase</h2>
               <button onClick={startGame} className="bg-gold text-white font-black px-8 py-3 rounded-full shadow-lg shadow-gold/50 active:scale-95 transition-transform uppercase tracking-wider">Start Game</button>
            </div>
          )}

          {status === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-30 backdrop-blur-sm">
               <div className="text-5xl mb-2">💥</div>
               <h2 className="text-red-500 text-2xl font-black uppercase tracking-widest mb-2 font-syne drop-shadow-sm">Game Over</h2>
               <p className="text-white font-bold mb-2">Score: {score}</p>
               {earnedCoins > 0 && (
                 <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/50 px-4 py-1.5 rounded-full mb-4">
                   <span className="text-amber-400 font-bold text-sm">+{earnedCoins}</span>
                   <span className="text-xs font-bold text-amber-200">Coins Added!</span>
                 </div>
               )}
               {earnedCoins === 0 && <div className="h-4 mb-4"></div>}
               <button onClick={startGame} className="bg-gold text-white font-black px-8 py-3 rounded-full shadow-lg shadow-gold/50 active:scale-95 transition-transform uppercase tracking-wider">Play Again</button>
            </div>
          )}

          {status === 'PAUSED' && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-30 backdrop-blur-sm">
               <div className="text-5xl mb-4">⏸️</div>
               <h2 className="text-white text-xl font-black uppercase tracking-widest mb-6 font-syne drop-shadow-sm">Paused</h2>
               <button onClick={togglePause} className="bg-gold text-white font-black px-8 py-3 rounded-full shadow-lg shadow-gold/50 active:scale-95 transition-transform uppercase tracking-wider">Resume</button>
            </div>
          )}

          {/* Render Snake */}
          {snake.map((segment, index) => {
            const isHead = index === 0;
            return (
              <div 
                key={index}
                className="absolute flex items-center justify-center"
                style={{
                  left: `${(segment.x / GRID_W) * 100}%`,
                  top: `${(segment.y / GRID_H) * 100}%`,
                  width: `${100 / GRID_W}%`,
                  height: `${100 / GRID_H}%`,
                  transition: 'left 0.15s linear, top 0.15s linear'
                }}
              >
                {isHead ? (
                  <div className="w-[120%] h-[120%] bg-surface rounded-full shadow-lg flex items-center justify-center relative z-20">
                    <div className="flex gap-[2px] mb-[2px]">
                      <div className="w-[3px] h-[4px] rounded-full bg-black"></div>
                      <div className="w-[3px] h-[4px] rounded-full bg-black"></div>
                    </div>
                  </div>
                ) : (
                  <div className="w-[90%] h-[90%] bg-surface rounded-full shadow-sm z-10"></div>
                )}
              </div>
            );
          })}

          {/* Render Food (Doll) */}
          <div 
            className="absolute flex items-center justify-center z-10 animate-bounce"
            style={{
              left: `${(food.x / GRID_W) * 100}%`,
              top: `${(food.y / GRID_H) * 100}%`,
              width: `${100 / GRID_W}%`,
              height: `${100 / GRID_H}%`
            }}
          >
             <div className="absolute -inset-4 bg-gold/20 rounded-full blur-xl"></div>
             <img src={DollAramish} alt="Doll" className="w-[170%] h-[170%] object-contain relative z-20 drop-shadow-md" />
          </div>

          {/* Render Bomb */}
          <div 
            className="absolute flex items-center justify-center z-10"
            style={{
              left: `${(bomb.x / GRID_W) * 100}%`,
              top: `${(bomb.y / GRID_H) * 100}%`,
              width: `${100 / GRID_W}%`,
              height: `${100 / GRID_H}%`
            }}
          >
             <div className="w-[120%] h-[120%] rounded-full bg-slate-800 shadow-lg border border-slate-700 flex flex-col items-center justify-start relative">
               <div className="w-[3px] h-[6px] bg-slate-600 -mt-[4px] rounded-t-sm"></div>
               <div className="w-[4px] h-[4px] rounded-full bg-gold absolute -top-[5px] shadow-[0_0_6px_#f97316]"></div>
             </div>
          </div>
          
        </div>

        {/* Info Columns */}
        <div className="flex justify-between items-start mt-8 w-full text-center font-serif">
          <div className="flex flex-col items-center flex-1 px-1">
            <h4 className="text-gold font-bold text-[11px] uppercase tracking-tighter mb-0.5 whitespace-nowrap">Chase</h4>
            <p className="text-slate-300 text-[9px] leading-tight tracking-tight">Chase the doll and catch it!</p>
          </div>
          <div className="flex flex-col items-center flex-1 px-1 border-x border-slate-700/50">
            <h4 className="text-gold font-bold text-[11px] uppercase tracking-tighter mb-0.5 whitespace-nowrap">Grow</h4>
            <p className="text-slate-300 text-[9px] leading-tight tracking-tight">Catch to grow your snake longer!</p>
          </div>
          <div className="flex flex-col items-center flex-1 px-1">
            <h4 className="text-gold font-bold text-[11px] uppercase tracking-tighter mb-0.5 whitespace-nowrap">Win Rewards</h4>
            <p className="text-slate-300 text-[9px] leading-tight tracking-tight">Beat your high score & win exciting rewards!</p>
          </div>
        </div>

        {/* Bottom Promotional Banner */}
        <div className="mt-6 w-full rounded-3xl border border-slate-700/80 bg-gradient-to-b from-slate-800 to-[#0A1024] p-3 flex flex-col items-center relative overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between w-full relative z-10 gap-2">
            
            {/* Doll Mascot Graphic */}
            <div className="relative w-16 h-16 flex-shrink-0">
               <img src={DollAramish} alt="Doll Mascot" className="w-full h-full object-contain drop-shadow-lg" />
            </div>

            {/* Text and Rewards Box */}
            <div className="flex-grow flex flex-col items-start">
              <div className="flex items-baseline gap-1 mb-1">
                <h3 className="text-white font-black text-[10px] tracking-wider uppercase">Catch the doll.</h3>
                <h3 className="text-gold font-black text-xs tracking-wider uppercase">Grow Longer.</h3>
              </div>
              <h2 className="text-white font-black text-sm tracking-widest uppercase mb-2 flex items-center gap-1">
                <span className="text-gold text-xs">✨</span> WIN BIG! <span className="text-gold text-xs">✨</span>
              </h2>

              {/* Rewards inner box */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2 w-full">
                <h5 className="text-slate-300 text-[8px] font-bold text-center tracking-widest mb-1.5 uppercase">Possible Rewards</h5>
                <div className="flex justify-between px-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-md border border-amber-200 text-white font-black text-[9px]">M</div>
                    <span className="text-[7px] text-slate-400 font-bold">Coins</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Gift className="w-5 h-5 text-rose-400" />
                    <span className="text-[7px] text-slate-400 font-bold">Mystery Box</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span className="text-[7px] text-slate-400 font-bold">Bonus Points</span>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>

      </div>
      </div>
    </div>
  );
}
