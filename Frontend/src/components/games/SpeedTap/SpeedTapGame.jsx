import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IntroScreen from './IntroScreen';
import CountdownScreen from './CountdownScreen';
import GameplayScreen from './GameplayScreen';
import ResultScreen from './ResultScreen';
import RewardsScreen from './RewardsScreen';

export default function SpeedTapGame({ onClose, addCoins }) {
  const [gameState, setGameState] = useState('intro'); // intro, countdown, playing, result, rewards
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(parseInt(localStorage.getItem('speedTapBest')) || 0);
  
  const startGame = () => {
    setScore(0);
    setGameState('countdown');
  };

  const onCountdownEnd = () => {
    setGameState('playing');
  };

  const onGameEnd = (finalScore) => {
    setScore(finalScore);
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      localStorage.setItem('speedTapBest', finalScore.toString());
    }
    setGameState('result');
    
    // Calculate and award coins automatically when game finishes
    let rewardAmount = 5;
    if (finalScore >= 100) rewardAmount = 100;
    else if (finalScore >= 80) rewardAmount = 80;
    else if (finalScore >= 40) rewardAmount = 40;
    
    if (addCoins) {
      addCoins(rewardAmount);
    }
  };

  const claimReward = (amount) => {
    // Coins already added onGameEnd, just proceed to rewards view
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#071226] text-white flex flex-col overflow-hidden">
      <div className="w-full h-full flex flex-col md:max-w-md md:mx-auto relative">
      <AnimatePresence mode="wait">
        {gameState === 'intro' && (
          <IntroScreen 
            key="intro" 
            bestScore={bestScore} 
            onStart={startGame} 
            onClose={onClose}
            onViewRewards={() => setGameState('rewards')}
          />
        )}
        
        {gameState === 'countdown' && (
          <CountdownScreen 
            key="countdown" 
            onComplete={onCountdownEnd} 
          />
        )}
        
        {gameState === 'playing' && (
          <GameplayScreen 
            key="playing" 
            onGameEnd={onGameEnd} 
          />
        )}
        
        {gameState === 'result' && (
          <ResultScreen 
            key="result" 
            score={score} 
            bestScore={bestScore} 
            onPlayAgain={startGame} 
            onClose={onClose}
            claimReward={claimReward}
            onViewRewards={() => setGameState('rewards')}
          />
        )}
        
        {gameState === 'rewards' && (
          <RewardsScreen 
            key="rewards" 
            bestScore={bestScore}
            onBack={() => setGameState('intro')}
          />
        )}
        
      </AnimatePresence>
      </div>
    </div>
  );
}
