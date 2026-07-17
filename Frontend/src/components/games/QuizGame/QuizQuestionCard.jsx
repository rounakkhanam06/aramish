import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';

export default function QuizQuestionCard({ questionData, currentIndex, totalQuestions, onAnswer, onNext, onClose }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleOptionClick = (idx) => {
    if (isSubmitted) return;
    setSelectedIdx(idx);
  };

  const handleSubmit = () => {
    if (selectedIdx === null || isSubmitted) return;
    setIsSubmitted(true);
    
    const isCorrect = selectedIdx === questionData.correctIdx;
    onAnswer(isCorrect);
  };

  const handleNext = () => {
    onNext();
  };

  // Extract question parts for highlighting
  const questionText = questionData.question;
  const highlightText = questionData.highlighted;
  
  let parts = [questionText];
  if (highlightText) {
    const splitArr = questionText.split(highlightText);
    if (splitArr.length > 1) {
      parts = [splitArr[0], highlightText, splitArr[1]];
    }
  }

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <motion.div 
      className="flex-1 flex flex-col bg-[#FFF6F2] relative overflow-hidden"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      {/* Header */}
      <div className="bg-[#071226] text-white px-5 py-4 rounded-b-3xl shadow-lg relative z-20">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="p-1 -ml-1 hover:bg-surface/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <span className="font-bold text-lg tracking-wide">Quiz <span className="text-[#0B132B]">Game</span></span>
          <div className="flex items-center gap-1.5 bg-surface/10 px-3 py-1 rounded-full border border-white/10">
            <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-[10px] font-black text-amber-900 shadow-inner">M</div>
            <span className="text-sm font-bold">250</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between">
          <div className="flex-1 flex items-center gap-1 pr-4">
            {[...Array(totalQuestions)].map((_, i) => (
              <React.Fragment key={i}>
                <div className={`w-3 h-3 rounded-full flex-shrink-0 transition-colors duration-500 ${
                  i <= currentIndex ? 'bg-[#0B132B] shadow-[0_0_8px_rgba(238,73,35,0.8)]' : 'bg-slate-600'
                }`} />
                {i < totalQuestions - 1 && (
                  <div className={`flex-1 h-1 transition-colors duration-500 ${
                    i < currentIndex ? 'bg-[#0B132B]' : 'bg-slate-600'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
            Question {currentIndex + 1}/{totalQuestions}
          </span>
        </div>
      </div>

      {/* Background abstract shapes */}
      <div className="absolute top-[20%] right-[-10%] w-64 h-64 bg-[#0B132B] rounded-full blur-[100px] opacity-10 pointer-events-none"></div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-24 pt-6 relative z-10">
        
        {/* Question Area */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-[#0B132B] rounded-full flex items-center justify-center text-white font-black mx-auto mb-4 shadow-lg shadow-[#0B132B]/30">
            Q.
          </div>
          <h2 className="text-2xl font-black text-slate-800 leading-tight mb-2">
            {parts.length === 3 ? (
              <>
                {parts[0]}<span className="text-[#0B132B]">{parts[1]}</span>{parts[2]}
              </>
            ) : questionText}
          </h2>
          <p className="text-slate-500 text-sm font-medium">Choose the best option</p>
        </div>



        {/* Options */}
        <div className="space-y-3">
          {questionData.options.map((option, idx) => {
            const isSelected = selectedIdx === idx;
            const isCorrect = idx === questionData.correctIdx;
            
            let btnClass = "bg-surface border-white/10 text-slate-700 hover:border-[#0B132B]/50";
            let letterClass = "bg-[#071226] text-white";
            let showCheck = false;

            if (isSubmitted) {
              if (isCorrect) {
                btnClass = "bg-[#0B132B] border-[#0B132B] text-white shadow-[0_0_20px_rgba(238,73,35,0.3)]";
                letterClass = "bg-surface text-[#0B132B]";
                showCheck = true;
              } else if (isSelected && !isCorrect) {
                btnClass = "bg-rose-50 border-rose-200 text-rose-900";
                letterClass = "bg-rose-500 text-white";
              } else {
                btnClass = "bg-surface border-white/10 text-slate-400 opacity-60";
              }
            } else if (isSelected) {
              btnClass = "bg-[#0B132B] border-[#0B132B] text-white shadow-[0_0_20px_rgba(238,73,35,0.3)]";
              letterClass = "bg-surface text-[#0B132B]";
            }

            return (
              <motion.button
                key={idx}
                disabled={isSubmitted}
                onClick={() => handleOptionClick(idx)}
                whileTap={!isSubmitted ? { scale: 0.98 } : {}}
                className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all duration-300 text-left ${btnClass}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-colors ${letterClass}`}>
                    {letters[idx]}
                  </div>
                  <span className="font-bold text-sm">{option}</span>
                </div>
                {showCheck && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-white"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#FFF6F2] via-[#FFF6F2] to-transparent z-20 pb-6">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={selectedIdx === null}
            className={`w-full py-4 rounded-2xl font-black text-lg transition-all duration-300 shadow-lg ${
              selectedIdx !== null 
                ? 'bg-[#0B132B] text-white shadow-[#0B132B]/40 active:scale-95' 
                : 'bg-surface text-slate-400 shadow-none'
            }`}
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full py-4 rounded-2xl font-black text-lg transition-all duration-300 bg-[#0B132B] text-white shadow-lg shadow-[#0B132B]/40 active:scale-95 flex items-center justify-center gap-2"
          >
            {currentIndex === totalQuestions - 1 ? 'See Results' : 'Next Question'}
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
