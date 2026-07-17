import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Import local assets
import KitchenImg from '../../assets/Carousel/kitchen-removebg-preview.png';
import MakeupImg from '../../assets/Carousel/mkup-removebg-preview.png';
import ElectronicsImg from '../../assets/Carousel/elctrncs-removebg-preview.png';
import ClothesImg from '../../assets/Carousel/clths-removebg-preview.png';

const slides = [
  {
    id: 1,
    title: "Starting ₹99",
    subtitle: "Budget kitchen store",
    extra: "TOP BRANDS | WIDE SELECTION",
    image: KitchenImg,
    bgColor: "bg-[#81d4fa]", // Light blue
    textColor: "text-gray-900"
  },
  {
    id: 2,
    title: "UNDER ₹499",
    subtitle: "Glam face makeup",
    extra: "Free delivery & 20% cashback on first order*",
    image: MakeupImg,
    bgColor: "bg-[#f48fb1]", // Light pink
    textColor: "text-gray-900"
  },
  {
    id: 3,
    title: "Up to 70% off",
    subtitle: "International electronics",
    extra: "ECOVACS | soundcore | OLEVS",
    image: ElectronicsImg,
    bgColor: "bg-[#ce93d8]", // Light purple
    textColor: "text-gray-900"
  },
  {
    id: 4,
    title: "Fashion Deals",
    subtitle: "Up to 60% off clothing",
    extra: "Latest Trends | Best Prices",
    image: ClothesImg,
    bgColor: "bg-[#a5d6a7]", // Light green
    textColor: "text-gray-900"
  }
];

const Carousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  useEffect(() => {
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`relative w-full h-[300px] md:h-[450px] transition-colors duration-500 ${slides[currentIndex].bgColor}`}>
      {/* Navigation Buttons */}
      <button
        onClick={prevSlide}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-4 text-gray-800 hover:ring-2 hover:ring-black/10 transition-all"
      >
        <ChevronLeft size={48} strokeWidth={1} />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-4 text-gray-800 hover:ring-2 hover:ring-black/10 transition-all"
      >
        <ChevronRight size={48} strokeWidth={1} />
      </button>

      {/* Slide Content */}
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 h-full pt-4 pb-20 w-full">
          {/* Text Content */}
          <div className={`flex-1 max-w-md z-10 md:pl-20 ${slides[currentIndex].textColor}`}>
            <h2 className="text-xl md:text-2xl font-medium mb-1">{slides[currentIndex].title}</h2>
            <p className="text-4xl md:text-6xl font-black mb-6">{slides[currentIndex].subtitle}</p>
            <div className="flex gap-4 text-xs font-bold border-l-2 border-gray-400 pl-4 py-1 mb-8 tracking-wider">
              {slides[currentIndex].extra.split('|').map((tag, i) => (
                <span key={i} className={i > 0 ? "border-l border-gray-400 pl-4" : ""}>{tag.trim()}</span>
              ))}
            </div>

            {/* Promo Tag */}
            <div className="bg-white p-3 shadow-sm rounded-sm flex items-center gap-3 w-fit border border-gray-100">
              <img src="https://m.media-amazon.com/images/G/31/marketing/fba/fba-badge_18._CB485935210_.png" alt="Amazon Pay" className="h-6" />
              <div className="text-[12px] leading-tight font-bold">
                Unlimited 5% cashback
                <div className="text-gray-500 font-normal">with Amazon Pay ICICI Bank credit card</div>
              </div>
            </div>
          </div>

          {/* Image Content */}
          <div className="hidden md:block flex-1 h-full relative max-w-lg">
            <img
              key={currentIndex}
              src={slides[currentIndex].image}
              alt={slides[currentIndex].title}
              className="w-full h-full object-contain object-left animate-in fade-in zoom-in duration-700"
            />
          </div>
        </div>
      </div>

      {/* Gradient Overlay for bottom blending */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#eaeded] to-transparent z-10"></div>
    </div>
  );
};

export default Carousel;
