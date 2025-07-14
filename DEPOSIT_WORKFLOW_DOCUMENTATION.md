# Deposit Workflow Implementation Guide

## Overview

This document provides a comprehensive overview of the cylinder deposit system implementation in the Order Management System (OMS). The deposit workflow ensures proper tracking of cylinder deposits charged to customers and facilitates returns/refunds when cylinders are returned.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Deposit Rate Configuration](#deposit-rate-configuration)  
3. [Order Creation with Deposits](#order-creation-with-deposits)
4. [Pricing Formula](#pricing-formula)
5. [Customer Deposit Tracking](#customer-deposit-tracking)
6. [Return & Refund Process](#return--refund-process)
7. [Business Logic Implementation](#business-logic-implementation)
8. [API Endpoints](#api-endpoints)
9. [Database Schema](#database-schema)
10. [Component Architecture](#component-architecture)

## System Architecture

The deposit system is built around the following core components:

- **Deposit Rate Management**: Configure deposit amounts by cylinder capacity
- **Automatic Deposit Lookup**: Products automatically reference deposit rates via capacity
- **Order Integration**: Orders include both gas charges and deposit charges  
- **Customer Tracking**: Complete audit trail of all deposit transactions
- **Refund Processing**: Condition-based refund calculations

## Deposit Rate Configuration

### Rate Structure

Deposit rates are configured by cylinder capacity in liters:

| Capacity | Deposit Amount | Currency |
|----------|----------------|----------|
| 5L       | €25.00         | EUR      |
| 12.5L    | €50.00         | EUR      |
| 19L      | €75.00         | EUR      |
| 35L      | €100.00        | EUR      |
| 47L      | €150.00        | EUR      |

### Key Properties

- **Capacity-based**: Each capacity has exactly one active rate
- **Effective dating**: Rates have start and end dates for historical tracking
- **Currency support**: Multi-currency deposit rates supported
- **Version control**: Historical rates preserved for audit and refund calculations

### Management Interface

The `CapacityDepositManager` component provides:
- Visual grid of all active deposit rates
- Add/edit/delete deposit rate functionality
- Sorting by capacity, amount, or effective date
- Status indicators for active/inactive rates

## Order Creation with Deposits

### Automatic Deposit Lookup

When creating orders, the system automatically:

1. **Product Selection**: User selects products with specified capacities
2. **Rate Lookup**: System queries deposit rates by `capacity_l` field
3. **Price Calculation**: Combines gas price + deposit charge
4. **Line Item Creation**: Each line shows gas and deposit components separately

### Example Order Flow

```typescript
// Product: Propane 12.5L Cylinder
const product = {
  id: 'prod-123',
  name: 'Propane 12.5L Cylinder',
  capacity_l: 12.5,
  gas_price: 35.75
};

// Automatic deposit lookup
const depositRate = getDepositRateByCapacity(12.5); // Returns €50.00

// Order line calculation
const orderLine = {
  product_id: 'prod-123',
  quantity: 2,
  gas_charge: 35.75 * 2,      // €71.50
  deposit_charge: 50.00 * 2,   // €100.00
  line_total: 171.50           // €171.50
};
```

## Pricing Formula

### Core Formula

```
LineTotal = GasCharge + DepositCharge
```

### Component Breakdown

1. **Gas Charge**
   - Revenue-generating portion
   - Based on product pricing
   - Recognized as revenue immediately
   - Subject to taxes

2. **Deposit Charge**  
   - Liability/security portion
   - Based on cylinder capacity
   - Recorded as customer liability
   - Refundable upon return

3. **Line Total**
   - Sum of gas + deposit
   - Amount charged to customer
   - Appears on invoice

### Accounting Treatment

```
Customer Payment: €171.50
├── Revenue: €71.50 (gas charges)
└── Liability: €100.00 (customer deposits)
```

## Customer Deposit Tracking

### Deposit Balance Structure

Each customer maintains:

```typescript
interface CustomerDepositBalance {
  customer_id: string;
  total_deposit_balance: number;
  cylinder_breakdown: [
    {
      capacity_l: 5,
      quantity: 2,
      unit_deposit: 25.00,
      total_deposit: 50.00
    },
    {
      capacity_l: 12.5,
      quantity: 3, 
      unit_deposit: 50.00,
      total_deposit: 150.00
    }
  ];
  pending_refunds: number;
  available_for_refund: number;
}
```

### Transaction History

All deposit transactions are tracked with:
- Transaction type (charge/refund/adjustment)
- Amount and currency
- Associated order/return reference
- Cylinder details (capacity, quantity, condition)
- Timestamps and user attribution

## Return & Refund Process

### Process Flow

1. **Cylinder Return**
   - Customer returns empty cylinders
   - Staff inspects and records condition
   - System identifies original deposit amount

2. **Refund Calculation**
   - Base refund = original deposit amount
   - Condition-based deductions applied
   - Damage assessment if applicable

3. **Refund Processing**
   - Issue refund via chosen method
   - Update customer deposit balance
   - Record transaction for audit

### Condition-Based Refunds

| Condition | Refund % | Description |
|-----------|----------|-------------|
| Excellent | 100%     | Like new condition |
| Good      | 90%      | Minor wear, functional |
| Fair      | 75%      | Noticeable wear |
| Poor      | 50%      | Significant wear |
| Damaged   | 25%      | Requires major repair |
| Scrap     | 0%       | Beyond repair |

## Business Logic Implementation

### Key Business Rules

1. **Rate Uniqueness**: Each capacity has exactly one active rate at any time
2. **Historical Preservation**: Previous rates maintained for accurate refunds
3. **Automatic Lookup**: Products automatically reference rates via capacity
4. **Separated Accounting**: Clear distinction between revenue and liability
5. **Audit Trail**: Complete transaction history maintained
6. **Multi-Currency**: Support for different currencies and exchange rates

### Integration Points

- **Product Management**: Products link to deposits via `capacity_l` field
- **Order Processing**: Orders include deposit calculations automatically  
- **Customer Management**: Deposit balances tracked per customer
- **Financial Reporting**: Deposit liability reporting and analytics

## API Endpoints

### Deposit Rate Management
```
GET    /deposits/rates                    # List all deposit rates
POST   /deposits/rates                    # Create new deposit rate
GET    /deposits/rates/by-capacity        # Get rate by capacity
PUT    /deposits/rates/:id                # Update deposit rate
DELETE /deposits/rates/:id                # Delete deposit rate
```

### Customer Deposits
```
GET    /deposits/customers/:id/balance    # Get customer deposit balance
POST   /deposits/customers/:id/charge     # Charge customer deposit
POST   /deposits/customers/:id/refund     # Refund customer deposit
GET    /deposits/customers/:id/history    # Get deposit transaction history
POST   /deposits/customers/:id/adjust     # Adjust customer deposit
```

### Transaction Management
```
GET    /deposits/transactions             # List all transactions
GET    /deposits/transactions/:id         # Get transaction details
POST   /deposits/transactions/:id/void    # Void transaction
POST   /deposits/calculate-refund         # Calculate refund amount
```

### Analytics & Reporting
```
GET    /deposits/summary                  # Get deposit summary stats
GET    /deposits/analytics                # Get deposit analytics
GET    /deposits/outstanding-report       # Outstanding deposits report
POST   /deposits/validate-refund          # Validate refund eligibility
```

## Database Schema

### Deposit Rates Table
```sql
CREATE TABLE deposit_rates (
  id UUID PRIMARY KEY,
  capacity_l DECIMAL(5,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  effective_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID
);
```

### Deposit Transactions Table
```sql
CREATE TABLE deposit_transactions (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- charge/refund/adjustment
  amount DECIMAL(10,2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  transaction_date TIMESTAMP NOT NULL,
  order_id UUID,
  notes TEXT,
  is_voided BOOLEAN DEFAULT false,
  voided_at TIMESTAMP,
  voided_by UUID,
  void_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Cylinder Transaction Details Table
```sql
CREATE TABLE cylinder_transaction_details (
  id UUID PRIMARY KEY,
  transaction_id UUID NOT NULL,
  product_id UUID NOT NULL,
  capacity_l DECIMAL(5,2) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_deposit DECIMAL(10,2) NOT NULL,
  condition VARCHAR(20), -- for refunds
  FOREIGN KEY (transaction_id) REFERENCES deposit_transactions(id)
);
```

## Component Architecture

### Core Components

1. **CapacityDepositManager** (`/components/pricing/CapacityDepositManager.tsx`)
   - Manages deposit rates by capacity
   - Provides CRUD operations for rates
   - Displays active rates in grid format

2. **DepositRateForm** (`/components/pricing/DepositRateForm.tsx`)
   - Form for creating/editing deposit rates
   - Validation and error handling
   - Date range and currency selection

3. **CustomerDepositBalance** (future component)
   - Display customer deposit summary
   - Show cylinder breakdown
   - Access to transaction history

4. **DepositTransaction** (future component)
   - Record charge/refund transactions
   - Condition assessment for refunds
   - Integration with order/return processes

### Hook Architecture

The `useDeposits.ts` file provides comprehensive hooks for:

- **Rate Management**: `useDepositRates`, `useCreateDepositRate`, etc.
- **Customer Operations**: `useCustomerDepositBalance`, `useChargeCustomerDeposit`
- **Transactions**: `useDepositTransactions`, `useVoidDepositTransaction`
- **Analytics**: `useDepositSummaryStats`, `useDepositAnalytics`

### State Management

Deposit data is managed through:
- TRPC for API integration
- React Query for caching and synchronization
- Local state for form management
- Context invalidation for real-time updates

## Demo Implementation

The `DepositWorkflowDemo` component (`/components/demo/DepositWorkflowDemo.tsx`) provides:

1. **Interactive Examples**: Live demonstration of deposit calculations
2. **Visual Workflows**: Step-by-step process illustration  
3. **Sample Data**: Realistic examples with multiple cylinder sizes
4. **Business Logic**: Complete implementation walkthrough
5. **Technical Details**: Component architecture and API integration

### Accessing the Demo

Navigate to `/pricing/demo` or click the "View Demo" button on the Pricing page to access the comprehensive workflow demonstration.

## Testing Scenarios

### Test Cases for Validation

1. **Deposit Rate Creation**
   - Create rates for different capacities
   - Test effective date validation
   - Verify currency support

2. **Order Processing**
   - Add products with different capacities
   - Verify automatic deposit lookup
   - Confirm pricing calculations

3. **Customer Tracking**
   - Charge deposits on orders
   - Track customer balances
   - Verify transaction history

4. **Refund Processing**
   - Return cylinders in various conditions
   - Calculate condition-based refunds
   - Process refund transactions

## Conclusion

The deposit workflow implementation provides a comprehensive solution for managing cylinder deposits in the OMS. The system ensures accurate tracking, proper accounting separation, and complete audit trails while maintaining flexibility for various business scenarios.

The modular architecture allows for easy extension and modification while the robust API design supports integration with external systems. The demo component provides immediate visibility into the system's capabilities and serves as both documentation and training material.