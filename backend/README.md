# Order Management System - Backend API

Backend API for the LPG Order Management System with multi-tenant support.

## Features

- **tRPC** for type-safe API endpoints
- **Multi-tenant architecture** with Row Level Security (RLS)
- **JWT authentication** with tenant isolation
- **Supabase integration** for database operations
- **TypeScript** for type safety
- **Comprehensive logging** with Winston
- **Test framework** with Jest

## Project Structure

```
backend/
├── src/
│   ├── lib/           # Core utilities and configuration
│   │   ├── supabase.ts    # Supabase client setup
│   │   ├── context.ts     # tRPC context with auth
│   │   ├── auth.ts        # Authentication helpers
│   │   ├── logger.ts      # Winston logger setup
│   │   └── trpc.ts        # tRPC configuration
│   ├── routes/        # API route definitions
│   │   ├── orders.ts      # Order management endpoints
│   │   ├── inventory.ts   # Inventory management endpoints
│   │   ├── transfers.ts   # Transfer operations endpoints
│   │   ├── pricing.ts     # Pricing calculation endpoints
│   │   ├── customers.ts   # Customer management endpoints
│   │   ├── analytics.ts   # Analytics and reporting endpoints
│   │   └── index.ts       # Router composition
│   ├── __tests__/     # Test files
│   └── index.ts       # Application entry point
├── docs/              # API documentation
└── logs/              # Application logs
```

## Getting Started

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

## API Endpoints

The API uses tRPC with the following main routers:

- `/api/v1/trpc/orders.*` - Order management
- `/api/v1/trpc/inventory.*` - Inventory operations
- `/api/v1/trpc/transfers.*` - Transfer management
- `/api/v1/trpc/pricing.*` - Pricing calculations
- `/api/v1/trpc/customers.*` - Customer operations
- `/api/v1/trpc/analytics.*` - Analytics and reporting

## Authentication

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header. The token must contain:

- `user_id` - User identifier
- `tenant_id` - Tenant identifier for multi-tenancy
- `role` - User role (user, admin)

## Multi-Tenancy

The system enforces strict tenant isolation:

- All database queries are automatically scoped by `tenant_id`
- Row Level Security (RLS) policies prevent cross-tenant data access
- API endpoints validate tenant access on every request

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `JWT_SECRET` | JWT signing secret |
| `PORT` | Server port (default: 3001) |
| `NODE_ENV` | Environment (development/production) |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) |

## Next Steps

1. Implement business logic in route handlers
2. Add comprehensive test coverage
3. Set up Row Level Security policies
4. Configure CI/CD pipeline
5. Add API documentation with OpenAPI