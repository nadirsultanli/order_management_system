import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Menu, User } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { adminUser, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          <Menu className="h-6 w-6 text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">
          LPG Order Management
        </h1>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <User className="h-4 w-4" />
            <div className="flex flex-col items-end">
              <span className="font-medium text-gray-900">{adminUser?.name}</span>
              <span className="text-xs text-gray-500">{adminUser?.email}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleSignOut}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};