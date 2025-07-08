# Delivery and Pickup Tracking Implementation

## Overview

This document describes the implementation of the delivery and pickup tracking system with customer balance management for the LPG order management system.

## Features Implemented

### 1. Database Schema

#### Tables Created
- **customer_balances**: Tracks cylinder balances per customer/product
  - `cylinders_with_customer`: Number of cylinders currently with the customer
  - `cylinders_to_return`: Number of empty cylinders to be returned
  - `deposit_amount`: Total deposit amount for cylinders
  - `credit_balance`: Customer's credit balance (negative means customer owes)

- **customer_transactions**: Records all balance changes
  - Transaction types: delivery, pickup, exchange, deposit, refund, adjustment
  - Tracks quantity changes, amounts, and descriptions

- **deliveries**: Main delivery tracking table
  - Links to orders, customers, delivery addresses, and trucks
  - Tracks status: pending, in_transit, delivered, failed, cancelled
  - Supports GPS coordinates, signatures, and photos

- **delivery_items**: Line items for deliveries
  - `quantity_delivered`: Actual quantity delivered
  - `quantity_returned`: Empty cylinders returned during delivery

- **pickups**: Main pickup tracking table
  - Similar structure to deliveries
  - Status: pending, in_transit, completed, failed, cancelled

- **pickup_items**: Line items for pickups
  - `quantity_picked_up`: Number of cylinders picked up
  - `condition`: Condition of picked up cylinders (good, damaged, needs_repair)

#### Views Created
- **customer_cylinder_summary**: Aggregated view of customer balances by product
- **recent_deliveries_view**: Simplified view for recent deliveries
- **recent_pickups_view**: Simplified view for recent pickups

#### Sequences
- **delivery_seq**: Auto-generates delivery numbers (DEL-YYYYMMDD-NNNNNN)
- **pickup_seq**: Auto-generates pickup numbers (PCK-YYYYMMDD-NNNNNN)

### 2. Database Functions

#### Core Processing Functions
- **process_delivery**: Handles delivery processing
  - Updates truck inventory (decreases for delivered items)
  - Creates customer transactions
  - Updates customer balances
  - Creates stock movements
  - Returns delivery ID

- **process_pickup**: Handles pickup processing
  - Updates truck inventory (increases for picked up items)
  - Creates customer transactions
  - Updates customer balances
  - Creates stock movements
  - Returns pickup ID

#### Completion Functions
- **complete_delivery**: Marks delivery as completed
  - Updates status to 'delivered'
  - Records completion timestamp
  - Stores signature and photo URLs
  - Updates order status if linked

- **complete_pickup**: Marks pickup as completed
  - Updates status to 'completed'
  - Records completion timestamp
  - Stores signature and photo URLs

#### Query Functions
- **get_customer_cylinder_balance**: Retrieves customer balance information
  - Can filter by specific product
  - Returns detailed balance information

### 3. Backend API (TRPC)

#### Endpoints in `backend/src/routes/deliveries.ts`

- **process**: Unified endpoint for processing deliveries and pickups
  ```typescript
  type: 'delivery' | 'pickup'
  data: ProcessDeliveryData | ProcessPickupData
  ```

- **complete**: Unified endpoint for completing deliveries and pickups
  ```typescript
  type: 'delivery' | 'pickup'
  data: CompleteDeliveryData | CompletePickupData
  ```

- **listDeliveries**: Query deliveries with filters
  - Filter by customer, truck, status, date range
  - Pagination support

- **listPickups**: Query pickups with filters
  - Similar to listDeliveries

- **getDelivery/getPickup**: Get detailed information

- **getCustomerBalance**: Get cylinder balance for a customer

- **getCustomerTransactions**: Get transaction history

### 4. Frontend Implementation

#### Components Created

1. **DeliveryPickupDashboard** (`src/components/deliveries/DeliveryPickupDashboard.tsx`)
   - Main dashboard with three tabs: Deliveries, Pickups, Customer Balances
   - Shows statistics cards for today's activities
   - Integrates all sub-components

2. **DeliveryList** (`src/components/deliveries/DeliveryList.tsx`)
   - Lists deliveries with filters (status, date)
   - Shows delivery details in cards
   - Navigation to delivery details
   - Real-time data fetching with loading states

3. **PickupList** (`src/components/deliveries/PickupList.tsx`)
   - Lists pickups with filters
   - Similar functionality to DeliveryList
   - Green-themed UI for pickups

4. **CustomerBalanceCard** (`src/components/deliveries/CustomerBalanceCard.tsx`)
   - Customer selector with search
   - Summary cards showing total cylinders, to return, deposits, credit
   - Detailed balance table by product
   - Real-time balance fetching

#### Hooks Created (`src/hooks/useDeliveries.ts`)

- **useDeliveries**: List deliveries with filters
- **usePickups**: List pickups with filters
- **useDelivery**: Get delivery details
- **usePickup**: Get pickup details
- **useCustomerBalance**: Get customer balance
- **useCustomerTransactions**: Get transaction history
- **useProcessDelivery**: Process new delivery
- **useProcessPickup**: Process new pickup
- **useCompleteDelivery**: Complete delivery
- **useCompletePickup**: Complete pickup

#### Types Created (`src/types/delivery.ts`)

- Comprehensive TypeScript interfaces for all entities
- Process and complete data interfaces
- View types for list displays

### 5. Integration

- Added route in `App.tsx`: `/deliveries`
- Added menu item in sidebar: "Deliveries & Pickups"
- Integrated with existing authentication and context
- Connected to TRPC client for API calls

## Key Design Decisions

1. **Unified API Endpoint**: Single endpoint handles both deliveries and pickups with a type parameter
2. **Automatic Balance Tracking**: Database triggers automatically update balances
3. **Comprehensive Audit Trail**: All changes tracked in customer_transactions
4. **GPS and Proof Support**: Built-in support for location tracking and delivery proof
5. **Separate Views**: Database views for common query patterns improve performance

## Usage

### For Admins

1. Navigate to "Deliveries & Pickups" from the sidebar
2. View and manage deliveries in the Deliveries tab
3. View and manage pickups in the Pickups tab
4. Check customer cylinder balances in the Customer Balances tab

### Processing a Delivery

1. Create a new delivery (functionality to be added)
2. Select customer, truck, and items
3. Process the delivery (updates inventory and balances)
4. Complete with signature/photo when delivered

### Processing a Pickup

1. Create a new pickup
2. Select customer and items to pick up
3. Process the pickup (updates inventory and balances)
4. Complete with signature/photo when done

## Next Steps

1. Add forms for creating new deliveries and pickups
2. Add delivery/pickup detail pages
3. Implement signature and photo capture
4. Add GPS tracking integration
5. Create mobile-friendly driver interface
6. Add reporting and analytics
7. Implement push notifications for status updates

## Testing

The system includes comprehensive database functions that handle:
- Inventory updates
- Balance calculations
- Transaction logging
- Status management

All operations are wrapped in transactions to ensure data consistency. 