import React from 'react';
import BannerImg from '../../assets/products/product06.webp';

const Hero = () => {
  return (
    <div className="relative w-full overflow-hidden bg-gray-200 mt-2 ml-4">
      {/* Main Banner Image */}
      <div className="relative h-[300px] md:h-[400px] lg:h-[450px] w-full">
        <img 
          src={BannerImg} 
          alt="Hero Banner" 
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

export default Hero;

