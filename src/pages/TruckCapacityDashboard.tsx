import React, { useState } from 'react';
import { Calendar, Truck, AlertTriangle, TrendingUp, Package, Plus } from 'lucide-react';
import { TruckCapacityCard } from '../components/trucks/TruckCapacityCard';
import { TruckAllocationSelector } from '../components/trucks/TruckAllocationSelector';
import { formatDateSync } from '../utils/order';

interface FleetUtilization {
  total_capacity_kg: number;
  total_allocated_kg: number;
  overall_utilization: number;
  active_trucks: number;
  overallocated_trucks: number;
  maintenance_due_trucks: number;
}

export const TruckCapacityDashboard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  
  // Mock data - in real implementation, these would come from hooks
  const fleetUtilization: FleetUtilization = {
    total_capacity_kg: 5400,
    total_allocated_kg: 3780,
    overall_utilization: 70,
    active_trucks: 8,
    overallocated_trucks: 1,
    maintenance_due_trucks: 2
  };

  const schedules: any[] = []; // Would come from useTruckCapacity hook

  const formatWeight = (kg: number) => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)}t`;
    }
    return `${kg}kg`;
  };


  const getUtilizationColor = (percentage: number) => {
    if (percentage > 90) return 'text-red-600 bg-red-100';
    if (percentage > 75) return 'text-orange-600 bg-orange-100';
    if (percentage > 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Fleet Capacity Dashboard</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Monitor truck capacity and optimize delivery allocations
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                
                <button
                  onClick={() => setShowAllocationModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Allocate Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Overview Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Overall Utilization */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className={`h-8 w-8 ${getUtilizationColor(fleetUtilization.overall_utilization)}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Fleet Utilization</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fleetUtilization.overall_utilization.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">
                  {formatWeight(fleetUtilization.total_allocated_kg)} / {formatWeight(fleetUtilization.total_capacity_kg)}
                </p>
              </div>
            </div>
          </div>

          {/* Active Trucks */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Truck className="h-8 w-8 text-blue-600 bg-blue-100 p-1 rounded" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Trucks</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fleetUtilization.active_trucks}
                </p>
                <p className="text-xs text-gray-500">Available for delivery</p>
              </div>
            </div>
          </div>

          {/* Overallocated Trucks */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-red-600 bg-red-100 p-1 rounded" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overallocated</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fleetUtilization.overallocated_trucks}
                </p>
                <p className="text-xs text-gray-500">Need attention</p>
              </div>
            </div>
          </div>

          {/* Maintenance Due */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-8 w-8 text-yellow-600 bg-yellow-100 p-1 rounded" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Maintenance Due</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fleetUtilization.maintenance_due_trucks}
                </p>
                <p className="text-xs text-gray-500">Schedule soon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Fleet Capacity Bar */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Fleet Capacity for {formatDateSync(selectedDate)}
            </h3>
            <div className="text-sm text-gray-600">
              {formatWeight(fleetUtilization.total_allocated_kg)} allocated of {formatWeight(fleetUtilization.total_capacity_kg)} total capacity
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${
                fleetUtilization.overall_utilization > 90 ? 'bg-red-500' :
                fleetUtilization.overall_utilization > 75 ? 'bg-orange-500' :
                fleetUtilization.overall_utilization > 50 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(fleetUtilization.overall_utilization, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>0%</span>
            <span className="font-medium">
              {fleetUtilization.overall_utilization.toFixed(1)}% Utilized
            </span>
            <span>100%</span>
          </div>
        </div>

        {/* Individual Truck Cards */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Truck Capacity Details
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span>Good utilization</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span>High utilization</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span>Overallocated</span>
              </div>
            </div>
          </div>

          {schedules.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {schedules.map((schedule) => (
                <TruckCapacityCard
                  key={schedule.truck_id}
                  schedule={schedule}
                  onClick={() => {
                    // Navigate to truck detail or open allocation modal
                    console.log('Truck clicked:', schedule.truck_id);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No truck schedules for {formatDateSync(selectedDate)}</p>
              <p className="text-sm text-gray-500">
                Try selecting a different date or ensure trucks are properly configured
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 border border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 text-left transition-colors">
              <div className="flex items-center space-x-3">
                <Plus className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Allocate Orders</p>
                  <p className="text-sm text-gray-600">Assign pending orders to trucks</p>
                </div>
              </div>
            </button>
            
            <button className="p-4 border border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 text-left transition-colors">
              <div className="flex items-center space-x-3">
                <TrendingUp className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Optimize Routes</p>
                  <p className="text-sm text-gray-600">Auto-optimize truck allocations</p>
                </div>
              </div>
            </button>
            
            <button className="p-4 border border-gray-300 rounded-lg hover:border-yellow-400 hover:bg-yellow-50 text-left transition-colors">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
                <div>
                  <p className="font-medium text-gray-900">Maintenance</p>
                  <p className="text-sm text-gray-600">Schedule truck maintenance</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Allocation Modal */}
      {showAllocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <TruckAllocationSelector
            order={{ id: 'sample-order', scheduled_date: selectedDate } as any}
            orderWeight={150}
            recommendations={[]}
            onTruckSelect={(truckId) => console.log('Selected:', truckId)}
            onCancel={() => setShowAllocationModal(false)}
            onConfirm={() => {
              setShowAllocationModal(false);
              // Handle allocation
            }}
          />
        </div>
      )}
    </div>
  );
}; 