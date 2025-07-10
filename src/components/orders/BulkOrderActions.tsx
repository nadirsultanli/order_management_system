import React, { useState } from 'react';
import { ChevronDown, Download, Calendar, CheckCircle, X } from 'lucide-react';
import { Order, BulkOrderOperation } from '../../types/order';

interface BulkOrderActionsProps {
  selectedOrders: Order[];
  onClearSelection: () => void;
  onBulkOperation: (operation: BulkOrderOperation) => void;
}

export const BulkOrderActions: React.FC<BulkOrderActionsProps> = ({
  selectedOrders,
  onClearSelection,
  onBulkOperation,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');

  if (selectedOrders.length === 0) return null;

  const canChangeStatus = (status: string) => {
    return selectedOrders.every(order => {
      switch (status) {
        case 'confirmed':
          return order.status === 'draft';
        case 'scheduled':
          return order.status === 'confirmed';
        case 'cancelled':
          return ['draft', 'confirmed', 'scheduled'].includes(order.status);
        default:
          return false;
      }
    });
  };

  const handleBulkSchedule = () => {
    if (!scheduledDate) return;
    
    onBulkOperation({
      order_ids: selectedOrders.map(o => o.id),
      operation: 'schedule',
      scheduled_date: scheduledDate,
      notes,
    });
    
    setShowScheduleModal(false);
    setScheduledDate('');
    setNotes('');
  };

  const handleBulkStatusChange = () => {
    if (!newStatus) return;
    
    onBulkOperation({
      order_ids: selectedOrders.map(o => o.id),
      operation: 'status_change',
      new_status: newStatus,
      notes,
    });
    
    setShowStatusModal(false);
    setNewStatus('');
    setNotes('');
  };

  const handleExport = () => {
    onBulkOperation({
      order_ids: selectedOrders.map(o => o.id),
      operation: 'export',
    });
    setShowDropdown(false);
  };


  const totalValue = selectedOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-blue-900">
              {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
            </span>
            <span className="text-sm text-blue-700">
              Total value: ${totalValue.toLocaleString()}
            </span>
            <button
              onClick={onClearSelection}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <X className="h-3 w-3" />
              <span>Clear selection</span>
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              <span>Bulk Actions</span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    Status Changes
                  </div>
                  
                  {canChangeStatus('confirmed') && (
                    <button
                      onClick={() => {
                        setNewStatus('confirmed');
                        setShowStatusModal(true);
                        setShowDropdown(false);
                      }}
                      className="flex items-center space-x-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <span>Confirm Orders</span>
                    </button>
                  )}

                  {canChangeStatus('scheduled') && (
                    <button
                      onClick={() => {
                        setShowScheduleModal(true);
                        setShowDropdown(false);
                      }}
                      className="flex items-center space-x-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <span>Schedule Deliveries</span>
                    </button>
                  )}

                  {canChangeStatus('cancelled') && (
                    <button
                      onClick={() => {
                        setNewStatus('cancelled');
                        setShowStatusModal(true);
                        setShowDropdown(false);
                      }}
                      className="flex items-center space-x-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <X className="h-4 w-4 text-red-600" />
                      <span>Cancel Orders</span>
                    </button>
                  )}

                  <div className="border-t border-gray-100 mt-1">
                    <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Export
                    </div>
                    
                    <button
                      onClick={handleExport}
                      className="flex items-center space-x-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4 text-green-600" />
                      <span>Export to CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowScheduleModal(false)} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900">
                    Schedule {selectedOrders.length} Orders
                  </h3>
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scheduled Delivery Date *
                    </label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Add notes for this bulk scheduling..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  onClick={handleBulkSchedule}
                  disabled={!scheduledDate}
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Schedule Orders
                </button>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowStatusModal(false)} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900">
                    {newStatus === 'confirmed' && 'Confirm Orders'}
                    {newStatus === 'cancelled' && 'Cancel Orders'}
                  </h3>
                  <button
                    onClick={() => setShowStatusModal(false)}
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700">
                      This will change the status of {selectedOrders.length} selected orders to{' '}
                      <span className="font-medium">{newStatus}</span>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {newStatus === 'cancelled' ? 'Cancellation Reason *' : 'Notes (Optional)'}
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={newStatus === 'cancelled' ? 'Please provide a reason for cancellation...' : 'Add notes for this status change...'}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  onClick={handleBulkStatusChange}
                  disabled={newStatus === 'cancelled' && !notes.trim()}
                  className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed ${
                    newStatus === 'cancelled' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {newStatus === 'confirmed' && 'Confirm Orders'}
                  {newStatus === 'cancelled' && 'Cancel Orders'}
                </button>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};