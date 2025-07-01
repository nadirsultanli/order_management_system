# Voice Agent Integration Guide

This guide explains how to integrate voice agents (Claude, ChatGPT, etc.) with your Order Management System using the Model Context Protocol (MCP).

## Overview

Your Order Management System now includes MCP (Model Context Protocol) support, enabling seamless integration with AI agents for:

- **Voice-controlled order management**
- **Automated inventory tracking**
- **AI-assisted customer service**
- **Business intelligence queries**
- **Automated reporting and analytics**

## MCP Implementation

### Available Tools

The system exposes 16 comprehensive tools for AI agents:

#### Order Management
- `list_orders` - Find orders with filtering and search
- `get_order` - Get detailed order information
- `create_order` - Create new orders with automatic calculations
- `update_order_status` - Change order status with inventory side effects
- `calculate_order_total` - Recalculate order totals and taxes

#### Customer Management
- `list_customers` - Search and list customers
- `get_customer` - Get customer details and history
- `get_customer_order_history` - Retrieve customer's order history

#### Inventory Management
- `list_inventory` - Check stock levels across warehouses
- `adjust_inventory` - Adjust stock levels with audit trail
- `transfer_inventory` - Transfer stock between warehouses

#### Business Intelligence
- `calculate_pricing` - Get dynamic pricing with customer tiers
- `validate_transfer` - Validate transfer requests before execution
- `get_dashboard_stats` - Retrieve comprehensive business metrics

#### System Health
- `health_check` - Check system status and connectivity

### Tool Characteristics

All tools are designed for AI agent integration with:

✅ **Idempotent Operations** - Safe to retry without side effects
✅ **Comprehensive Validation** - Built-in error handling and validation
✅ **Tenant Isolation** - Automatic multi-tenant security
✅ **Detailed Responses** - Structured data perfect for AI processing
✅ **Business Rule Enforcement** - Automatic workflow management

## Integration Examples

### Example 1: Voice Order Creation

**User:** "Create an order for customer John Smith with 5 units of product LPG-100"

**AI Agent Flow:**
1. `list_customers` with search="John Smith"
2. `list_inventory` to check product availability
3. `calculate_pricing` for the customer and quantity
4. `create_order` with validated data
5. Confirm order creation with order details

### Example 2: Inventory Management

**User:** "How much LPG-100 do we have in the main warehouse?"

**AI Agent Flow:**
1. `list_inventory` filtered by product and warehouse
2. Present current stock levels and status

### Example 3: Order Status Updates

**User:** "Mark order ORD-12345 as delivered"

**AI Agent Flow:**
1. `get_order` to verify order exists and current status
2. `update_order_status` to delivered (automatically handles inventory)
3. Confirm status change and any side effects

### Example 4: Business Intelligence

**User:** "Show me this month's sales summary"

**AI Agent Flow:**
1. `get_dashboard_stats` with period="month"
2. Present formatted summary of orders, revenue, and KPIs

## Claude Desktop Integration

### Setup Configuration

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "order-management": {
      "command": "node",
      "args": ["/path/to/your/backend/dist/mcp/mcp-server.js"],
      "env": {
        "SUPABASE_URL": "your_supabase_url",
        "SUPABASE_SERVICE_ROLE_KEY": "your_service_role_key",
        "JWT_SECRET": "your_jwt_secret",
        "MCP_AUTH_TOKEN": "your_auth_token"
      }
    }
  }
}
```

### Usage in Claude

Once configured, you can interact with your Order Management System naturally:

```
User: "What orders do we have pending delivery?"

Claude: I'll check your pending delivery orders for you.

[Calls list_orders with status="confirmed"]

You have 12 orders pending delivery:
- Order ORD-001: Customer ABC Corp, $2,450.00, scheduled for tomorrow
- Order ORD-002: Customer XYZ Ltd, $1,200.00, scheduled for Friday
...

Would you like me to update any of these orders or get more details about specific ones?
```

## ChatGPT Integration

### OpenAI Actions Setup

1. Create a new GPT in ChatGPT
2. Import the tools manifest as OpenAI Actions
3. Configure authentication with your API endpoint

### API Configuration

```yaml
# For ChatGPT Actions
openapi: 3.0.0
info:
  title: Order Management System
  version: 1.0.0
servers:
  - url: http://localhost:3001/api/v1/trpc

# Import tool definitions from tools-manifest.json
```

## Development and Testing

### Running the MCP Server

```bash
# Start the MCP server
cd backend
npm run build
node dist/mcp/mcp-server.js
```

### Testing Tools

```bash
# Test individual tools using the MCP SDK
npx @modelcontextprotocol/cli test-tool list_orders '{"status": "confirmed"}'
```

### Authentication Setup

Set environment variables for MCP server:

```bash
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" 
export JWT_SECRET="your_jwt_secret"
export MCP_AUTH_TOKEN="your_auth_token"
```

## Voice Agent Capabilities

With this integration, voice agents can now:

### Order Management
- "Create an order for customer X with products Y and Z"
- "What's the status of order 12345?"
- "Mark all confirmed orders as scheduled for delivery"
- "Show me today's completed orders"

### Inventory Operations
- "How much inventory do we have for product ABC?"
- "Transfer 100 units from warehouse A to warehouse B"
- "Adjust inventory for product XYZ to 500 units"
- "Show me products with low stock"

### Customer Service
- "Find customer John Smith's order history"
- "What's the total value of ABC Corp's orders this month?"
- "Create a new customer with address details"

### Business Intelligence
- "Show me this week's sales summary"
- "Calculate pricing for bulk order of 1000 units"
- "What's our revenue trend for the quarter?"
- "Generate a report of pending deliveries"

## Security and Compliance

### Authentication
- All tools require valid JWT authentication
- Automatic tenant isolation prevents cross-tenant access
- Service role tokens for AI agent access

### Audit Trail
- All AI agent actions are logged
- User attribution through JWT tokens
- Complete operation history maintained

### Data Protection
- No sensitive data exposed in tool responses
- Customer data only accessible with proper permissions
- Rate limiting prevents abuse

## Advanced Use Cases

### Automated Workflows
```
"Every day at 9 AM, show me:
1. Orders scheduled for delivery today
2. Low stock alerts
3. Customers with overdue payments"
```

### Complex Operations
```
"Create an order for customer ABC with:
- 50 units of LPG-100
- 25 units of LPG-200
- Delivery next Friday
- Apply bulk discount
- Schedule delivery truck"
```

### Multi-step Processes
```
"Process all confirmed orders:
1. Reserve inventory
2. Generate delivery routes
3. Send confirmation emails
4. Update tracking systems"
```

## Benefits for Your Business

### Efficiency Gains
- **Hands-free operation** during busy periods
- **Faster order processing** with voice commands
- **Reduced training time** for new staff
- **24/7 availability** for basic operations

### Accuracy Improvements
- **Automatic validation** prevents errors
- **Consistent processes** every time
- **Real-time inventory updates**
- **Audit trail** for all changes

### Customer Service Enhancement
- **Instant order status** lookups
- **Quick customer history** access
- **Automated problem resolution**
- **Faster response times**

## Future Enhancements

The MCP integration provides a foundation for:

- **Advanced AI assistants** with domain expertise
- **Automated business processes** and workflows
- **Intelligent reporting** and analytics
- **Integration with IoT devices** and sensors
- **Voice-controlled warehouse operations**

Your Order Management System is now **voice agent ready** and prepared for the future of AI-assisted business operations!