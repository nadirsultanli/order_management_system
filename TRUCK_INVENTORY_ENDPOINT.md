# Truck Inventory Endpoint Documentation

## Overview

A new API endpoint has been created to retrieve the current inventory of products stored in a specific truck. This endpoint provides detailed information about product quantities (full and empty cylinders), weight calculations, and capacity utilization.

## Endpoint Details

### `GET /api/v1/trpc/trucks.getInventory`

**Purpose**: Get current inventory of products in a specific truck

**Type**: tRPC Query (GET request)

**Authentication**: Required (Bearer Token)

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `truck_id` | string (UUID) | Yes | - | ID of the truck to get inventory for |
| `include_product_details` | boolean | No | `true` | Whether to include detailed product information |

## Response Structure

```typescript
{
  result: {
    data: {
      truck: {
        id: string;           // Truck UUID
        fleet_number: string; // Truck fleet number
        license_plate: string; // Truck license plate
        active: boolean;      // Whether truck is active
        capacity_cylinders: number; // Maximum cylinder capacity
        capacity_kg: number;  // Maximum weight capacity (calculated)
      };
      inventory: Array<{
        id: string;           // Inventory record UUID
        product_id: string;   // Product UUID
        qty_full: number;     // Number of full cylinders
        qty_empty: number;    // Number of empty cylinders
        total_cylinders: number; // Total cylinders (full + empty)
        weight_kg: number;    // Total weight for this product
        updated_at: string;   // Last update timestamp
        product?: {           // Only included if include_product_details=true
          id: string;
          name: string;
          sku: string;
          variant_name?: string;
          capacity_kg: number;
          tare_weight_kg: number;
          unit_of_measure: string;
          status: string;
        };
      }>;
      summary: {
        total_products: number;        // Number of different products
        total_full_cylinders: number;  // Total full cylinders
        total_empty_cylinders: number; // Total empty cylinders
        total_cylinders: number;       // Total cylinders (full + empty)
        total_weight_kg: number;       // Total weight of all products
        capacity_utilization_percent: number; // Percentage of capacity used
        is_overloaded: boolean;        // Whether truck exceeds capacity
        last_updated: string | null;   // Most recent inventory update
      };
      timestamp: string; // Response generation timestamp
    };
  };
}
```

## Usage Examples

### Basic Usage with Full Product Details

```bash
curl -X GET "http://localhost:3001/api/v1/trpc/trucks.getInventory?truck_id=7fedc884-9757-4bf1-9aee-9e9fad8ce1f9&include_product_details=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Minimal Response (Product IDs Only)

```bash
curl -X GET "http://localhost:3001/api/v1/trpc/trucks.getInventory?truck_id=7fedc884-9757-4bf1-9aee-9e9fad8ce1f9&include_product_details=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### JavaScript/TypeScript Usage

```typescript
// Using tRPC client
const truckInventory = await client.trucks.getInventory.query({
  truck_id: "7fedc884-9757-4bf1-9aee-9e9fad8ce1f9",
  include_product_details: true
});

console.log(`Truck ${truckInventory.truck.fleet_number} has ${truckInventory.summary.total_cylinders} cylinders`);
console.log(`Capacity utilization: ${truckInventory.summary.capacity_utilization_percent}%`);

// Iterate through inventory items
truckInventory.inventory.forEach(item => {
  console.log(`Product: ${item.product?.name} - Full: ${item.qty_full}, Empty: ${item.qty_empty}`);
});
```

## Error Responses

### 404 - Truck Not Found
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Truck not found"
  }
}
```

### 500 - Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR", 
    "message": "Failed to fetch truck inventory: [specific error details]"
  }
}
```

### 401 - Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Not authenticated"
  }
}
```

## Database Schema

The endpoint queries the following tables:

### Primary Tables
- `truck` - Truck information
- `truck_inventory` - Product quantities in trucks  
- `products` - Product details (when include_product_details=true)

### Truck Inventory Table Structure
```sql
CREATE TABLE truck_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID NOT NULL REFERENCES truck(id),
  product_id UUID NOT NULL REFERENCES products(id),
  qty_full INTEGER NOT NULL DEFAULT 0,
  qty_empty INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Business Logic

### Weight Calculations
- **Full Cylinders**: `qty_full × (product.capacity_kg + product.tare_weight_kg)`
- **Empty Cylinders**: `qty_empty × product.tare_weight_kg`
- **Total Weight**: Sum of full and empty cylinder weights

### Capacity Utilization
- **Formula**: `(total_cylinders / truck.capacity_cylinders) × 100`
- **Overload Detection**: `total_cylinders > truck.capacity_cylinders`

## Features

1. **Real-time Inventory**: Shows current inventory state
2. **Weight Calculations**: Automatic weight calculations based on product specifications
3. **Capacity Monitoring**: Tracks capacity utilization and overload conditions
4. **Flexible Response**: Optional product details for performance optimization
5. **Comprehensive Summary**: Aggregated statistics for quick overview
6. **Audit Trail**: Tracks when inventory was last updated

## Related Endpoints

- `trucks.loadInventory` - Load products into truck from warehouse
- `trucks.unloadInventory` - Unload products from truck to warehouse
- `trucks.list` - Get all trucks with basic inventory summary
- `trucks.get` - Get single truck with inventory details

## Performance Considerations

- Set `include_product_details=false` for faster responses when product details aren't needed
- Response includes weight calculations which may be computationally expensive for large inventories
- Results are ordered by `updated_at` descending (most recently updated first)

## Integration Notes

This endpoint complements the existing truck management system by providing:
- Real-time visibility into truck loading status
- Weight-based capacity management
- Product-level inventory tracking
- Foundation for route optimization algorithms

The endpoint is designed to be used by:
- Fleet managers monitoring truck utilization
- Dispatch systems for route planning
- Mobile apps for drivers checking their load
- Analytics systems for operational insights 