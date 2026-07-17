import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

export default function SplashScreen({ onFinish }) {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    // Load the lottie JSON from the public folder
    fetch('/splash.json')
      .then((res) => res.json())
      .then((data) => setAnimationData(data))
      .catch((err) => console.error("Error loading splash animation", err));

    // Wait for at least 2.5 seconds to show the animation, then hide it
    const timer = setTimeout(() => {
      onFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#02006c] flex items-center justify-center transition-opacity duration-500">
      <div className="w-64 h-64 md:w-80 md:h-80 flex flex-col items-center justify-center">
        {animationData ? (
          <Lottie animationData={animationData} loop={true} />
        ) : (
          <div className="w-10 h-10 rounded-full border-4 border-gold/20 border-t-gold animate-spin" />
        )}
        <h2 className="text-gold font-extrabold text-2xl mt-4 tracking-widest uppercase">Aramish</h2>
      </div>
    </div>
  );
}
