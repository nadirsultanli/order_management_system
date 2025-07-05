#!/usr/bin/env node

/**
 * Script to remove tenant references from backend code
 * This will help fix the multi-tenancy removal issues
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to replace
const replacements = [
  // Remove requireTenantAccess and replace with requireAuth
  {
    pattern: /const user = requireTenantAccess\(ctx\);/g,
    replacement: 'const user = requireAuth(ctx);'
  },
  
  // Remove tenant_id from queries - simple cases
  {
    pattern: /\.eq\(['"]tenant_id['"], user\.tenant_id\)/g,
    replacement: ''
  },
  
  // Remove tenant_id from RPC calls
  {
    pattern: /p_tenant_id: user\.tenant_id,?\s*/g,
    replacement: ''
  },
  
  // Remove hardcoded tenant_id
  {
    pattern: /p_tenant_id: ['"]00000000-0000-0000-0000-000000000001['"],?\s*/g,
    replacement: ''
  },
  
  // Remove tenant_id field from inserts
  {
    pattern: /tenant_id: user\.tenant_id,?\s*/g,
    replacement: ''
  },
  
  // Remove tenant_id: tenantId patterns
  {
    pattern: /tenant_id: tenantId,?\s*/g,
    replacement: ''
  },
  
  // Fix imports - remove requireTenantAccess if only requireAuth is needed
  {
    pattern: /import { requireTenantAccess } from '\.\.\/lib\/auth';/g,
    replacement: "import { requireAuth } from '../lib/auth';"
  },
  
  // Remove standalone .tenant_id references
  {
    pattern: /\.tenant_id/g,
    replacement: '.id',
    checkContext: true
  }
];

// Files to process
const routeFiles = glob.sync('backend/src/routes/**/*.ts');
const libFiles = glob.sync('backend/src/lib/**/*.ts');
const allFiles = [...routeFiles, ...libFiles];

console.log(`Found ${allFiles.length} files to process`);

let totalReplacements = 0;

allFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let fileReplacements = 0;
  let modified = false;
  
  replacements.forEach(({ pattern, replacement, checkContext }) => {
    if (checkContext) {
      // For context-sensitive replacements, we need to be more careful
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Only replace if it's likely a user.tenant_id reference
          if (content.includes(`user${match}`)) {
            content = content.replace(`user${match}`, `user.id`);
            fileReplacements++;
            modified = true;
          }
        });
      }
    } else {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        fileReplacements++;
        modified = true;
      }
    }
  });
  
  // Special handling for removing empty .eq() calls that might be left
  content = content.replace(/\.eq\(\)\s*\n/g, '\n');
  
  // Remove trailing commas in objects/arrays that might be left
  content = content.replace(/,(\s*[}\]])/g, '$1');
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed ${fileReplacements} issues in ${path.basename(filePath)}`);
    totalReplacements += fileReplacements;
  }
});

console.log(`\nTotal replacements made: ${totalReplacements}`);

// Now fix specific function calls that need manual attention
const orderFile = 'backend/src/routes/orders.ts';
if (fs.existsSync(orderFile)) {
  let orderContent = fs.readFileSync(orderFile, 'utf8');
  
  // Fix reserve_stock calls - remove third parameter
  orderContent = orderContent.replace(
    /await ctx\.supabase\.rpc\('reserve_stock', {\s*p_product_id: ([^,]+),\s*p_quantity: ([^,]+),\s*[^}]+}\)/g,
    'await ctx.supabase.rpc(\'reserve_stock\', {\n              p_product_id: $1,\n              p_quantity: $2\n            })'
  );
  
  // Fix fulfill_order_line calls
  orderContent = orderContent.replace(
    /await ctx\.supabase\.rpc\('fulfill_order_line', {\s*p_product_id: ([^,]+),\s*p_quantity: ([^,]+),\s*[^}]+}\)/g,
    'await ctx.supabase.rpc(\'fulfill_order_line\', {\n              p_product_id: $1,\n              p_quantity: $2\n            })'
  );
  
  // Fix release_reserved_stock calls
  orderContent = orderContent.replace(
    /await ctx\.supabase\.rpc\('release_reserved_stock', {\s*p_product_id: ([^,]+),\s*p_quantity: ([^,]+),\s*[^}]+}\)/g,
    'await ctx.supabase.rpc(\'release_reserved_stock\', {\n              p_product_id: $1,\n              p_quantity: $2\n            })'
  );
  
  fs.writeFileSync(orderFile, orderContent);
  console.log('✓ Fixed RPC calls in orders.ts');
}

console.log('\nDone! Please review the changes and test thoroughly.');
console.log('\nNext steps:');
console.log('1. Run: npm install --prefix backend');
console.log('2. Run: npm run build --prefix backend');
console.log('3. Test all API endpoints');
console.log('4. Apply database migrations');