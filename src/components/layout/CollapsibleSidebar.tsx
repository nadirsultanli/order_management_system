import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus,
  Package, 
  ShoppingCart, 
  DollarSign, 
  Warehouse,
  Menu,
  Pin,
  PinOff,
  Truck,
  ArrowLeftRight,
  X,
  BarChart3,
  Route
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { UserAvatar } from '../ui/UserAvatar';
import { useAuth } from '../../contexts/AuthContext';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface CollapsibleSidebarProps {
  onExpandChange?: (expanded: boolean) => void;
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({ onExpandChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    // Load pin state from localStorage
    const saved = localStorage.getItem('sidebarPinned');
    return saved === 'true';
  });
  const [isHovering, setIsHovering] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showScrollbar, setShowScrollbar] = useState(false);
  const expandTimeout = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  const { adminUser } = useAuth();

  const menuItems: MenuItem[] = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/customers', label: 'Customers', icon: Users },
    { path: '/users', label: 'Users', icon: UserPlus },
    { path: '/products', label: 'Products', icon: Package },
    { path: '/warehouses', label: 'Warehouses', icon: Warehouse },
    { path: '/inventory', label: 'Inventory', icon: BarChart3 },
    { path: '/trucks', label: 'Trucks', icon: Truck },
    { path: '/trips', label: 'Trip Management', icon: Route },
    { path: '/pricing', label: 'Pricing', icon: DollarSign },
    { path: '/orders', label: 'Orders', icon: ShoppingCart },
    { path: '/transfers', label: 'Transfers', icon: ArrowLeftRight }
  ];

  // Determine if sidebar should be expanded
  const shouldExpand = isPinned || isHovering;

  useEffect(() => {
    setIsExpanded(shouldExpand);
    onExpandChange?.(shouldExpand);
  }, [shouldExpand, onExpandChange]);

  // Show/hide scrollbar with animation delay
  useEffect(() => {
    if (isExpanded || isMobileOpen) {
      // Delay showing scrollbar until after expand animation (500ms)
      expandTimeout.current && clearTimeout(expandTimeout.current);
      expandTimeout.current = setTimeout(() => {
        setShowScrollbar(true);
      }, 500);
    } else {
      // Hide scrollbar immediately when collapsing
      expandTimeout.current && clearTimeout(expandTimeout.current);
      setShowScrollbar(false);
    }
    // Cleanup on unmount
    return () => {
      expandTimeout.current && clearTimeout(expandTimeout.current);
    };
  }, [isExpanded, isMobileOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  // Save pin state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarPinned', isPinned.toString());
  }, [isPinned]);

  const handleMouseEnter = () => {
    if (!isPinned) {
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      setIsHovering(false);
    }
  };

  const togglePin = () => {
    setIsPinned(!isPinned);
    if (!isPinned) {
      setIsHovering(false);
    }
  };

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg shadow-lg hover:bg-gray-800 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed left-0 top-0 h-full bg-gray-900 text-white
          transition-all duration-500 ease-in-out z-40 group
          ${isExpanded ? 'w-64 shadow-2xl' : 'w-16 shadow-lg'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Logo/Brand Area */}
        <div className="h-16 flex items-center justify-center px-4 py-2 border-b border-gray-800 bg-gray-800">
          <div className="flex items-center justify-center w-full">
            {(isExpanded || isMobileOpen) ? (
              <Logo size="lg" className="drop-shadow-sm" />
            ) : (
              <Logo size="sm" className="drop-shadow-sm" />
            )}
          </div>
          {/* Mobile close button */}
          {isMobileOpen && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1 hover:bg-gray-700 rounded-lg transition-colors absolute right-4"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className={`flex-1 py-4 ${showScrollbar && (isExpanded || isMobileOpen) ? 'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent' : 'overflow-hidden'}`}>
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`
                      flex items-center px-3 py-2.5 rounded-lg
                      transition-all duration-200 relative group
                      ${active 
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-[1.02]' 
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white hover:translate-x-1'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'animate-pulse' : ''}`} />
                    
                    {/* Label - shown when expanded or on mobile */}
                    {(isExpanded || isMobileOpen) && (
                      <span className="ml-3 whitespace-nowrap font-medium">{item.label}</span>
                    )}

                    {/* Tooltip - shown when collapsed on desktop */}
                    {!isExpanded && !isMobileOpen && (
                      <div className="
                        absolute left-full ml-2 px-3 py-2 bg-gray-800 text-white text-sm
                        rounded-md whitespace-nowrap opacity-0 pointer-events-none
                        group-hover:opacity-100 transition-all duration-200 transform
                        group-hover:translate-x-1 shadow-xl hidden lg:block
                        border border-gray-700
                      ">
                        {item.label}
                      </div>
                    )}

                    {/* Active indicator for collapsed state */}
                    {active && !isExpanded && !isMobileOpen && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-r-full shadow-lg" />
                    )}

                    {/* Badge if any */}
                    {item.badge && (
                      <span className={`
                        ${(isExpanded || isMobileOpen) ? 'ml-auto' : 'absolute -top-1 -right-1'}
                        bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full h-5 w-5
                        flex items-center justify-center font-bold shadow-lg animate-pulse
                      `}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Avatar Section */}
        <div className="p-2 border-t border-gray-800 mt-auto order-last">
          <div className={`
            flex items-center px-3 py-2.5 rounded-lg
            transition-all duration-200 relative group
            text-gray-300 hover:bg-gray-800 hover:text-white
          `}>
            <UserAvatar 
              name={adminUser?.name || 'User'} 
              size="sm" 
              className="flex-shrink-0"
            />
            
            {/* User name - shown when expanded or on mobile */}
            {(isExpanded || isMobileOpen) && (
              <span className="ml-3 whitespace-nowrap font-medium">{adminUser?.name}</span>
            )}

            {/* Tooltip - shown when collapsed on desktop */}
            {!isExpanded && !isMobileOpen && (
              <div className="
                absolute left-full ml-2 px-3 py-2 bg-gray-800 text-white text-sm
                rounded-md whitespace-nowrap opacity-0 pointer-events-none
                group-hover:opacity-100 transition-all duration-200 transform
                group-hover:translate-x-1 shadow-xl hidden lg:block
                border border-gray-700
              ">
                {adminUser?.name}
              </div>
            )}
          </div>
        </div>

        {/* Pin/Unpin Button - show on desktop when expanded or on hover when collapsed */}
        {!isMobileOpen && (
          <div className={`
            hidden lg:block p-2 border-t border-gray-800
            ${!isExpanded ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-300' : ''}
          `}>
            <button
              onClick={togglePin}
              className={`
                w-full flex items-center px-3 py-2.5 rounded-lg
                transition-all duration-200 relative
                ${isPinned 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-[1.02]' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white hover:translate-x-1'
                }
              `}
              title={isPinned ? 'Unpin Sidebar' : 'Keep Sidebar Open'}
            >
              {isPinned ? (
                <PinOff className="h-5 w-5 flex-shrink-0" />
              ) : (
                <Pin className="h-5 w-5 flex-shrink-0" />
              )}
              
              {/* Label - shown when expanded */}
              {isExpanded && (
                <span className="ml-3 whitespace-nowrap font-medium">
                  {isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
                </span>
              )}

              {/* Tooltip - shown when collapsed on desktop */}
              {!isExpanded && (
                <div className="
                  absolute left-full ml-2 px-3 py-2 bg-gray-800 text-white text-sm
                  rounded-md whitespace-nowrap opacity-0 pointer-events-none
                  group-hover:opacity-100 transition-all duration-200 transform
                  group-hover:translate-x-1 shadow-xl
                  border border-gray-700
                ">
                  {isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
                </div>
              )}
            </button>
          </div>
        )}


      </div>
    </>
  );
}; 