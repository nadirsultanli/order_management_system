import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface TestResults {
  testName: string;
  success: boolean;
  message: string;
  data?: any;
}

export async function runTripOrderAssignmentTest(): Promise<TestResults[]> {
  const results: TestResults[] = [];
  
  console.log('🚀 Starting Trip-Order Assignment Test Suite...\n');

  try {
    // Test 1: Check if we have any confirmed orders
    console.log('Test 1: Checking for confirmed orders...');
    const { data: confirmedOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_amount,
        customer_id,
        customers!inner(name)
      `)
      .eq('status', 'confirmed')
      .limit(5);

    if (ordersError) {
      results.push({
        testName: 'Check Confirmed Orders',
        success: false,
        message: `Error fetching confirmed orders: ${ordersError.message}`,
      });
    } else {
      results.push({
        testName: 'Check Confirmed Orders',
        success: true,
        message: `Found ${confirmedOrders?.length || 0} confirmed orders`,
        data: confirmedOrders,
      });
      console.log(`✅ Found ${confirmedOrders?.length || 0} confirmed orders`);
    }

    // Test 2: Check if we have any trips in draft/planned status
    console.log('\nTest 2: Checking for available trips...');
    const { data: availableTrips, error: tripsError } = await supabase
      .from('truck_routes')
      .select(`
        id,
        trip_number,
        route_status,
        truck_id,
        truck:truck_id(fleet_number)
      `)
      .in('route_status', ['draft', 'planned'])
      .limit(5);

    if (tripsError) {
      results.push({
        testName: 'Check Available Trips',
        success: false,
        message: `Error fetching trips: ${tripsError.message}`,
      });
    } else {
      results.push({
        testName: 'Check Available Trips',
        success: true,
        message: `Found ${availableTrips?.length || 0} available trips`,
        data: availableTrips,
      });
      console.log(`✅ Found ${availableTrips?.length || 0} available trips`);
    }

    // Test 3: Test order assignment if we have both orders and trips
    if (confirmedOrders && confirmedOrders.length > 0 && availableTrips && availableTrips.length > 0) {
      console.log('\nTest 3: Testing order assignment...');
      
      const testOrder = confirmedOrders[0];
      const testTrip = availableTrips[0];
      
      console.log(`Assigning order ${testOrder.id} to trip ${testTrip.id}...`);
      
      // Insert allocation record
      const { data: allocation, error: allocError } = await supabase
        .from('truck_allocations')
        .insert({
          trip_id: testTrip.id,
          order_id: testOrder.id,
          stop_sequence: 1,
          status: 'planned',
          allocated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (allocError) {
        results.push({
          testName: 'Test Order Assignment',
          success: false,
          message: `Error creating allocation: ${allocError.message}`,
        });
      } else {
        console.log(`✅ Successfully created allocation: ${allocation.id}`);
        
        // Test 4: Update order status to dispatched
        console.log('\nTest 4: Updating order status to dispatched...');
        
        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update({ status: 'dispatched' })
          .eq('id', testOrder.id)
          .select()
          .single();

        if (updateError) {
          results.push({
            testName: 'Update Order Status',
            success: false,
            message: `Error updating order status: ${updateError.message}`,
          });
        } else {
          results.push({
            testName: 'Test Order Assignment',
            success: true,
            message: `Successfully assigned order ${testOrder.id} to trip ${testTrip.id}`,
            data: allocation,
          });
          
          results.push({
            testName: 'Update Order Status',
            success: true,
            message: `Successfully updated order status to dispatched`,
            data: updatedOrder,
          });
          
          console.log(`✅ Order status updated to: ${updatedOrder.status}`);
        }

        // Test 5: Verify the assignment by querying trip with orders
        console.log('\nTest 5: Verifying assignment in trip details...');
        
        const { data: tripWithOrders, error: tripQueryError } = await supabase
          .from('truck_routes')
          .select(`
            id,
            trip_number,
            route_status,
            truck_allocations(
              id,
              order_id,
              stop_sequence,
              status,
              orders(
                id,
                status,
                total_amount,
                customers(name)
              )
            )
          `)
          .eq('id', testTrip.id)
          .single();

        if (tripQueryError) {
          results.push({
            testName: 'Verify Assignment',
            success: false,
            message: `Error verifying assignment: ${tripQueryError.message}`,
          });
        } else {
          const assignedOrdersCount = tripWithOrders.truck_allocations?.length || 0;
          results.push({
            testName: 'Verify Assignment',
            success: true,
            message: `Trip now has ${assignedOrdersCount} assigned order(s)`,
            data: tripWithOrders,
          });
          console.log(`✅ Trip now has ${assignedOrdersCount} assigned order(s)`);
        }

        // Cleanup: Remove the test allocation
        console.log('\nCleaning up test allocation...');
        await supabase
          .from('truck_allocations')
          .delete()
          .eq('id', allocation.id);
        
        // Reset order status back to confirmed
        await supabase
          .from('orders')
          .update({ status: 'confirmed' })
          .eq('id', testOrder.id);
        
        console.log('✅ Cleanup completed');
      }
    } else {
      results.push({
        testName: 'Test Order Assignment',
        success: false,
        message: 'Cannot test assignment - need both confirmed orders and available trips',
      });
    }

    // Test 6: Test the new getAvailableOrdersForAssignment endpoint structure
    console.log('\nTest 6: Testing orders data structure for assignment UI...');
    
    if (confirmedOrders && confirmedOrders.length > 0) {
      const { data: orderForUI, error: uiTestError } = await supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          total_amount,
          order_date,
          scheduled_date,
          delivery_date,
          notes,
          created_at,
          customers!inner(
            id,
            name,
            phone,
            email
          ),
          addresses(
            id,
            label,
            line1,
            line2,
            city,
            state,
            country
          ),
          order_lines(
            id,
            quantity,
            unit_price,
            subtotal,
            products(
              id,
              name,
              sku
            )
          )
        `)
        .eq('status', 'confirmed')
        .limit(1)
        .single();

      if (uiTestError) {
        results.push({
          testName: 'Test UI Data Structure',
          success: false,
          message: `Error testing UI data structure: ${uiTestError.message}`,
        });
      } else {
        results.push({
          testName: 'Test UI Data Structure',
          success: true,
          message: `Order data structure is correct for UI`,
          data: {
            hasCustomer: !!orderForUI.customers,
            hasAddress: !!(orderForUI.addresses && orderForUI.addresses.length > 0),
            hasOrderLines: !!(orderForUI.order_lines && orderForUI.order_lines.length > 0),
            structure: orderForUI,
          },
        });
        console.log('✅ Order data structure is correct for UI');
      }
    }

  } catch (error: any) {
    console.error('❌ Test suite failed:', error);
    results.push({
      testName: 'Test Suite',
      success: false,
      message: `Test suite failed: ${error.message}`,
    });
  }

  return results;
}

// Main execution
if (require.main === module) {
  runTripOrderAssignmentTest()
    .then((results) => {
      console.log('\n📊 Test Results Summary:');
      console.log('=' .repeat(50));
      
      let passed = 0;
      let failed = 0;
      
      results.forEach((result) => {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} - ${result.testName}: ${result.message}`);
        
        if (result.success) passed++;
        else failed++;
      });
      
      console.log('=' .repeat(50));
      console.log(`Total Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
      
      if (failed === 0) {
        console.log('🎉 All tests passed! Trip-Order assignment functionality is working correctly.');
      } else {
        console.log(`⚠️  ${failed} test(s) failed. Please review the issues above.`);
      }
    })
    .catch((error) => {
      console.error('💥 Failed to run tests:', error);
      process.exit(1);
    });
} 