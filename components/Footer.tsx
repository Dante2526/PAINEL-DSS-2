import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-fit mx-auto bg-light-card dark:bg-dark-card rounded-3xl px-8 py-4 mt-8 shadow-lg text-center text-sm text-light-text-secondary dark:text-dark-text-secondary transition-colors">
      <div className="flex items-center justify-center gap-4">
        <span className="font-bold opacity-70 tracking-wider">DESENVOLVIDO POR NEAR</span>
      </div>
    </footer>
  );
};

export default Footer;