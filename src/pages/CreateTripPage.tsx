import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';

export const CreateTripPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/trips"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trips
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Create New Trip</h1>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Plus className="h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            Create Trip
          </h2>
          <p className="text-gray-500 max-w-md">
            The trip creation feature is coming soon. You'll be able to create
            new trips with assigned trucks, routes, and schedules.
          </p>
        </div>
      </Card>
    </div>
  );
};