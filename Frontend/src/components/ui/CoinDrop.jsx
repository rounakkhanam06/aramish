import React, { useEffect, useState } from 'react';
import { getImageUrl } from '../../utils/imageHelper';

export default function CoinDrop({ count = 20, onComplete }) {
  const [coins, setCoins] = useState([]);

  useEffect(() => {
    // Generate coins with random properties
    const newCoins = Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100, // percentage
      delay: Math.random() * 2, // seconds
      duration: 1.5 + Math.random() * 1.5, // seconds
      size: 24 + Math.random() * 24, // px
      rotation: Math.random() * 360,
    }));
    setCoins(newCoins);

    // Auto-remove after animation completes
    const maxDuration = Math.max(...newCoins.map(c => c.delay + c.duration));
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, (maxDuration + 0.5) * 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  if (coins.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <style>{`
        @keyframes coinFall {
          0% {
            transform: translateY(-100px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 1;
          }
        }
      `}</style>
      {coins.map(coin => (
        <div
          key={coin.id}
          className="absolute top-0 text-3xl drop-shadow-xl"
          style={{
            left: `${coin.left}%`,
            width: `${coin.size}px`,
            height: `${coin.size}px`,
            animation: `coinFall ${coin.duration}s ease-in ${coin.delay}s forwards`,
            opacity: 0, // initially hidden before animation
            transform: `translateY(-100px) rotate(${coin.rotation}deg)`,
          }}
        >
          🪙
        </div>
      ))}
    </div>
  );
}
