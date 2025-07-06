# Truck Transfer and Capacity Calculation Fix

## Problem Description
Transfers to trucks weren't updating the truck inventory properly. The truck capacity display still showed 0/60 capacity after transfers were completed.

## Root Cause Analysis
The issue was in the truck capacity calculation logic. The system had two separate tracking mechanisms:
1. **Allocations**: Orders planned/assigned to trucks (stored in `truck_allocations` table)
2. **Inventory**: Actual items transferred to trucks (stored in `truck_inventory` table)

The capacity calculation was only considering allocations and completely ignoring actual inventory transferred to trucks.

## Files Modified

### 1. Backend Capacity Calculation Logic
**File**: `/backend/src/lib/truck-capacity.ts`
**Function**: `calculateTruckCapacity`
**Changes**:
- Added calculation of actual inventory weight from `truck_inventory` table
- Now uses the MAXIMUM of allocation weight or inventory weight for capacity calculation
- Added weight calculation logic for full/empty cylinders (27kg/14kg defaults)
- Supports product-specific weight calculations when available

### 2. Truck Routes API - Calculate Capacity Endpoint
**File**: `/backend/src/routes/trucks.ts`
**Function**: `calculateCapacity`
**Changes**:
- Added fetching of truck inventory data with product weight information
- Includes weight calculations for each inventory item
- Passes complete truck data including inventory to capacity calculation function

### 3. Truck Routes API - Generate Schedule Endpoint
**File**: `/backend/src/routes/trucks.ts`
**Function**: `generateSchedule`
**Changes**:
- Added bulk fetching of all truck inventories for schedule generation
- Enhanced each truck with proper inventory data for accurate capacity calculations
- Ensures fleet-wide capacity utilization includes actual inventory

## Key Technical Changes

### 1. Capacity Calculation Enhancement
```typescript
// OLD: Only considered allocations
const allocated_weight_kg = dateAllocations.reduce(
  (sum, allocation) => sum + allocation.estimated_weight_kg, 
  0
);

// NEW: Considers both allocations AND actual inventory
const allocation_weight_kg = dateAllocations.reduce(/*...*/);
const inventory_weight_kg = (truck.inventory || []).reduce((sum, item) => {
  let item_weight = item.weight_kg || ((item.qty_full * 27) + (item.qty_empty * 14));
  return sum + item_weight;
}, 0);
const allocated_weight_kg = Math.max(allocation_weight_kg, inventory_weight_kg);
```

### 2. Weight Calculation Logic
- **Full cylinders**: 27kg each (13kg gas + 14kg tare weight)
- **Empty cylinders**: 14kg each (tare weight only)
- **Product-specific weights**: Uses actual `capacity_kg` and `tare_weight_kg` when available
- **Fallback**: Default weights when product details are missing

### 3. Database Functions
The existing database functions were already working correctly:
- `transfer_stock_to_truck`: Properly updates `truck_inventory` table
- `transfer_stock`: Handles warehouse-to-warehouse transfers
- `validate_transfer_request`: Validates transfer prerequisites

## Impact of Changes

### Before Fix
- Truck capacity always showed as 0/60 (or 0/[capacity]) regardless of transfers
- Only planned allocations were considered for capacity
- Actual transferred inventory was ignored in capacity calculations

### After Fix
- Truck capacity reflects actual inventory transferred to trucks
- Capacity calculation includes both planned orders AND actual inventory
- More accurate truck utilization and fleet management
- Proper weight-based capacity management

## Testing

### Test Scripts Created
1. `test_truck_transfer_issue.sql` - Diagnoses the original issue
2. `test_truck_capacity_fix.sql` - Comprehensive verification of the fix

### Test Coverage
- Transfer function execution and validation
- Truck inventory updates after transfers
- Capacity calculation accuracy
- Weight calculation verification
- Stock movement audit trail

## Database Schema Validation

### Tables Involved
- `truck`: Truck master data with capacity information
- `truck_inventory`: Actual inventory on trucks (qty_full, qty_empty)
- `truck_allocations`: Planned order assignments to trucks
- `transfers`: Transfer records with status tracking
- `transfer_lines`: Transfer line items
- `inventory_balance`: Warehouse inventory
- `stock_movements`: Audit trail for all inventory changes

### Key Relationships
- `truck_inventory.truck_id` → `truck.id`
- `truck_inventory.product_id` → `products.id`
- `truck_allocations.truck_id` → `truck.id`
- Transfer completion triggers inventory updates

## API Endpoints Affected

### 1. Truck Capacity Calculation
- `GET /api/trucks/{id}/capacity?date={date}`
- Now includes actual inventory in capacity calculation

### 2. Daily Truck Schedule
- `GET /api/trucks/schedule?date={date}`
- Fleet utilization calculations now accurate

### 3. Truck Details
- `GET /api/trucks/{id}`
- Inventory display already worked correctly

## Frontend Impact

### Components That Benefit
- `TruckCapacityCard`: Now shows accurate capacity utilization
- `TruckInventory`: Already displayed correctly, but capacity bar is now accurate
- Truck capacity dashboard: Fleet utilization metrics are now correct

### No Frontend Changes Required
The frontend was already correctly calling the backend APIs. The fix was entirely on the backend capacity calculation logic.

## Deployment Notes

### 1. Database Functions
- All required database functions already exist (from migration `20250706000000_create_transfer_functions.sql`)
- No new migrations required

### 2. Backward Compatibility
- Changes are fully backward compatible
- Existing transfer processes continue to work
- Enhanced capacity calculations don't break existing functionality

### 3. Performance Impact
- Minimal performance impact
- Additional queries to fetch truck inventory are efficient (indexed tables)
- Bulk fetching in schedule generation reduces query overhead

## Expected Results

After deployment:
1. **Accurate Capacity Display**: Trucks will show correct capacity based on actual inventory
2. **Better Fleet Management**: More accurate utilization metrics for fleet optimization
3. **Consistent Data**: Capacity calculations match actual transferred inventory
4. **Improved Planning**: Better visibility into actual vs. planned truck loads

## Monitoring and Validation

### Key Metrics to Monitor
1. Truck capacity utilization percentages
2. Inventory transfer completion rates
3. Accuracy of weight calculations
4. Fleet utilization trends

### Validation Steps
1. Perform test transfers to trucks
2. Verify capacity display updates correctly
3. Check fleet utilization calculations
4. Validate weight calculation accuracy

## Future Enhancements

### Potential Improvements
1. **Real-time Updates**: WebSocket notifications for capacity changes
2. **Advanced Weight Tracking**: Per-product weight tracking for more precision
3. **Capacity Alerts**: Notifications when trucks approach capacity limits
4. **Historical Analytics**: Trend analysis of truck utilization over time

### Technical Debt
- Consider consolidating allocation and inventory tracking for simpler logic
- Add more sophisticated weight calculation for different product types
- Implement capacity warning thresholds and alerts