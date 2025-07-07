import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { CollapsibleSidebar } from './CollapsibleSidebar';

export const AppLayout: React.FC = () => {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Debug log
  console.log('AppLayout rendering with CollapsibleSidebar');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const contentMarginLeft = isMobile ? 0 : (sidebarExpanded ? 256 : 64);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Debug indicator */}
      <div className="fixed top-0 right-0 z-50 bg-green-500 text-white p-2 text-xs">
        NEW SIDEBAR ACTIVE
      </div>
      
      {/* Collapsible Sidebar */}
      <CollapsibleSidebar onExpandChange={setSidebarExpanded} />
      
      {/* Main content area - adjusts margin based on sidebar state */}
      <div 
        className="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          marginLeft: `${contentMarginLeft}px`
        }}
      >
        {/* Header */}
        <Header />
        
        {/* Main content with responsive padding */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};