/**
 * Model Context Protocol (MCP) Server Implementation
 * 
 * This server exposes the Order Management System APIs as MCP tools
 * for seamless integration with Claude, ChatGPT, and other AI agents.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { createContext } from '../lib/context';
import { appRouter } from '../routes';
import { logger } from '../lib/logger';

// Load the tools manifest
import toolsManifest from './tools-manifest.json';

class OrderManagementMCPServer {
  private server: Server;
  private caller: any;

  constructor() {
    this.server = new Server(
      {
        name: 'order-management-system',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolsManifest.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Find the tool in our manifest
        const tool = toolsManifest.tools.find(t => t.name === name);
        if (!tool) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool ${name} not found`
          );
        }

        // Validate arguments against the tool's input schema
        const validatedArgs = this.validateArguments(args, tool.inputSchema);

        // Execute the tool
        const result = await this.executeTool(name, validatedArgs);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(`MCP tool execution failed:`, { name, args, error });

        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private validateArguments(args: any, schema: any): any {
    try {
      // Convert JSON schema to Zod schema for validation
      // This is a simplified validation - in production you'd want more robust conversion
      return args; // For now, we'll rely on tRPC's validation
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid arguments: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async executeTool(toolName: string, args: any): Promise<any> {
    // Create a mock context for the tool execution
    // In a real implementation, you'd extract auth from the MCP session
    const mockContext = await createContext({
      req: {
        headers: {
          authorization: process.env.MCP_AUTH_TOKEN ? `Bearer ${process.env.MCP_AUTH_TOKEN}` : undefined,
        },
      } as any,
      res: {} as any,
    });

    // Create tRPC caller
    if (!this.caller) {
      this.caller = appRouter.createCaller(mockContext);
    }

    // Map tool names to tRPC procedure calls
    switch (toolName) {
      case 'list_orders':
        return await this.caller.orders.list(args);

      case 'get_order':
        return await this.caller.orders.getById(args);

      case 'create_order':
        return await this.caller.orders.create(args);

      case 'update_order_status':
        return await this.caller.orders.updateStatus(args);

      case 'calculate_order_total':
        return await this.caller.orders.calculateTotal(args);

      case 'list_customers':
        return await this.caller.customers.list(args);

      case 'get_customer':
        return await this.caller.customers.getById(args);

      case 'get_customer_order_history':
        return await this.caller.customers.getOrderHistory(args);

      case 'list_inventory':
        return await this.caller.inventory.list(args);

      case 'adjust_inventory':
        return await this.caller.inventory.adjustStock(args);

      case 'transfer_inventory':
        return await this.caller.inventory.transferStock(args);

      case 'calculate_pricing':
        return await this.caller.pricing.calculate(args);

      case 'validate_transfer':
        return await this.caller.transfers.validate(args);

      case 'get_dashboard_stats':
        return await this.caller.analytics.getDashboardStats(args);

      case 'health_check':
        return await this.caller.admin.healthCheck(args);

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool ${toolName} not implemented`
        );
    }
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      logger.error('MCP Server error:', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Order Management MCP Server started');
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new OrderManagementMCPServer();
  server.start().catch((error) => {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

export { OrderManagementMCPServer };