# tRPC Usage Guide for Order Management System

## Important: Understanding tRPC HTTP Methods

**All tRPC endpoints use POST method**, regardless of whether they are queries (read operations) or mutations (write operations). This is a fundamental characteristic of tRPC.

## Why POST for Everything?

1. **Query Parameters in Body**: tRPC needs to pass complex query parameters, which are easier to handle in a request body
2. **Type Safety**: The request body allows for full TypeScript type validation
3. **Consistency**: Using POST for all operations simplifies the transport layer

## Query vs Mutation

The distinction between read and write operations is made in the **backend router definition**, not by HTTP method:

### Query Procedures (Read Operations)
```typescript
// Backend definition
list: protectedProcedure
  .input(CustomerFiltersSchema)
  .query(async ({ input, ctx }) => {
    // Read-only operation
  })
```

Examples:
- `customers.list` - Get list of customers
- `customers.getById` - Get customer details
- `customers.getOrderHistory` - Get customer's orders
- `customers.getAnalytics` - Get customer analytics
- `customers.getAddresses` - Get customer addresses

### Mutation Procedures (Write Operations)
```typescript
// Backend definition
create: protectedProcedure
  .input(CreateCustomerSchema)
  .mutation(async ({ input, ctx }) => {
    // Write operation
  })
```

Examples:
- `customers.create` - Create new customer
- `customers.update` - Update customer
- `customers.delete` - Delete customer
- `customers.createAddress` - Add new address
- `customers.validate` - Validate data (considered mutation due to potential side effects)

## Making API Calls

### Example: List Customers (Query)
```bash
curl -X POST https://your-api.com/api/v1/trpc/customers.list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "search": "John",
    "account_status": "active",
    "page": 1,
    "limit": 50
  }'
```

### Example: Get Customer by ID (Query)
```bash
curl -X POST https://your-api.com/api/v1/trpc/customers.getById \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customer_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

### Example: Create Customer (Mutation)
```bash
curl -X POST https://your-api.com/api/v1/trpc/customers.create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "account_status": "active",
    "credit_terms_days": 30,
    "address": {
      "line1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "US"
    }
  }'
```

## Response Format

All tRPC responses follow this structure:

### Success Response
```json
{
  "result": {
    "data": {
      // Your actual response data here
    }
  }
}
```

### Error Response
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "data": {
      "code": "TRPC_ERROR_CODE",
      "httpStatus": 404,
      "path": "customers.getById"
    }
  }
}
```

## Common Error Codes

- `NOT_FOUND` - Resource not found (404)
- `BAD_REQUEST` - Invalid input (400)
- `UNAUTHORIZED` - Authentication required (401)
- `FORBIDDEN` - Insufficient permissions (403)
- `INTERNAL_SERVER_ERROR` - Server error (500)

## Best Practices

1. **Always use POST** - Don't try to use GET/PUT/DELETE for tRPC endpoints
2. **Pass parameters in body** - All parameters go in the request body, not URL
3. **Check procedure type** - Look at the backend code to determine if it's a query or mutation
4. **Handle nested responses** - Remember that data is nested under `result.data`
5. **Include authentication** - Most endpoints require Bearer token authorization

## Testing with Tools

### Postman/Insomnia
1. Set method to POST
2. Set URL to `https://your-api.com/api/v1/trpc/[procedure.name]`
3. Add Authorization header with Bearer token
4. Add request body with your parameters

### Scalar Documentation
The API documentation at `/scalar` shows all endpoints, but remember they all use POST despite what traditional REST conventions might suggest.