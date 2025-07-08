import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, User } from 'lucide-react';
import { TokenStatus } from '../auth/TokenStatus';

export const Header: React.FC = () => {
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
        <h1 className="text-xl font-semibold text-gray-900">
          LPG Order Management
        </h1>
        
        {/* Show token status in development */}
        {!import.meta.env.PROD && (
          <div className="ml-8">
            <TokenStatus />
          </div>
        )}
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