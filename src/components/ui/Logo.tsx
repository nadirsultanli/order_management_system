import React from 'react';
import LogoSvg from '../../assets/Full_CIRCL_Logo.svg';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12'
  };

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={LogoSvg}
        alt="CIRCL Logo"
        className={`${sizeClasses[size]} w-auto`}
      />
    </div>
  );
}; 