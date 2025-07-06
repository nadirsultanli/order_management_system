# Truck Inventory Transfer Issue Analysis

## Problem Description
Transfers to trucks aren't updating the truck inventory properly. The truck still shows 0/60 capacity after transfers.

## Root Cause Analysis

### 1. Backend Transfer Logic Issues

**File: `/backend/src/routes/transfers.ts`**
- Lines 652-666: The system correctly identifies truck destinations and calls `transfer_stock_to_truck`
- Lines 658-665: The transfer function is called correctly for truck destinations
- **Issue**: The database function `transfer_stock_to_truck` works correctly and updates `truck_inventory` table

### 2. Capacity Calculation Issues

**File: `/backend/src/lib/truck-capacity.ts`**
- Lines 164-193: `calculateTruckCapacity` function only considers `allocations` table
- **CRITICAL BUG**: This function does NOT consider actual inventory in `truck_inventory` table
- The function calculates capacity based on order allocations, not actual transferred inventory

**File: `/backend/src/routes/trucks.ts`**
- Lines 210-253: The `get` endpoint properly fetches truck inventory from `truck_inventory` table
- Lines 732-740: The `calculateCapacity` endpoint only uses allocations, ignoring actual inventory

### 3. Frontend Display Issues

**File: `/src/components/trucks/TruckCapacityCard.tsx`**
- Lines 86-111: Displays capacity based on `capacity_info` from backend
- **Issue**: The backend capacity calculation is flawed, so frontend shows incorrect data

### 4. Database Function Analysis

**File: `/supabase/migrations/20250706000000_create_transfer_functions.sql`**
- Lines 158-298: `transfer_stock_to_truck` function correctly updates `truck_inventory` table
- Lines 253-259: Properly increments truck inventory quantities
- **Status**: Database functions work correctly

## Key Issues Identified

### Issue 1: Capacity Calculation Ignores Actual Inventory
The `calculateTruckCapacity` function in `/backend/src/lib/truck-capacity.ts` only considers:
- Order allocations from `truck_allocations` table
- Does NOT consider actual inventory in `truck_inventory` table

### Issue 2: Two Different Data Sources
- **Allocations**: Planned orders assigned to trucks (from `truck_allocations`)
- **Inventory**: Actual items transferred to trucks (from `truck_inventory`)
- The capacity calculation only uses allocations, not actual inventory

### Issue 3: Weight Calculation Mismatch
- Allocations use `estimated_weight_kg` field
- Inventory uses cylinder counts (`qty_full`, `qty_empty`) but needs weight conversion

## Proposed Solution

### 1. Fix `calculateTruckCapacity` Function
Update the function to include actual truck inventory:

```typescript
export function calculateTruckCapacity(
  truck: TruckWithInventory,
  allocations: TruckAllocation[],
  date: string
): TruckCapacityInfo {
  // Current allocation-based weight
  const allocation_weight = allocations
    .filter(a => a.allocation_date === date && a.status !== 'cancelled')
    .reduce((sum, allocation) => sum + allocation.estimated_weight_kg, 0);

  // NEW: Calculate actual inventory weight
  const inventory_weight = (truck.inventory || [])
    .reduce((sum, item) => {
      // Use product details to calculate weight
      const item_weight = (item.qty_full + item.qty_empty) * (item.weight_kg || 27); // 27kg default per cylinder
      return sum + item_weight;
    }, 0);

  // Use the MAXIMUM of allocations or actual inventory
  const allocated_weight_kg = Math.max(allocation_weight, inventory_weight);
  
  // Rest of the function remains the same...
}
```

### 2. Update Truck Routes API
Ensure the truck inventory includes weight calculations:

**File: `/backend/src/routes/trucks.ts`**
Lines 234-253 should calculate weight properly for each inventory item.

### 3. Add Weight Information to Inventory Items
Update the truck inventory query to include product weight information for proper calculations.

## Testing Steps

1. **Verify Current State**: Run test script to see current truck inventory vs. capacity calculations
2. **Test Transfer Function**: Verify `transfer_stock_to_truck` updates `truck_inventory` correctly
3. **Test Capacity Calculation**: Verify `calculateTruckCapacity` includes actual inventory
4. **Frontend Verification**: Confirm capacity display reflects actual inventory

## Implementation Priority

1. **High Priority**: Fix `calculateTruckCapacity` to include actual inventory
2. **Medium Priority**: Ensure weight calculations are accurate
3. **Low Priority**: Add better error handling and validation

## Files to Modify

1. `/backend/src/lib/truck-capacity.ts` - Fix capacity calculation
2. `/backend/src/routes/trucks.ts` - Ensure inventory includes weight data
3. Potentially frontend capacity display logic if needed

## Expected Outcome

After the fix:
- Transfers to trucks will properly update truck capacity display
- Truck capacity will show actual inventory transferred, not just planned allocations
- The 0/60 capacity issue will be resolved