import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Warehouse, 
  ShoppingCart, 
  X,
  BarChart3,
  DollarSign,
  Truck,
  ArrowLeftRight,
  TrendingUp,
  PackageCheck
} from 'lucide-react';
import { Logo } from '../ui/Logo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Warehouses', href: '/warehouses', icon: Warehouse },
  { name: 'Inventory', href: '/inventory', icon: BarChart3 },
  { name: 'Trucks', href: '/trucks', icon: Truck },
  { name: 'Fleet Capacity', href: '/trucks/capacity', icon: TrendingUp },
  { name: 'Pricing', href: '/pricing', icon: DollarSign },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Transfers', href: '/transfers', icon: ArrowLeftRight },
  { name: 'Deliveries & Pickups', href: '/deliveries', icon: PackageCheck }
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onMouseEnter, onMouseLeave }) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:fixed lg:z-50
        `}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between p-4 lg:hidden border-b border-gray-700">
          <Logo size="md" />
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5 text-gray-300" />
          </button>
        </div>

        {/* Logo area for desktop */}
        <div className="hidden lg:flex items-center justify-center h-16 bg-gray-800 border-b border-gray-700 px-4 py-2">
          <Logo size="lg" className="drop-shadow-sm" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};