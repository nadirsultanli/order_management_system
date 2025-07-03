# Order Management System API Documentation

## 🚀 Quick Start

**Base URL**: `https://ordermanagementsystem-production-3ed7.up.railway.app`
**API Version**: v1
**Protocol**: tRPC over HTTP

## 📖 Interactive Documentation

Visit **[/api/docs](https://ordermanagementsystem-production-3ed7.up.railway.app/api/docs)** for an interactive API explorer where you can:
- Browse all available endpoints
- Test API calls directly
- View request/response schemas
- See real-time validation

## 🔐 Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Login Endpoint
```typescript
POST /api/v1/trpc/auth.login
{
  "email": "user@example.com",
  "password": "your-password"
}
```

## 📊 Core Modules

### 🧑‍💼 Customers Module (`/api/v1/trpc/customers.*`)

#### Available Operations:
- `list` - Get paginated customers with filters
- `get` - Get customer by ID with addresses
- `create` - Create new customer
- `update` - Update customer details
- `delete` - Delete customer
- `validateDeliveryWindow` - Validate delivery time slots

#### Example: List Customers
```typescript
GET /api/v1/trpc/customers.list?input={"page":1,"limit":20}

Response:
{
  "customers": [...],
  "totalCount": 150,
  "totalPages": 8,
  "currentPage": 1
}
```

### 📦 Products Module (`/api/v1/trpc/products.*`)

#### Available Operations:
- `list` - Get products with filters and search
- `get` - Get product details with variants
- `create` - Create new product
- `update` - Update product details
- `generateVariantSku` - Generate SKU for product variants
- `createVariantData` - Create product variant
- `getStandardCylinderVariants` - Get standard gas cylinder types
- `calculateExchangeQuantity` - Calculate exchange quantities
- `shouldRequirePickup` - Check if order type requires pickup
- `validateOrderType` - Validate order configuration
- `calculateInventoryMovements` - Calculate stock movements

### 📋 Orders Module (`/api/v1/trpc/orders.*`)

#### Available Operations:
- `list` - Get orders with advanced filtering
- `get` - Get order details with line items
- `create` - Create new order
- `update` - Update order details
- `updateTax` - Update order tax calculation
- `delete` - Delete order
- `getWorkflow` - Get order status workflow
- `calculateTotals` - Calculate order totals with tax
- `formatDate` - Format dates for display
- `validateDeliveryWindow` - Validate delivery windows

#### Example: Calculate Order Totals
```typescript
POST /api/v1/trpc/orders.calculateTotals
{
  "lines": [
    {"quantity": 2, "unit_price": 25.99, "subtotal": 51.98}
  ],
  "tax_percent": 16
}

Response:
{
  "subtotal": 51.98,
  "taxAmount": 8.32,
  "grandTotal": 60.30
}
```

### 🏢 Warehouses Module (`/api/v1/trpc/warehouses.*`)

#### Available Operations:
- `list` - Get warehouses with capacity info
- `get` - Get warehouse details
- `create` - Create new warehouse
- `update` - Update warehouse details
- `delete` - Delete warehouse

### 🚛 Trucks Module (`/api/v1/trpc/trucks.*`)

#### Available Operations:
- `list` - Get trucks with filters
- `get` - Get truck details with inventory
- `create` - Create new truck
- `update` - Update truck details
- `delete` - Delete truck
- `getAllocations` - Get truck allocations by date
- `allocateOrder` - Assign order to truck
- `updateAllocation` - Update truck allocation
- `getRoutes` - Get truck routes
- `createRoute` - Create truck route
- `updateRoute` - Update route details
- `getMaintenance` - Get maintenance records
- `scheduleMaintenance` - Schedule truck maintenance
- `updateMaintenance` - Update maintenance record

#### Capacity Management:
- `calculateOrderWeight` - Calculate order weight for truck capacity
- `calculateCapacity` - Get truck capacity utilization
- `findBestAllocation` - Find optimal truck for order
- `validateAllocation` - Validate truck assignment
- `generateSchedule` - Generate daily truck schedules
- `optimizeAllocations` - Optimize truck assignments

### 🔄 Transfers Module (`/api/v1/trpc/transfers.*`)

#### Available Operations:
- `list` - Get transfers with filters
- `get` - Get transfer details
- `create` - Create new transfer
- `update` - Update transfer
- `updateStatus` - Change transfer status
- `validateMultiSkuTransfer` - Validate transfer items
- `calculateTransferDetails` - Calculate weights and costs
- `validateWarehouseCapacity` - Check destination capacity
- `checkTransferConflicts` - Detect scheduling conflicts
- `estimateTransferDuration` - Estimate completion time
- `validateInventoryAvailability` - Check source inventory

### 💰 Pricing Module (`/api/v1/trpc/pricing.*`)

#### Available Operations:
- `list` - Get price lists
- `get` - Get price list details
- `create` - Create price list
- `update` - Update price list
- `delete` - Delete price list
- `addItems` - Add products to price list
- `updateItem` - Update price list item
- `removeItem` - Remove item from price list
- `getProductPrice` - Get current product price
- `formatCurrency` - Format currency display
- `calculateFinalPrice` - Calculate price with surcharges
- `getPriceListStatus` - Get price list status (active/expired)
- `validateDateRange` - Validate price list dates
- `isExpiringSoon` - Check if price list expires soon

### 📊 Analytics Module (`/api/v1/trpc/analytics.*`)

#### Available Operations:
- `getDashboard` - Get dashboard summary
- `getRevenueMetrics` - Get revenue analytics
- `getOrderTrends` - Get order trend data
- `getTopProducts` - Get best-selling products
- `getCustomerMetrics` - Get customer analytics

## 🔍 Common Query Patterns

### Pagination
Most list endpoints support pagination:
```typescript
{
  "page": 1,
  "limit": 20  // max 100
}
```

### Search and Filters
```typescript
{
  "search": "search term",
  "status": ["active", "pending"],
  "date_from": "2024-01-01",
  "date_to": "2024-12-31"
}
```

### Sorting
```typescript
{
  "sort_by": "created_at",
  "sort_order": "desc"  // "asc" or "desc"
}
```

## 🚨 Error Handling

### Error Response Format
```typescript
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed",
    "data": {
      "zodError": {
        "fieldErrors": {
          "email": ["Invalid email format"]
        }
      }
    }
  }
}
```

### Common Error Codes
- `UNAUTHORIZED` - Invalid or missing authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `BAD_REQUEST` - Invalid input data
- `INTERNAL_SERVER_ERROR` - Server error
- `CONFLICT` - Resource conflict (e.g., duplicate email)

## 📈 Rate Limiting

- **Rate Limit**: 1000 requests per hour per IP
- **Headers**: 
  - `X-RateLimit-Limit`: Total requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Rate limit reset time

## 🔒 Security

- All endpoints use HTTPS in production
- JWT tokens expire after 24 hours
- CORS enabled for authorized domains only
- Request validation using Zod schemas
- SQL injection protection via Supabase
- Rate limiting and DDoS protection

## 🚀 Environment URLs

- **Production**: `https://ordermanagementsystem-production-3ed7.up.railway.app`
- **Interactive Docs**: `https://ordermanagementsystem-production-3ed7.up.railway.app/api/docs`
- **Health Check**: `https://ordermanagementsystem-production-3ed7.up.railway.app/health`

## 📞 Support

For API support or questions:
- Check the interactive documentation at `/api/docs`
- Verify your authentication tokens
- Review request/response formats
- Check the health endpoint for system status

---

*Last updated: 2024-12-31*
*API Version: 1.0.0*