

import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-[2320px] text-center p-6 mt-8 text-sm text-light-text-secondary dark:text-dark-text-secondary transition-colors">
      <div className="flex items-center justify-center gap-4">
        <span>© {new Date().getFullYear()} Todos os direitos reservados.</span>
      </div>
    </footer>
  );
};

export default Footer;