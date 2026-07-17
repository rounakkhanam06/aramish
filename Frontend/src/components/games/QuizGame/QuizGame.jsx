import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QuizQuestionCard from './QuizQuestionCard';
import QuizResult from './QuizResult';

// Hardcoded premium quiz data
const QUIZ_DATA = [
  {
    id: 1,
    question: "Which product is best for dry skin?",
    highlighted: "dry skin?",
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=600&auto=format&fit=crop",
    brand: "GLOW CARE",
    productName: "Hydrating Moisturizer",
    options: ["Oil Control Face Wash", "Hydrating Moisturizer", "Brightening Serum", "Acne Pimple Gel"],
    correctIdx: 1
  },
  {
    id: 2,
    question: "What should you apply before stepping out in the sun?",
    highlighted: "in the sun?",
    image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=600&auto=format&fit=crop",
    brand: "SUN SHIELD",
    productName: "SPF 50 Sunscreen",
    options: ["Body Lotion", "SPF 50 Sunscreen", "Night Cream", "Face Scrub"],
    correctIdx: 1
  },
  {
    id: 3,
    question: "Which ingredient is known for anti-aging benefits?",
    highlighted: "anti-aging",
    image: "https://images.unsplash.com/photo-1629198688000-71f23e745b6e?q=80&w=600&auto=format&fit=crop",
    brand: "YOUTH RENEW",
    productName: "Retinol Serum 1%",
    options: ["Salicylic Acid", "Vitamin C", "Retinol", "Aloe Vera"],
    correctIdx: 2
  },
  {
    id: 4,
    question: "What is the best fabric for summer clothing?",
    highlighted: "summer clothing?",
    image: "https://images.unsplash.com/photo-1589465885857-44edb59bbff2?q=80&w=600&auto=format&fit=crop",
    brand: "URBAN STYLE",
    productName: "Linen Blend Shirt",
    options: ["Polyester", "Wool", "Linen", "Velvet"],
    correctIdx: 2
  },
  {
    id: 5,
    question: "Which gadget helps track your daily steps & heart rate?",
    highlighted: "steps & heart rate?",
    image: "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?q=80&w=600&auto=format&fit=crop",
    brand: "FIT TECH",
    productName: "Smart Fitness Watch",
    options: ["Smartwatch", "Bluetooth Speaker", "Wireless Earbuds", "Power Bank"],
    correctIdx: 0
  }
];

export default function QuizGame({ onClose, addCoins, questions }) {
  const activeQuestions = (questions && questions.length > 0) ? questions : QUIZ_DATA;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('playing'); // 'playing', 'result'
  
  const handleAnswer = (isCorrect) => {
    if (isCorrect) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (currentIdx < activeQuestions.length - 1) {
      setCurrentIdx(c => c + 1);
    } else {
      setGameState('result');
    }
  };

  const handlePlayAgain = () => {
    setCurrentIdx(0);
    setScore(0);
    setGameState('playing');
  };

  const currentQuestion = activeQuestions[currentIdx];

  return (
    <div className="fixed inset-0 z-[100] bg-[#071226] text-slate-900 flex flex-col overflow-hidden font-sans">
      <div className="w-full h-full flex flex-col md:max-w-md md:mx-auto relative">
      <AnimatePresence mode="wait">
        {gameState === 'playing' && (
          <QuizQuestionCard 
            key={`question-${currentIdx}`}
            questionData={currentQuestion}
            currentIndex={currentIdx}
            totalQuestions={activeQuestions.length}
            onAnswer={handleAnswer}
            onNext={handleNext}
            onClose={onClose}
          />
        )}
        
        {gameState === 'result' && (
          <QuizResult 
            key="result"
            score={score}
            total={activeQuestions.length}
            onPlayAgain={handlePlayAgain}
            onClose={onClose}
            addCoins={addCoins}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
