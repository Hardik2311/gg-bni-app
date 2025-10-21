import React from 'react';
import sellarLogo from '../../assets/sellar-logo-heading.png';
import bgMain from '../../assets/bg-main.png';

const Loading: React.FC = () => {
  return (
    <div
      className="relative h-screen w-screen bg-cover bg-center md:bg-[center_top_75%] pb-16"
      style={{ backgroundImage: `url(${bgMain})` }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex-grow flex items-center justify-center">
          <img src={sellarLogo} alt="Sellar Logo" className="w-48" />
        </div>
      </div>
    </div>
  );
};

export default Loading;
