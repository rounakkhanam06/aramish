import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings, RotateCcw, X as XIcon, Circle, Bot, User } from 'lucide-react';

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export default function TicTacGameplay({ mode, onGameEnd, onBack }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winningCombo, setWinningCombo] = useState(null);
  
  const checkWinner = (squares) => {
    for (let i = 0; i < WINNING_COMBOS.length; i++) {
      const [a, b, c] = WINNING_COMBOS[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], combo: WINNING_COMBOS[i] };
      }
    }
    if (!squares.includes(null)) return { winner: 'Draw', combo: [] };
    return null;
  };

  const handleClick = (index) => {
    if (board[index] || winningCombo) return;
    
    // In computer mode, prevent clicking if it's O's turn
    if (mode === 'computer' && !isXNext) return;

    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    setIsXNext(!isXNext);
  };

  // Computer Move Logic
  useEffect(() => {
    if (mode === 'computer' && !isXNext && !winningCombo) {
      const timer = setTimeout(() => {
        const result = checkWinner(board);
        if (result) return; // game over

        const emptyIndices = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
        if (emptyIndices.length > 0) {
          // Simple random AI for now
          const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          const newBoard = [...board];
          newBoard[randomIdx] = 'O';
          setBoard(newBoard);
          setIsXNext(true);
        }
      }, 600); // 600ms AI delay
      
      return () => clearTimeout(timer);
    }
  }, [board, isXNext, mode, winningCombo]);

  // Check winner effect
  useEffect(() => {
    const result = checkWinner(board);
    if (result) {
      setWinningCombo(result.combo);
      setTimeout(() => {
        onGameEnd(result);
      }, 1000); // 1s delay before moving to result screen
    }
  }, [board, onGameEnd]);

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setWinningCombo(null);
  };

  return (
    <motion.div 
      className="flex-1 flex flex-col bg-surface relative overflow-hidden"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-surface rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
          <span className="font-bold text-sm tracking-wide uppercase text-slate-800">
            {mode === 'computer' ? 'VS Computer' : 'VS Friend'}
          </span>
        </div>
      </div>

      {/* VS Banner */}
      <div className="px-4 mb-8">
        <div className="bg-[#071226] rounded-2xl p-1 flex items-stretch shadow-md overflow-hidden relative">
          <div className={`flex-1 flex items-center justify-start gap-3 p-3 rounded-xl transition-colors ${isXNext ? 'bg-[#1a2a47]' : ''}`}>
            <div className="w-10 h-10 bg-slate-700 rounded-full border-2 border-[#071226] flex items-center justify-center text-white">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] font-black text-white uppercase tracking-widest leading-none mb-1">YOU</span>
              <XIcon className="w-5 h-5 text-slate-300" strokeWidth={3} />
            </div>
          </div>
          
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-surface rounded-full flex items-center justify-center shadow-lg z-10 text-[10px] font-black text-slate-800">
            VS
          </div>
          
          <div className={`flex-1 flex items-center justify-end gap-3 p-3 rounded-xl transition-colors ${!isXNext ? 'bg-[#0B132B]' : ''}`}>
            <div className="text-right">
              <span className="block text-[10px] font-black text-white uppercase tracking-widest leading-none mb-1">
                {mode === 'computer' ? 'COMPUTER' : 'FRIEND'}
              </span>
              <Circle className="w-4 h-4 text-white ml-auto" strokeWidth={4} />
            </div>
            <div className="w-10 h-10 bg-surface rounded-full border-2 border-[#071226] flex items-center justify-center text-gold">
              {mode === 'computer' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full aspect-square bg-surface rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.05)] p-4 relative border border-white/10">
          <div className="grid grid-cols-3 grid-rows-3 gap-2 w-full h-full relative z-10">
            {board.map((cell, idx) => (
              <button
                key={idx}
                onClick={() => handleClick(idx)}
                className={`rounded-2xl flex items-center justify-center transition-colors ${
                  !cell && !winningCombo ? 'hover:bg-surface cursor-pointer active:scale-95' : ''
                } ${
                  winningCombo?.includes(idx) ? 'bg-gold/10' : ''
                }`}
              >
                <AnimatePresence>
                  {cell === 'X' && (
                    <motion.div
                      initial={{ scale: 0.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                      className="text-[#071226]"
                    >
                      <XIcon className="w-16 h-16 drop-shadow-sm" strokeWidth={3} />
                    </motion.div>
                  )}
                  {cell === 'O' && (
                    <motion.div
                      initial={{ scale: 0.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                      className="text-[#0B132B]"
                    >
                      <Circle className="w-14 h-14 drop-shadow-sm" strokeWidth={4} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>

          {/* Grid Lines (Decorative) */}
          <div className="absolute inset-4 pointer-events-none">
            <div className="absolute top-1/3 left-0 w-full h-[2px] bg-surface rounded-full"></div>
            <div className="absolute top-2/3 left-0 w-full h-[2px] bg-surface rounded-full"></div>
            <div className="absolute top-0 left-1/3 w-[2px] h-full bg-surface rounded-full"></div>
            <div className="absolute top-0 left-2/3 w-[2px] h-full bg-surface rounded-full"></div>
          </div>
          
          {/* Winning Line Overlay */}
          {winningCombo && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ padding: '16px' }}>
              <motion.line
                x1={`${(winningCombo[0] % 3) * 33.33 + 16.66}%`}
                y1={`${Math.floor(winningCombo[0] / 3) * 33.33 + 16.66}%`}
                x2={`${(winningCombo[2] % 3) * 33.33 + 16.66}%`}
                y2={`${Math.floor(winningCombo[2] / 3) * 33.33 + 16.66}%`}
                stroke="#0B132B"
                strokeWidth="6"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{ dropShadow: '0 0 10px rgba(255, 90, 31, 0.5)' }}
              />
            </svg>
          )}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-6 space-y-6">
        <div className="text-center flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            {winningCombo ? 'GAME OVER' : isXNext ? 'YOUR TURN' : `${mode === 'computer' ? 'COMPUTER' : 'FRIEND'}'S TURN`}
          </span>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={resetGame}
            className="flex-1 bg-surface border border-white/10 text-slate-700 font-bold text-sm py-4 rounded-2xl flex items-center justify-center gap-2 shadow-sm hover:bg-surface active:scale-95 transition-all"
          >
            <RotateCcw className="w-4 h-4" /> RESTART
          </button>
          <button 
            onClick={resetGame}
            className="flex-1 bg-[#0B132B] text-white font-black text-sm py-4 rounded-2xl shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] active:scale-95 transition-all"
          >
            NEW GAME
          </button>
        </div>
      </div>
    </motion.div>
  );
}
