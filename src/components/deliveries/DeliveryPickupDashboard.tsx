import React, { useState } from 'react';
import { Package, Truck, Calendar, Users, ArrowUpCircle, ArrowDownCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card } from '../ui/Card';
import { Tabs } from '../ui/Tabs';
import { DeliveryList } from './DeliveryList';
import { PickupList } from './PickupList';
import { CustomerBalanceCard } from './CustomerBalanceCard';
import { useAuth } from '../../contexts/AuthContext';

export const DeliveryPickupDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('deliveries');

  const tabs = [
    {
      id: 'deliveries',
      label: 'Deliveries',
      icon: ArrowDownCircle,
    },
    {
      id: 'pickups',
      label: 'Pickups',
      icon: ArrowUpCircle,
    },
    {
      id: 'balances',
      label: 'Customer Balances',
      icon: Users,
    },
  ];

  // Mock statistics for now - will be replaced with real data
  const stats = {
    deliveries: {
      today: 12,
      pending: 8,
      completed: 45,
      failed: 2,
    },
    pickups: {
      today: 5,
      pending: 3,
      completed: 22,
      failed: 1,
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Deliveries & Pickups</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Deliveries</p>
              <p className="text-2xl font-bold text-gray-900">{stats.deliveries.today}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <ArrowDownCircle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-green-600">
              <CheckCircle className="inline h-4 w-4 mr-1" />
              {stats.deliveries.completed} completed
            </span>
            <span className="text-yellow-600">
              <Clock className="inline h-4 w-4 mr-1" />
              {stats.deliveries.pending} pending
            </span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Pickups</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pickups.today}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <ArrowUpCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-green-600">
              <CheckCircle className="inline h-4 w-4 mr-1" />
              {stats.pickups.completed} completed
            </span>
            <span className="text-yellow-600">
              <Clock className="inline h-4 w-4 mr-1" />
              {stats.pickups.pending} pending
            </span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed Deliveries</p>
              <p className="text-2xl font-bold text-gray-900">{stats.deliveries.failed}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Requires attention
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Trucks</p>
              <p className="text-2xl font-bold text-gray-900">8</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Truck className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            On delivery routes
          </p>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card>
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        
        <div className="p-6">
          {activeTab === 'deliveries' && <DeliveryList />}
          {activeTab === 'pickups' && <PickupList />}
          {activeTab === 'balances' && <CustomerBalanceCard />}
        </div>
      </Card>
    </div>
  );
}; 