import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TruckForm } from '../components/trucks/TruckForm';

const CreateTruckPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Add New Truck</h1>
      <TruckForm onSuccess={() => navigate('/trucks')} />
    </div>
  );
};

export default CreateTruckPage; 