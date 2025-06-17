import React from 'react';
import { Link } from 'react-router-dom';
import { Truck, Package, AlertCircle } from 'lucide-react';
import { TruckInventoryItem } from '../../lib/transfers';

interface TruckDetails {
  id: string;
  fleet_number: string;
  license_plate: string;
  capacity_cylinders: number;
  driver_name: string | null;
  active: boolean;
  inventory?: TruckInventoryItem[];
}

interface TruckTableProps {
  trucks: TruckDetails[];
  loading?: boolean;
}

export const TruckTable: React.FC<TruckTableProps> = ({ trucks, loading }) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!trucks.length) {
    return (
      <div className="text-center py-8">
        <Truck className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No trucks</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new truck.</p>
        <div className="mt-6">
          <Link
            to="/trucks/new"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Add Truck
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Truck Details
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Driver
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Capacity
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Current Load
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {trucks.map((truck) => {
            const totalCylinders = (truck.inventory || []).reduce(
              (sum, item) => sum + (item.qty_full || 0) + (item.qty_empty || 0),
              0
            );
            const capacityPercentage = (totalCylinders / truck.capacity_cylinders) * 100;
            const isOverloaded = capacityPercentage > 100;

            return (
              <tr key={truck.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Truck className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {truck.fleet_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {truck.license_plate}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{truck.driver_name || 'Unassigned'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-sm text-gray-900">{truck.capacity_cylinders}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-center">
                    <div className="w-48">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500">
                          {totalCylinders} / {truck.capacity_cylinders}
                        </span>
                        {isOverloaded && (
                          <AlertCircle className="h-4 w-4 text-red-500" title="Overloaded" />
                        )}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            isOverloaded ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    truck.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {truck.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    to={`/trucks/${truck.id}`}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    View Details
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}; 