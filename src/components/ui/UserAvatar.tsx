import React from 'react';

interface UserAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  name, 
  size = 'md', 
  className = '' 
}) => {
  // Get the first letter of the name
  const firstLetter = name?.charAt(0)?.toUpperCase() || '?';
  
  // Generate a consistent color based on the name
  const getColorClass = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-gray-500'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const sizeClasses = {
    sm: 'w-5 h-5 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
  };

  const colorClass = getColorClass(name);

  return (
    <div 
      className={`
        ${sizeClasses[size]} 
        ${colorClass} 
        rounded-full 
        flex 
        items-center 
        justify-center 
        text-white 
        font-semibold 
        ${className}
      `}
    >
      {firstLetter}
    </div>
  );
}; 