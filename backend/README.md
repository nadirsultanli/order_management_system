# Order Management System - Backend API

## 🚀 Quick Links

- **🌐 Production API**: https://ordermanagementsystem-production-3ed7.up.railway.app
- **📖 Interactive Docs**: https://ordermanagementsystem-production-3ed7.up.railway.app/api/docs
- **📋 Full Documentation**: https://ordermanagementsystem-production-3ed7.up.railway.app/docs
- **💚 Health Check**: https://ordermanagementsystem-production-3ed7.up.railway.app/health

## 🏗️ Architecture

- **Framework**: Express.js + tRPC for type-safe API endpoints
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: JWT with Supabase Auth and tenant isolation
- **Deployment**: Railway with automatic builds
- **Type Safety**: TypeScript + Zod validation
- **Logging**: Winston with structured logging
- **Testing**: Jest with comprehensive test coverage

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

## 📖 Documentation Types

### 1. Interactive API Explorer (`/api/docs`)
**Best for**: Testing endpoints, exploring schemas, live API calls
- Browse all available procedures with real-time testing
- View request/response schemas
- Test authentication flows
- Real-time validation feedback

### 2. Markdown Documentation (`/docs`)
**Best for**: Understanding concepts, implementation guides
- Complete API reference with examples
- Authentication guide
- Error handling patterns
- Integration examples

## 🔗 Core API Modules

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/auth.*` | Login, logout, user registration |
| Customers | `/customers.*` | Customer management & delivery windows |
| Products | `/products.*` | Product catalog, variants & inventory |
| Orders | `/orders.*` | Order lifecycle & calculations |
| Warehouses | `/warehouses.*` | Warehouse operations |
| Trucks | `/trucks.*` | Fleet management & capacity optimization |
| Transfers | `/transfers.*` | Inter-warehouse inventory transfers |
| Pricing | `/pricing.*` | Price lists & real-time calculations |
| Analytics | `/analytics.*` | Business intelligence & reporting |

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