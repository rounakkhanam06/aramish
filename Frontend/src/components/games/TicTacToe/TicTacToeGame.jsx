import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TicTacHome from './TicTacHome';
import TicTacGameplay from './TicTacGameplay';
import TicTacResult from './TicTacResult';
import TicTacHowToPlay from './TicTacHowToPlay';

export default function TicTacToeGame({ onClose, addCoins }) {
  const [gameState, setGameState] = useState('home'); // home, playing, result, tutorial
  const [gameMode, setGameMode] = useState('computer'); // 'computer' or 'friend'
  const [result, setResult] = useState(null); // { winner: 'X' | 'O' | 'Draw', combo: [] }

  const startGame = (mode) => {
    setGameMode(mode);
    setResult(null);
    setGameState('playing');
  };

  const onGameEnd = (endResult) => {
    setResult(endResult);
    setGameState('result');
    // Log play immediately!
    let rewardAmount = endResult.winner === 'X' ? 50 : 10;
    if (addCoins) {
      addCoins(rewardAmount);
    }
  };

  const handleClaimReward = (amount) => {
    // Coins already added onGameEnd
  };

  return (
    <div className="fixed inset-0 z-[100] bg-surface text-slate-900 flex flex-col overflow-hidden">
      <div className="w-full h-full flex flex-col md:max-w-md md:mx-auto relative">
      <AnimatePresence mode="wait">
        {gameState === 'home' && (
          <TicTacHome 
            key="home" 
            onStart={startGame} 
            onClose={onClose}
            onViewTutorial={() => setGameState('tutorial')}
          />
        )}
        
        {gameState === 'playing' && (
          <TicTacGameplay 
            key="playing" 
            mode={gameMode}
            onGameEnd={onGameEnd} 
            onBack={() => setGameState('home')}
          />
        )}
        
        {gameState === 'result' && (
          <TicTacResult 
            key="result" 
            result={result}
            mode={gameMode}
            onPlayAgain={() => startGame(gameMode)} 
            onHome={() => setGameState('home')}
            claimReward={handleClaimReward}
          />
        )}
        
        {gameState === 'tutorial' && (
          <TicTacHowToPlay 
            key="tutorial" 
            onBack={() => setGameState('home')}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
