import React from 'react';
import LogoSvg from '../../assets/Full_CIRCL_Logo.svg';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-8',     // 32px - for collapsed sidebar
    md: 'h-10',    // 40px - for expanded sidebar
    lg: 'h-12',    // 48px - for larger contexts
    xl: 'h-16'     // 64px - for hero sections
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={LogoSvg}
        alt="CIRCL Logo"
        className={`${sizeClasses[size]} w-auto transition-all duration-300`}
      />
    </div>
  );
}; 