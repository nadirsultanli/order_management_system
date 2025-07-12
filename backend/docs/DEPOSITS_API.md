# Deposit Management API Documentation

This documentation covers the comprehensive deposit management endpoints for the gas cylinder business. The API handles cylinder deposit rates, customer deposit tracking, transaction management, validation, and reporting.

## Overview

The deposit management system tracks:
- **Cylinder Deposit Rates**: Configurable rates by cylinder capacity
- **Customer Deposits**: Individual customer deposit balances and transactions
- **Transaction History**: Complete audit trail of all deposit activities
- **Refund Processing**: Condition-based refund calculations with damage assessments
- **Reporting**: Comprehensive business intelligence and analytics

## Base URL

All endpoints are prefixed with `/api/v1/deposits` unless otherwise specified.

## Authentication

All endpoints require authentication. Include your bearer token in the Authorization header:

```
Authorization: Bearer <your-token>
```

---

## 📊 Deposit Rate Management

### List All Deposit Rates

**GET** `/deposits/rates`

Retrieve a paginated list of cylinder deposit rates with filtering options.

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 50, max: 100) - Items per page
- `search` (string, optional) - Search in notes and capacity
- `capacity_l` (number, optional) - Filter by specific capacity
- `currency_code` (string, optional) - Filter by currency (3-char code)
- `is_active` (boolean, optional) - Filter by active status
- `effective_date` (string, optional) - ISO date to filter rates effective on this date
- `sort_by` (enum: capacity_l|deposit_amount|effective_date|created_at, default: capacity_l)
- `sort_order` (enum: asc|desc, default: asc)

**Response:**
```json
{
  "rates": [
    {
      "id": "uuid",
      "capacity_l": 13,
      "deposit_amount": 1500,
      "currency_code": "KES",
      "effective_date": "2024-01-01",
      "end_date": "2024-12-31",
      "notes": "Standard rate for 13L cylinders",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "created_by": "uuid"
    }
  ],
  "totalCount": 25,
  "totalPages": 3,
  "currentPage": 1
}
```

### Create New Deposit Rate

**POST** `/deposits/rates`

Create a new deposit rate for a specific cylinder capacity.

**Request Body:**
```json
{
  "capacity_l": 13,
  "deposit_amount": 1500,
  "currency_code": "KES",
  "effective_date": "2024-01-01",
  "end_date": "2024-12-31",
  "notes": "Standard rate for 13L cylinders",
  "is_active": true
}
```

**Business Rules:**
- Cannot create overlapping date ranges for same capacity/currency
- Deposit amount must be positive
- Effective date cannot be in the past
- Automatically validates for conflicts with existing rates

### Update Deposit Rate

**PUT** `/deposits/rates/{id}`

Update an existing deposit rate. Historical rates (with effective_date in the past) cannot be modified.

**Request Body:**
```json
{
  "deposit_amount": 1800,
  "end_date": "2024-06-30",
  "notes": "Updated rate due to market conditions",
  "is_active": false
}
```

### Delete Deposit Rate

**DELETE** `/deposits/rates/{id}`

Soft delete a deposit rate by setting its end date. This preserves historical integrity.

### Get Deposit Rate by Capacity

**GET** `/deposits/rates/by-capacity/{capacity}`

Retrieve the current deposit rate for a specific cylinder capacity.

**Query Parameters:**
- `currency_code` (string, default: "KES") - Currency code
- `as_of_date` (string, optional) - ISO date, defaults to today

**Response:**
```json
{
  "capacity_l": 13,
  "deposit_amount": 1500,
  "currency_code": "KES",
  "effective_date": "2024-01-01",
  "rate_id": "uuid",
  "is_default": false
}
```

### Bulk Update Deposit Rates

**POST** `/deposits/rates/bulk-update`

Update multiple deposit rates at once with optional end-dating of current rates.

**Request Body:**
```json
{
  "updates": [
    {
      "capacity_l": 13,
      "deposit_amount": 1600,
      "currency_code": "KES"
    },
    {
      "capacity_l": 6,
      "deposit_amount": 800,
      "currency_code": "KES"
    }
  ],
  "effective_date": "2024-07-01",
  "notes": "Market adjustment Q3 2024",
  "end_current_rates": true
}
```

---

## 👥 Customer Deposit Tracking

### Get Customer Deposit Balance

**GET** `/customers/{customer_id}/deposits/balance`

Retrieve the current deposit balance for a customer with optional cylinder breakdown.

**Query Parameters:**
- `include_details` (boolean, default: false) - Include breakdown by cylinder capacity

**Response:**
```json
{
  "customer_id": "uuid",
  "customer_name": "Acme Corporation",
  "total_deposit_balance": 15000,
  "currency_code": "KES",
  "last_updated": "2024-01-15T10:30:00Z",
  "cylinder_breakdown": [
    {
      "capacity_l": 13,
      "quantity": 8,
      "unit_deposit": 1500,
      "total_deposit": 12000
    },
    {
      "capacity_l": 6,
      "quantity": 4,
      "unit_deposit": 750,
      "total_deposit": 3000
    }
  ],
  "pending_refunds": 0,
  "available_for_refund": 15000
}
```

### Get Customer Deposit History

**GET** `/customers/{customer_id}/deposits/history`

Retrieve the deposit transaction history for a customer with filtering and pagination.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 50, max: 100)
- `transaction_type` (enum: charge|refund|adjustment|all, default: all)
- `from_date` (string, optional) - ISO date
- `to_date` (string, optional) - ISO date
- `sort_by` (enum: transaction_date|amount|transaction_type, default: transaction_date)
- `sort_order` (enum: asc|desc, default: desc)

### Charge Deposit to Customer

**POST** `/customers/{customer_id}/deposits/charge`

Charge cylinder deposits to a customer account when cylinders are delivered.

**Request Body:**
```json
{
  "cylinders": [
    {
      "product_id": "uuid",
      "quantity": 5,
      "capacity_l": 13,
      "unit_deposit": 1500
    }
  ],
  "order_id": "uuid",
  "notes": "Delivery #DEL-2024-001",
  "override_reason": "Special customer rate"
}
```

**Response:**
```json
{
  "transaction_id": "uuid",
  "customer_id": "uuid",
  "total_charged": 7500,
  "currency_code": "KES",
  "new_balance": 22500,
  "cylinders_charged": [
    {
      "product_id": "uuid",
      "product_name": "13L Gas Cylinder",
      "quantity": 5,
      "capacity_l": 13,
      "unit_deposit": 1500,
      "total_deposit": 7500
    }
  ],
  "order_id": "uuid",
  "created_at": "2024-01-15T14:30:00Z"
}
```

### Refund Deposit to Customer

**POST** `/customers/{customer_id}/deposits/refund`

Process cylinder deposit refunds when cylinders are returned, with condition-based deductions.

**Request Body:**
```json
{
  "cylinders": [
    {
      "product_id": "uuid",
      "quantity": 3,
      "capacity_l": 13,
      "condition": "good",
      "damage_percentage": 0,
      "serial_numbers": ["CYL001", "CYL002", "CYL003"]
    },
    {
      "product_id": "uuid",
      "quantity": 1,
      "capacity_l": 13,
      "condition": "damaged",
      "damage_percentage": 25
    }
  ],
  "order_id": "uuid",
  "notes": "Return from delivery #DEL-2024-001",
  "refund_method": "credit"
}
```

**Condition Logic:**
- `good`: Full refund (100%)
- `damaged`: Partial refund based on damage_percentage
- `missing`: No refund (0%)

### Get Customer Cylinders

**GET** `/customers/{customer_id}/deposits/cylinders`

Retrieve information about cylinders currently held by a customer.

**Query Parameters:**
- `include_history` (boolean, default: false) - Include recent transaction history
- `group_by_capacity` (boolean, default: true) - Group results by cylinder capacity

---

## 💳 Transaction Management

### List Deposit Transactions

**GET** `/deposits/transactions`

Retrieve a paginated list of all deposit transactions with comprehensive filtering.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 50, max: 100)
- `customer_id` (string, optional) - Filter by customer
- `transaction_type` (enum: charge|refund|adjustment, optional)
- `from_date` (string, optional) - ISO date
- `to_date` (string, optional) - ISO date
- `min_amount` (number, optional) - Minimum transaction amount
- `max_amount` (number, optional) - Maximum transaction amount
- `currency_code` (string, optional) - Filter by currency
- `include_voided` (boolean, default: false) - Include voided transactions
- `sort_by` (enum: transaction_date|amount|customer_name, default: transaction_date)
- `sort_order` (enum: asc|desc, default: desc)

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "customer_id": "uuid",
      "customer_name": "Acme Corporation",
      "transaction_type": "charge",
      "amount": 7500,
      "currency_code": "KES",
      "transaction_date": "2024-01-15T14:30:00Z",
      "order_id": "uuid",
      "notes": "Delivery charge",
      "created_by": "uuid",
      "is_voided": false,
      "cylinder_details": [
        {
          "product_id": "uuid",
          "product_name": "13L Gas Cylinder",
          "capacity_l": 13,
          "quantity": 5,
          "unit_deposit": 1500,
          "condition": null
        }
      ]
    }
  ],
  "totalCount": 150,
  "totalPages": 15,
  "currentPage": 1,
  "summary": {
    "total_charges": 450000,
    "total_refunds": 125000,
    "total_adjustments": -5000,
    "net_deposits": 320000
  }
}
```

### Calculate Refund Amount

**POST** `/deposits/transactions/calculate-refund`

Calculate the refund amount for cylinder returns based on condition and depreciation.

**Request Body:**
```json
{
  "customer_id": "uuid",
  "cylinders": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "capacity_l": 13,
      "condition": "damaged",
      "damage_percentage": 25,
      "days_held": 180
    }
  ],
  "apply_depreciation": true,
  "depreciation_rate_per_year": 10
}
```

**Response:**
```json
{
  "customer_id": "uuid",
  "total_refund_amount": 2025,
  "currency_code": "KES",
  "cylinder_calculations": [
    {
      "product_id": "uuid",
      "product_name": "13L Gas Cylinder",
      "capacity_l": 13,
      "quantity": 2,
      "original_deposit": 3000,
      "condition": "damaged",
      "damage_deduction": 750,
      "depreciation_deduction": 225,
      "refund_amount": 2025,
      "refund_percentage": 67.5
    }
  ],
  "deductions_summary": {
    "damage_deductions": 750,
    "depreciation_deductions": 225,
    "total_deductions": 975
  },
  "eligibility": {
    "is_eligible": true,
    "reasons": []
  }
}
```

---

## ✅ Validation Endpoints

### Validate Deposit Rate

**POST** `/deposits/validate-rate`

Validate a deposit rate for conflicts and business rules before creation.

**Request Body:**
```json
{
  "capacity_l": 13,
  "deposit_amount": 1500,
  "currency_code": "KES",
  "effective_date": "2024-01-01",
  "check_conflicts": true
}
```

**Response:**
```json
{
  "is_valid": true,
  "errors": [],
  "warnings": ["Deposit amount seems low for the capacity"],
  "conflicts": []
}
```

### Validate Refund Eligibility

**POST** `/deposits/validate-refund`

Validate if a customer is eligible for a deposit refund.

**Request Body:**
```json
{
  "customer_id": "uuid",
  "cylinder_count": 5,
  "capacity_l": 13,
  "check_balance": true
}
```

---

## 🔧 Utility Endpoints

### Manual Deposit Adjustment

**POST** `/deposits/adjust`

Manually adjust a customer deposit balance with proper authorization and audit trail.

**Request Body:**
```json
{
  "customer_id": "uuid",
  "adjustment_amount": -500,
  "currency_code": "KES",
  "reason": "Damage compensation for returned cylinder",
  "reference_number": "ADJ-2024-001",
  "approved_by": "manager-uuid"
}
```

**Response:**
```json
{
  "transaction_id": "uuid",
  "customer_id": "uuid",
  "adjustment_amount": -500,
  "currency_code": "KES",
  "previous_balance": 15000,
  "new_balance": 14500,
  "reason": "Damage compensation for returned cylinder",
  "reference_number": "ADJ-2024-001",
  "created_at": "2024-01-15T16:00:00Z",
  "created_by": "uuid"
}
```

### Get Audit Trail

**GET** `/deposits/audit-trail/{transaction_id}`

Retrieve the complete audit trail for a deposit transaction.

**Query Parameters:**
- `include_related` (boolean, default: true) - Include related transactions

---

## 📊 Reporting Endpoints

### Deposit Summary Report

**GET** `/deposits/reports/summary`

Generate a summary report of deposit transactions for a specified period.

**Query Parameters:**
- `from_date` (string, required) - ISO date
- `to_date` (string, required) - ISO date
- `group_by` (enum: customer|capacity|month|transaction_type, default: transaction_type)
- `currency_code` (string, optional) - Filter by currency

**Response:**
```json
{
  "period": {
    "from_date": "2024-01-01",
    "to_date": "2024-12-31"
  },
  "summary": {
    "total_charges": 500000,
    "total_refunds": 150000,
    "total_adjustments": -5000,
    "net_change": 345000,
    "ending_balance": 800000
  },
  "breakdown": [
    {
      "group": "charge",
      "charges": 500000,
      "refunds": 0,
      "adjustments": 0,
      "net_change": 500000,
      "transaction_count": 125
    },
    {
      "group": "refund",
      "charges": 0,
      "refunds": 150000,
      "adjustments": 0,
      "net_change": -150000,
      "transaction_count": 45
    }
  ],
  "currency_code": "KES"
}
```

### Outstanding Deposits Report

**GET** `/deposits/reports/outstanding`

Generate a report of outstanding cylinder deposits by customer.

**Query Parameters:**
- `as_of_date` (string, optional) - ISO date, defaults to today
- `min_days_outstanding` (number, optional) - Minimum days outstanding filter
- `customer_id` (string, optional) - Filter by specific customer
- `group_by` (enum: customer|capacity|age, default: customer)
- `include_zero_balance` (boolean, default: false) - Include customers with zero balance

**Response:**
```json
{
  "as_of_date": "2024-01-15",
  "total_outstanding": 850000,
  "currency_code": "KES",
  "customer_count": 45,
  "cylinder_count": 567,
  "breakdown": [
    {
      "group": "0-30 days",
      "outstanding_amount": 320000,
      "customer_count": 20,
      "cylinder_count": 213,
      "average_days_outstanding": 15,
      "oldest_deposit_date": "2023-12-15"
    }
  ],
  "top_customers": [
    {
      "customer_id": "uuid",
      "customer_name": "Acme Corporation",
      "outstanding_amount": 45000,
      "cylinder_count": 30,
      "oldest_deposit_date": "2023-11-01",
      "days_outstanding": 75
    }
  ]
}
```

---

## 🚨 Error Handling

All endpoints follow standard HTTP status codes:

- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid input or business rule violation
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate rate)
- **500 Internal Server Error**: Server error

Error responses include detailed messages:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "An active deposit rate already exists for this capacity and date range",
    "details": {
      "capacity_l": 13,
      "currency_code": "KES",
      "conflicting_rate_id": "uuid"
    }
  }
}
```

---

## 💡 Business Rules

### Deposit Rate Management
- Only one active rate per capacity/currency combination at any time
- Historical rates cannot be modified (data integrity)
- Future rates can be pre-configured
- Soft deletion preserves audit trail
- Reasonable deposit amounts validated (10-1000 KES per liter)

### Customer Transactions
- Deposits charged when cylinders delivered
- Refunds processed when cylinders returned
- Condition-based refund calculations:
  - **Good**: 100% refund
  - **Damaged**: Partial refund based on damage assessment
  - **Missing**: 0% refund
- Optional depreciation calculations for long-held cylinders
- Balance cannot go negative without explicit adjustment approval

### Audit and Compliance
- Complete transaction audit trail
- User attribution for all changes
- Reference numbers for manual adjustments
- Approval workflow for sensitive operations
- Data retention for regulatory compliance

### Reporting and Analytics
- Real-time balance calculations
- Aging analysis for outstanding deposits
- Revenue impact tracking
- Customer behavior insights
- Operational efficiency metrics

---

## 🔗 Integration Examples

### Charging Deposits on Order Delivery

```javascript
// When an order is delivered, charge deposits
const chargeResponse = await fetch('/api/v1/customers/123/deposits/charge', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    cylinders: [
      {
        product_id: 'cylinder-product-id',
        quantity: 5,
        capacity_l: 13
      }
    ],
    order_id: 'order-uuid',
    notes: 'Delivery charge for order #1234'
  })
});
```

### Processing Returns with Condition Assessment

```javascript
// When cylinders are returned, process refunds
const refundResponse = await fetch('/api/v1/customers/123/deposits/refund', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    cylinders: [
      {
        product_id: 'cylinder-product-id',
        quantity: 3,
        capacity_l: 13,
        condition: 'good'
      },
      {
        product_id: 'cylinder-product-id',
        quantity: 1,
        capacity_l: 13,
        condition: 'damaged',
        damage_percentage: 25
      }
    ],
    refund_method: 'credit',
    notes: 'Return processing for order #1234'
  })
});
```

This comprehensive deposit management system provides full lifecycle tracking of cylinder deposits, ensuring accurate financial records, customer satisfaction, and operational efficiency for your gas cylinder business.