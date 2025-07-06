import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Truck, Package, Edit, ArrowLeft } from 'lucide-react';
import { TruckForm } from '../components/trucks/TruckForm';
import { TruckInventoryTransfer } from '../components/trucks/TruckInventoryTransfer';
import { useTruck } from '../hooks/useTrucks';

export const TruckDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const { data: truck, isLoading: loading, error, refetch } = useTruck(id || '');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !truck) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {error?.message || 'Truck not found'}
              </h3>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => setIsEditing(false)}
          className="mb-6 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Details
        </button>
        <TruckForm
          initialData={truck}
          onSuccess={() => {
            setIsEditing(false);
            refetch(); // Use refetch instead of undefined loadTruckDetails
          }}
        />
      </div>
    );
  }

  const totalCylinders = truck.inventory.reduce(
    (sum, item) => sum + (item.qty_full || 0) + (item.qty_empty || 0),
    0
  );
  const totalWeight = truck.inventory.reduce(
    (sum, item) => sum + (item.weight_kg || 0),
    0
  );
  const capacityPercentage = (totalCylinders / truck.capacity_cylinders) * 100;
  const isOverloaded = capacityPercentage > 100;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/trucks')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Trucks
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Truck className="h-6 w-6 text-gray-400" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                {truck.fleet_number}
              </h1>
              <span className={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                truck.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {truck.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </button>
          </div>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold mb-4">Truck Information</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">License Plate</h3>
                <p className="mt-1">{truck.license_plate}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Driver</h3>
                <p className="mt-1">{truck.driver_name || 'Not assigned'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Capacity</h3>
                <p className="mt-1">{truck.capacity_cylinders} cylinders</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Current Load</h2>
            <div className="space-y-4">
              <div>
                <p className="text-lg font-medium">
                  {totalCylinders} / {truck.capacity_cylinders} cylinders
                </p>
                <p className="text-sm text-gray-600">
                  Total weight: {totalWeight.toFixed(1)} kg
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${isOverloaded ? 'bg-red-600' : 'bg-blue-600'}`}
                  style={{
                    width: `${Math.min((totalCylinders / (truck.capacity_cylinders || 1)) * 100, 100)}%`
                  }}
                ></div>
              </div>
              {isOverloaded && (
                <p className="text-sm text-red-600 font-medium">
                  ⚠️ Truck is overloaded ({capacityPercentage.toFixed(1)}% capacity)
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Inventory Breakdown</h4>
              {truck.inventory.length === 0 ? (
                <p className="text-sm text-gray-500">No inventory items</p>
              ) : (
                <div className="space-y-3">
                  {truck.inventory.map((item) => (
                    <div key={item.product_id} className="flex items-start">
                      <Package className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-gray-500">SKU: {item.product_sku}</p>
                        <div className="mt-1 flex space-x-4">
                          <span className="text-xs text-gray-500">
                            Full: {item.qty_full || 0}
                          </span>
                          <span className="text-xs text-gray-500">
                            Empty: {item.qty_empty || 0}
                          </span>
                          {item.weight_kg && (
                            <span className="text-xs text-gray-500">
                              Weight: {item.weight_kg.toFixed(1)}kg
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Transfer Component */}
      <div className="mt-8">
        <TruckInventoryTransfer 
          truckId={truck.id} 
          truckName={truck.fleet_number}
          onSuccess={() => refetch()}
        />
      </div>
    </div>
  );
}; 