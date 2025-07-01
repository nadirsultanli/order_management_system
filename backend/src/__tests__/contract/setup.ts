/**
 * Contract Test Setup
 * Sets up test environment for comprehensive API contract testing
 */

import { supabaseAdmin } from '../../lib/supabase';
import { logger } from '../../lib/logger';

export interface TestTenant {
  id: string;
  name: string;
  auth_token: string;
}

export interface TestUser {
  id: string;
  email: string;
  tenant_id: string;
  role: string;
  auth_token: string;
}

export interface TestData {
  tenants: TestTenant[];
  users: TestUser[];
  customers: any[];
  products: any[];
  warehouses: any[];
}

export class ContractTestSetup {
  public testData: TestData = {
    tenants: [],
    users: [],
    customers: [],
    products: [],
    warehouses: []
  };

  async setupTestEnvironment(): Promise<TestData> {
    logger.info('Setting up contract test environment');

    try {
      // Create test tenants
      await this.createTestTenants();
      
      // Create test users for each tenant
      await this.createTestUsers();
      
      // Create test data for each tenant
      await this.createTestCustomers();
      await this.createTestProducts();
      await this.createTestWarehouses();
      await this.createTestInventory();

      logger.info('Contract test environment setup complete');
      return this.testData;
      
    } catch (error) {
      logger.error('Failed to setup contract test environment:', error);
      throw error;
    }
  }

  async cleanupTestEnvironment(): Promise<void> {
    logger.info('Cleaning up contract test environment');
    
    try {
      // Delete test data in reverse order to handle foreign key constraints
      await this.deleteTestInventory();
      await this.deleteTestWarehouses();
      await this.deleteTestProducts();
      await this.deleteTestCustomers();
      await this.deleteTestUsers();
      await this.deleteTestTenants();
      
      logger.info('Contract test environment cleanup complete');
      
    } catch (error) {
      logger.error('Failed to cleanup contract test environment:', error);
      // Don't throw - we want cleanup to be best effort
    }
  }

  private async createTestTenants(): Promise<void> {
    const tenants = [
      { id: '11111111-1111-1111-1111-111111111111', name: 'Test Tenant A' },
      { id: '22222222-2222-2222-2222-222222222222', name: 'Test Tenant B' }
    ];

    for (const tenant of tenants) {
      // Insert tenant record if it doesn't exist
      const { error } = await supabaseAdmin
        .from('tenants')
        .upsert(tenant, { onConflict: 'id' });
        
      if (error && !error.message.includes('duplicate key')) {
        throw error;
      }

      this.testData.tenants.push({
        ...tenant,
        auth_token: this.generateMockJWT(tenant.id, 'admin')
      });
    }
  }

  private async createTestUsers(): Promise<void> {
    const users = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        email: 'tenant-a-admin@test.com',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        role: 'admin'
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        email: 'tenant-a-user@test.com', 
        tenant_id: '11111111-1111-1111-1111-111111111111',
        role: 'user'
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        email: 'tenant-b-admin@test.com',
        tenant_id: '22222222-2222-2222-2222-222222222222',
        role: 'admin'
      }
    ];

    for (const user of users) {
      this.testData.users.push({
        ...user,
        auth_token: this.generateMockJWT(user.tenant_id, user.role, user.id)
      });
    }
  }

  private async createTestCustomers(): Promise<void> {
    const customers = [
      {
        id: 'c1111111-1111-1111-1111-111111111111',
        name: 'Customer A1',
        email: 'customer-a1@test.com',
        tenant_id: '11111111-1111-1111-1111-111111111111'
      },
      {
        id: 'c2222222-2222-2222-2222-222222222222',
        name: 'Customer A2',
        email: 'customer-a2@test.com',
        tenant_id: '11111111-1111-1111-1111-111111111111'
      },
      {
        id: 'c3333333-3333-3333-3333-333333333333',
        name: 'Customer B1',
        email: 'customer-b1@test.com',
        tenant_id: '22222222-2222-2222-2222-222222222222'
      }
    ];

    const { error } = await supabaseAdmin
      .from('customers')
      .upsert(customers, { onConflict: 'id' });
      
    if (error && !error.message.includes('duplicate key')) {
      throw error;
    }

    this.testData.customers = customers;
  }

  private async createTestProducts(): Promise<void> {
    const products = [
      {
        id: 'p1111111-1111-1111-1111-111111111111',
        sku: 'LPG-100-A',
        name: 'LPG Tank 100L - Tenant A',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        is_active: true
      },
      {
        id: 'p2222222-2222-2222-2222-222222222222',
        sku: 'LPG-200-A',
        name: 'LPG Tank 200L - Tenant A',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        is_active: true
      },
      {
        id: 'p3333333-3333-3333-3333-333333333333',
        sku: 'LPG-100-B',
        name: 'LPG Tank 100L - Tenant B',
        tenant_id: '22222222-2222-2222-2222-222222222222',
        is_active: true
      }
    ];

    const { error } = await supabaseAdmin
      .from('products')
      .upsert(products, { onConflict: 'id' });
      
    if (error && !error.message.includes('duplicate key')) {
      throw error;
    }

    this.testData.products = products;
  }

  private async createTestWarehouses(): Promise<void> {
    const warehouses = [
      {
        id: 'w1111111-1111-1111-1111-111111111111',
        name: 'Main Warehouse A',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        is_active: true
      },
      {
        id: 'w2222222-2222-2222-2222-222222222222',
        name: 'Secondary Warehouse A',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        is_active: true
      },
      {
        id: 'w3333333-3333-3333-3333-333333333333',
        name: 'Main Warehouse B',
        tenant_id: '22222222-2222-2222-2222-222222222222',
        is_active: true
      }
    ];

    const { error } = await supabaseAdmin
      .from('warehouses')
      .upsert(warehouses, { onConflict: 'id' });
      
    if (error && !error.message.includes('duplicate key')) {
      throw error;
    }

    this.testData.warehouses = warehouses;
  }

  private async createTestInventory(): Promise<void> {
    const inventory = [
      {
        id: 'i1111111-1111-1111-1111-111111111111',
        product_id: 'p1111111-1111-1111-1111-111111111111',
        warehouse_id: 'w1111111-1111-1111-1111-111111111111',
        available_quantity: 100,
        reserved_quantity: 0,
        tenant_id: '11111111-1111-1111-1111-111111111111'
      },
      {
        id: 'i2222222-2222-2222-2222-222222222222',
        product_id: 'p2222222-2222-2222-2222-222222222222',
        warehouse_id: 'w1111111-1111-1111-1111-111111111111',
        available_quantity: 50,
        reserved_quantity: 10,
        tenant_id: '11111111-1111-1111-1111-111111111111'
      },
      {
        id: 'i3333333-3333-3333-3333-333333333333',
        product_id: 'p3333333-3333-3333-3333-333333333333',
        warehouse_id: 'w3333333-3333-3333-3333-333333333333',
        available_quantity: 75,
        reserved_quantity: 5,
        tenant_id: '22222222-2222-2222-2222-222222222222'
      }
    ];

    const { error } = await supabaseAdmin
      .from('inventory')
      .upsert(inventory, { onConflict: 'id' });
      
    if (error && !error.message.includes('duplicate key')) {
      throw error;
    }
  }

  // Cleanup methods
  private async deleteTestInventory(): Promise<void> {
    await supabaseAdmin
      .from('inventory')
      .delete()
      .in('tenant_id', ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']);
  }

  private async deleteTestWarehouses(): Promise<void> {
    await supabaseAdmin
      .from('warehouses')
      .delete()
      .in('tenant_id', ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']);
  }

  private async deleteTestProducts(): Promise<void> {
    await supabaseAdmin
      .from('products')
      .delete()
      .in('tenant_id', ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']);
  }

  private async deleteTestCustomers(): Promise<void> {
    await supabaseAdmin
      .from('customers')
      .delete()
      .in('tenant_id', ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']);
  }

  private async deleteTestUsers(): Promise<void> {
    // Users are handled by Supabase Auth - we don't need to delete them for tests
  }

  private async deleteTestTenants(): Promise<void> {
    await supabaseAdmin
      .from('tenants')
      .delete()
      .in('id', ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']);
  }

  private generateMockJWT(tenantId: string, role: string, userId?: string): string {
    // In a real implementation, you'd generate actual JWTs
    // For testing, we'll create a mock token structure
    const payload = {
      sub: userId || `user-${tenantId}`,
      tenant_id: tenantId,
      role: role,
      email: `test-${role}@tenant-${tenantId}.com`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };
    
    // This is a mock - in real tests you'd use jsonwebtoken.sign()
    return `mock.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
  }
}