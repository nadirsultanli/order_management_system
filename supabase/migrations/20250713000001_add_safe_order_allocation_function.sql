-- Add safe order allocation function to prevent race conditions
-- This function ensures atomic order allocation with proper validation

CREATE OR REPLACE FUNCTION allocate_orders_to_trip_safe(
  p_trip_id UUID,
  p_order_ids UUID[],
  p_allocated_by_user_id UUID
) RETURNS SETOF truck_allocations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_existing_allocation truck_allocations;
  v_allocation truck_allocations;
  v_result truck_allocations[];
BEGIN
  -- Lock the truck_allocations table to prevent concurrent modifications
  LOCK TABLE truck_allocations IN SHARE ROW EXCLUSIVE MODE;
  
  -- Check for existing allocations that would conflict
  FOR v_order_id IN SELECT UNNEST(p_order_ids)
  LOOP
    SELECT * INTO v_existing_allocation
    FROM truck_allocations 
    WHERE order_id = v_order_id AND trip_id != p_trip_id;
    
    IF FOUND THEN
      RAISE EXCEPTION 'Order % is already allocated to trip %', v_order_id, v_existing_allocation.trip_id;
    END IF;
  END LOOP;
  
  -- All validations passed, proceed with allocations
  FOR v_order_id IN SELECT UNNEST(p_order_ids)
  LOOP
    INSERT INTO truck_allocations (
      trip_id,
      order_id,
      allocated_by_user_id,
      allocated_at,
      stop_sequence,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_trip_id,
      v_order_id,
      p_allocated_by_user_id,
      now(),
      -- Auto-assign stop sequence based on existing allocations
      COALESCE((SELECT MAX(stop_sequence) FROM truck_allocations WHERE trip_id = p_trip_id), 0) + 1,
      'planned',
      now(),
      now()
    )
    ON CONFLICT (trip_id, order_id) 
    DO UPDATE SET
      allocated_by_user_id = EXCLUDED.allocated_by_user_id,
      allocated_at = EXCLUDED.allocated_at,
      updated_at = now()
    RETURNING * INTO v_allocation;
    
    v_result := array_append(v_result, v_allocation);
    RETURN NEXT v_allocation;
  END LOOP;
  
  RETURN;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION allocate_orders_to_trip_safe(UUID, UUID[], UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION allocate_orders_to_trip_safe(UUID, UUID[], UUID) IS 
'Safely allocates multiple orders to a trip with proper validation and locking to prevent race conditions';