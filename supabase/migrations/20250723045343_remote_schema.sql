

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE OR REPLACE FUNCTION "public"."availability_belongs_to_business_provider"("slot_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if availability slot belongs to a provider in current user's business
  RETURN EXISTS (
    SELECT 1 FROM "availabilitySlots" a
    JOIN users u ON a."providerId" = u.id
    WHERE a.id = slot_id 
    AND u."businessId" = get_my_business_id()
  );
END;
$$;


ALTER FUNCTION "public"."availability_belongs_to_business_provider"("slot_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."booking_belongs_to_provider"("booking_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if current user is the provider assigned to this booking
  RETURN EXISTS (
    SELECT 1 FROM bookings 
    WHERE id = booking_id AND "providerId" = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."booking_belongs_to_provider"("booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_complete_goal_and_set_new"("p_context_id" "uuid", "p_new_current_goal" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_goal JSONB;
  v_updated_rows INTEGER;
BEGIN
  -- Validation
  IF p_context_id IS NULL THEN
    RAISE EXCEPTION 'Context ID cannot be null';
  END IF;

  -- Get current goal to move to previous
  SELECT "currentGoal" INTO v_current_goal 
  FROM "userContexts" 
  WHERE id = p_context_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User context not found: %', p_context_id;
  END IF;

  -- Update: move current to previous, set new current
  UPDATE "userContexts" 
  SET 
    "previousGoal" = v_current_goal,
    "currentGoal" = p_new_current_goal,
    "updatedAt" = NOW()
  WHERE id = p_context_id;
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  
  RAISE LOG 'Bot completed goal and set new goal for context: %', p_context_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."bot_complete_goal_and_set_new"("p_context_id" "uuid", "p_new_current_goal" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_create_escalation_notification"("p_business_id" "uuid", "p_chat_session_id" "uuid", "p_message" "text", "p_escalation_reason" "text" DEFAULT 'user_request'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_notification_id UUID;
  v_business_exists BOOLEAN;
  v_session_exists BOOLEAN;
BEGIN
  -- Validations
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'Business ID cannot be null';
  END IF;
  
  IF p_chat_session_id IS NULL THEN
    RAISE EXCEPTION 'Chat session ID cannot be null';
  END IF;
  
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  -- Validate business exists
  SELECT EXISTS(SELECT 1 FROM businesses WHERE id = p_business_id) INTO v_business_exists;
  IF NOT v_business_exists THEN
    RAISE EXCEPTION 'Business ID does not exist: %', p_business_id;
  END IF;

  -- Validate chat session exists and belongs to business
  SELECT EXISTS(
    SELECT 1 FROM "chatSessions" 
    WHERE id = p_chat_session_id 
    AND "businessId" = p_business_id
  ) INTO v_session_exists;
  
  IF NOT v_session_exists THEN
    RAISE EXCEPTION 'Chat session does not exist or does not belong to this business: %', p_chat_session_id;
  END IF;

  -- Check if there's already a pending notification for this session
  IF EXISTS(
    SELECT 1 FROM notifications 
    WHERE "chatSessionId" = p_chat_session_id 
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'There is already a pending notification for this chat session: %', p_chat_session_id;
  END IF;

  -- Insert escalation notification
  INSERT INTO notifications (
    "businessId",
    "chatSessionId", 
    message,
    status,
    "userId", -- Can be NULL for guest escalations
    "createdAt"
  ) VALUES (
    p_business_id,
    p_chat_session_id,
    format('ESCALATION [%s]: %s', p_escalation_reason, p_message),
    'pending',
    NULL, -- Escalations are business-level, not user-specific
    NOW()
  ) RETURNING id INTO v_notification_id;
  
  RAISE LOG 'Bot created escalation notification: % for session: %, business: %, reason: %', 
    v_notification_id, p_chat_session_id, p_business_id, p_escalation_reason;
  
  RETURN v_notification_id;
END;
$$;


ALTER FUNCTION "public"."bot_create_escalation_notification"("p_business_id" "uuid", "p_chat_session_id" "uuid", "p_message" "text", "p_escalation_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_create_guest_chat_session"("p_channel" "text", "p_channel_user_id" "text", "p_business_id" "uuid", "p_initial_messages" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_session_id UUID;
  v_business_exists BOOLEAN;
BEGIN
  -- Validations
  IF p_channel IS NULL OR trim(p_channel) = '' THEN
    RAISE EXCEPTION 'Channel cannot be empty';
  END IF;
  
  IF p_channel_user_id IS NULL OR trim(p_channel_user_id) = '' THEN
    RAISE EXCEPTION 'Channel user ID cannot be empty';
  END IF;
  
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'Business ID cannot be null';
  END IF;

  -- Validate business exists
  SELECT EXISTS(SELECT 1 FROM businesses WHERE id = p_business_id) INTO v_business_exists;
  IF NOT v_business_exists THEN
    RAISE EXCEPTION 'Business ID does not exist: %', p_business_id;
  END IF;

  -- Insert new chat session
  INSERT INTO "chatSessions" (
    "businessId",
    channel,
    "channelUserId",
    "allMessages",
    "userId",
    "createdAt",
    "updatedAt"
  ) VALUES (
    p_business_id,
    p_channel,
    p_channel_user_id,
    p_initial_messages,
    NULL, -- Guest session (no userId)
    NOW(),
    NOW()
  ) RETURNING id INTO v_session_id;
  
  RAISE LOG 'Bot created guest chat session: % for channel user: %, business: %', 
    v_session_id, p_channel_user_id, p_business_id;
  
  RETURN v_session_id;
END;
$$;


ALTER FUNCTION "public"."bot_create_guest_chat_session"("p_channel" "text", "p_channel_user_id" "text", "p_business_id" "uuid", "p_initial_messages" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_create_quote"("p_user_id" "uuid", "p_business_id" "uuid", "p_service_id" "uuid" DEFAULT NULL::"uuid", "p_pickup" "text" DEFAULT NULL::"text", "p_dropoff" "text" DEFAULT NULL::"text", "p_proposed_datetime" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_initial_cost_estimate" integer DEFAULT NULL::integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_quote_id UUID;
  v_business_exists BOOLEAN;
  v_user_exists BOOLEAN;
  v_service_exists BOOLEAN;
BEGIN
  -- Validations
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'Business ID cannot be null';
  END IF;

  -- Validate business exists
  SELECT EXISTS(SELECT 1 FROM businesses WHERE id = p_business_id) INTO v_business_exists;
  IF NOT v_business_exists THEN
    RAISE EXCEPTION 'Business ID does not exist: %', p_business_id;
  END IF;

  -- Validate user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User ID does not exist: %', p_user_id;
  END IF;

  -- Validate service exists if provided
  IF p_service_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM services WHERE id = p_service_id AND "businessId" = p_business_id) INTO v_service_exists;
    IF NOT v_service_exists THEN
      RAISE EXCEPTION 'Service ID does not exist in this business: %', p_service_id;
    END IF;
  END IF;

  -- Insert quote
  INSERT INTO quotes (
    "userId", 
    "businessId", 
    "serviceId",
    "pickUp", 
    "dropOff", 
    "proposedDateTime", 
    "totalJobCostEstimation",
    status,
    "createdAt",
    "updatedAt"
  )
  VALUES (
    p_user_id, 
    p_business_id, 
    p_service_id,
    p_pickup, 
    p_dropoff, 
    p_proposed_datetime,
    p_initial_cost_estimate,
    'Pending',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_quote_id;
  
  RAISE LOG 'Bot created quote: % for user: %, business: %', v_quote_id, p_user_id, p_business_id;
  
  RETURN v_quote_id;
END;
$$;


ALTER FUNCTION "public"."bot_create_quote"("p_user_id" "uuid", "p_business_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone, "p_initial_cost_estimate" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_create_user_context"("p_channel_user_id" "text", "p_business_id" "uuid" DEFAULT NULL::"uuid", "p_current_goal" "jsonb" DEFAULT NULL::"jsonb", "p_participant_preferences" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_context_id UUID;
  v_business_exists BOOLEAN := TRUE;
BEGIN
  -- Validations
  IF p_channel_user_id IS NULL OR trim(p_channel_user_id) = '' THEN
    RAISE EXCEPTION 'Channel user ID cannot be empty';
  END IF;

  -- Validate business exists if provided
  IF p_business_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM businesses WHERE id = p_business_id) INTO v_business_exists;
    IF NOT v_business_exists THEN
      RAISE EXCEPTION 'Business ID does not exist: %', p_business_id;
    END IF;
  END IF;

  -- Generate new ID
  v_context_id := gen_random_uuid();
  
  -- Insert new context
  INSERT INTO "userContexts" (
    id,
    "channelUserId",
    "businessId",
    "currentGoal",
    "participantPreferences",
    "createdAt",
    "updatedAt"
  ) VALUES (
    v_context_id,
    p_channel_user_id,
    p_business_id,
    p_current_goal,
    COALESCE(p_participant_preferences, '{"language": "en", "timezone": "UTC"}'::jsonb),
    NOW(),
    NOW()
  );
  
  RAISE LOG 'Bot created user context: % for channel user: %, business: %', 
    v_context_id, p_channel_user_id, p_business_id;
  
  RETURN v_context_id;
END;
$$;


ALTER FUNCTION "public"."bot_create_user_context"("p_channel_user_id" "text", "p_business_id" "uuid", "p_current_goal" "jsonb", "p_participant_preferences" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_end_chat_session"("p_session_id" "uuid", "p_summary_session" "text" DEFAULT NULL::"text", "p_final_intent" "text" DEFAULT 'completed'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated_rows INTEGER;
BEGIN
  -- Validation
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session ID cannot be null';
  END IF;

  -- End chat session
  UPDATE "chatSessions" 
  SET 
    "endedAt" = NOW(),
    "summarySession" = COALESCE(p_summary_session, "summarySession"),
    "sessionIntent" = COALESCE(p_final_intent, "sessionIntent"),
    "updatedAt" = NOW()
  WHERE id = p_session_id
  AND "endedAt" IS NULL; -- Only end if not already ended
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'Chat session not found or already ended: %', p_session_id;
  END IF;
  
  RAISE LOG 'Bot ended chat session: %', p_session_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."bot_end_chat_session"("p_session_id" "uuid", "p_summary_session" "text", "p_final_intent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_find_user_context"("p_channel_user_id" "text", "p_business_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "channelUserId" "text", "businessId" "uuid", "currentGoal" "jsonb", "previousGoal" "jsonb", "participantPreferences" "jsonb", "frequentlyDiscussedTopics" "text", "createdAt" timestamp with time zone, "updatedAt" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Validation
  IF p_channel_user_id IS NULL OR trim(p_channel_user_id) = '' THEN
    RAISE EXCEPTION 'Channel user ID cannot be empty';
  END IF;

  RAISE LOG 'Bot searching user context for channel user: %, business: %', p_channel_user_id, p_business_id;

  RETURN QUERY
  SELECT 
    uc.id,
    uc."channelUserId",
    uc."businessId",
    uc."currentGoal",
    uc."previousGoal",
    uc."participantPreferences",
    uc."frequentlyDiscussedTopics",
    uc."createdAt",
    uc."updatedAt"
  FROM "userContexts" uc
  WHERE uc."channelUserId" = p_channel_user_id
  AND (p_business_id IS NULL OR uc."businessId" = p_business_id)
  ORDER BY uc."updatedAt" DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."bot_find_user_context"("p_channel_user_id" "text", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_link_user_to_session"("p_session_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated_rows INTEGER;
  v_user_exists BOOLEAN;
BEGIN
  -- Validations
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session ID cannot be null';
  END IF;
  
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;

  -- Validate user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User ID does not exist: %', p_user_id;
  END IF;

  -- Link user to session (convert guest session to user session)
  UPDATE "chatSessions" 
  SET 
    "userId" = p_user_id,
    "updatedAt" = NOW()
  WHERE id = p_session_id
  AND "userId" IS NULL; -- Only link if it's currently a guest session
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'Guest session not found or already linked: %', p_session_id;
  END IF;
  
  RAISE LOG 'Bot linked user % to session: %', p_user_id, p_session_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."bot_link_user_to_session"("p_session_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_update_chat_session"("p_session_id" "uuid", "p_new_messages" "jsonb" DEFAULT NULL::"jsonb", "p_session_intent" "text" DEFAULT NULL::"text", "p_summary_session" "text" DEFAULT NULL::"text", "p_feedback_data" "jsonb" DEFAULT NULL::"jsonb", "p_overall_customer_satisfaction" numeric DEFAULT NULL::numeric) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated_rows INTEGER;
BEGIN
  -- Validation
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session ID cannot be null';
  END IF;

  -- Update chat session (only update fields that are provided)
  UPDATE "chatSessions" 
  SET 
    "allMessages" = CASE WHEN p_new_messages IS NOT NULL THEN p_new_messages ELSE "allMessages" END,
    "sessionIntent" = CASE WHEN p_session_intent IS NOT NULL THEN p_session_intent ELSE "sessionIntent" END,
    "summarySession" = CASE WHEN p_summary_session IS NOT NULL THEN p_summary_session ELSE "summarySession" END,
    "feedbackDataAveraged" = CASE WHEN p_feedback_data IS NOT NULL THEN p_feedback_data ELSE "feedbackDataAveraged" END,
    "overallCustomerSatisfaction" = CASE WHEN p_overall_customer_satisfaction IS NOT NULL THEN p_overall_customer_satisfaction ELSE "overallCustomerSatisfaction" END,
    "updatedAt" = NOW()
  WHERE id = p_session_id;
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'Chat session not found: %', p_session_id;
  END IF;
  
  RAISE LOG 'Bot updated chat session: %', p_session_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."bot_update_chat_session"("p_session_id" "uuid", "p_new_messages" "jsonb", "p_session_intent" "text", "p_summary_session" "text", "p_feedback_data" "jsonb", "p_overall_customer_satisfaction" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_update_notification_status"("p_notification_id" "uuid", "p_new_status" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated_rows INTEGER;
  v_valid_statuses TEXT[] := ARRAY['pending', 'read', 'resolved'];
BEGIN
  -- Validations
  IF p_notification_id IS NULL THEN
    RAISE EXCEPTION 'Notification ID cannot be null';
  END IF;
  
  IF p_new_status IS NULL OR trim(p_new_status) = '' THEN
    RAISE EXCEPTION 'Status cannot be empty';
  END IF;
  
  -- Validate status is allowed
  IF p_new_status != ALL(v_valid_statuses) THEN
    RAISE EXCEPTION 'Invalid status. Allowed values: %', array_to_string(v_valid_statuses, ', ');
  END IF;

  -- Update notification status
  UPDATE notifications 
  SET 
    status = p_new_status,
    "updatedAt" = NOW()
  WHERE id = p_notification_id;
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'Notification not found: %', p_notification_id;
  END IF;
  
  RAISE LOG 'Bot updated notification: % to status: %', p_notification_id, p_new_status;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."bot_update_notification_status"("p_notification_id" "uuid", "p_new_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_update_quote"("p_quote_id" "uuid", "p_service_id" "uuid" DEFAULT NULL::"uuid", "p_pickup" "text" DEFAULT NULL::"text", "p_dropoff" "text" DEFAULT NULL::"text", "p_proposed_datetime" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cost_estimate" integer DEFAULT NULL::integer, "p_travel_cost_estimate" integer DEFAULT NULL::integer, "p_status" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated_rows INTEGER;
  v_current_status TEXT;
BEGIN
  -- Validation
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'Quote ID cannot be null';
  END IF;

  -- Get current status to validate transitions
  SELECT status INTO v_current_status FROM quotes WHERE id = p_quote_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found: %', p_quote_id;
  END IF;

  -- Validate status transition (bot shouldn't change completed/cancelled quotes)
  IF v_current_status IN ('Completed', 'Cancelled') AND p_status IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify quote in final status: %', v_current_status;
  END IF;

  -- Update quote (only update fields that are provided)
  UPDATE quotes 
  SET 
    "serviceId" = CASE WHEN p_service_id IS NOT NULL THEN p_service_id ELSE "serviceId" END,
    "pickUp" = CASE WHEN p_pickup IS NOT NULL THEN p_pickup ELSE "pickUp" END,
    "dropOff" = CASE WHEN p_dropoff IS NOT NULL THEN p_dropoff ELSE "dropOff" END,
    "proposedDateTime" = CASE WHEN p_proposed_datetime IS NOT NULL THEN p_proposed_datetime ELSE "proposedDateTime" END,
    "totalJobCostEstimation" = CASE WHEN p_cost_estimate IS NOT NULL THEN p_cost_estimate ELSE "totalJobCostEstimation" END,
    "travelCostEstimate" = CASE WHEN p_travel_cost_estimate IS NOT NULL THEN p_travel_cost_estimate ELSE "travelCostEstimate" END,
    status = CASE WHEN p_status IS NOT NULL THEN p_status ELSE status END,
    "updatedAt" = NOW()
  WHERE id = p_quote_id;
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'Failed to update quote: %', p_quote_id;
  END IF;
  
  RAISE LOG 'Bot updated quote: %', p_quote_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."bot_update_quote"("p_quote_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone, "p_cost_estimate" integer, "p_travel_cost_estimate" integer, "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bot_update_user_context"("p_context_id" "uuid", "p_current_goal" "jsonb" DEFAULT NULL::"jsonb", "p_previous_goal" "jsonb" DEFAULT NULL::"jsonb", "p_participant_preferences" "jsonb" DEFAULT NULL::"jsonb", "p_frequently_discussed_topics" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated_rows INTEGER;
BEGIN
  -- Validation
  IF p_context_id IS NULL THEN
    RAISE EXCEPTION 'Context ID cannot be null';
  END IF;

  -- Update context (only update fields that are provided)
  UPDATE "userContexts" 
  SET 
    "currentGoal" = CASE WHEN p_current_goal IS NOT NULL THEN p_current_goal ELSE "currentGoal" END,
    "previousGoal" = CASE WHEN p_previous_goal IS NOT NULL THEN p_previous_goal ELSE "previousGoal" END,
    "participantPreferences" = CASE WHEN p_participant_preferences IS NOT NULL THEN p_participant_preferences ELSE "participantPreferences" END,
    "frequentlyDiscussedTopics" = CASE WHEN p_frequently_discussed_topics IS NOT NULL THEN p_frequently_discussed_topics ELSE "frequentlyDiscussedTopics" END,
    "updatedAt" = NOW()
  WHERE id = p_context_id;
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'User context not found: %', p_context_id;
  END IF;
  
  RAISE LOG 'Bot updated user context: %', p_context_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."bot_update_user_context"("p_context_id" "uuid", "p_current_goal" "jsonb", "p_previous_goal" "jsonb", "p_participant_preferences" "jsonb", "p_frequently_discussed_topics" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_rls_test_data"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    deleted_bookings INTEGER;
    deleted_quotes INTEGER;
    deleted_users INTEGER;
    deleted_businesses INTEGER;
BEGIN
    DELETE FROM bookings WHERE "userId" IN (
        SELECT id FROM users WHERE "firstName" = 'Test'
    );
    GET DIAGNOSTICS deleted_bookings = ROW_COUNT;
    
    DELETE FROM quotes WHERE "userId" IN (
        SELECT id FROM users WHERE "firstName" = 'Test'
    );
    GET DIAGNOSTICS deleted_quotes = ROW_COUNT;
    
    DELETE FROM users WHERE "firstName" = 'Test';
    GET DIAGNOSTICS deleted_users = ROW_COUNT;
    
    DELETE FROM businesses WHERE name LIKE 'Test Business%';
    GET DIAGNOSTICS deleted_businesses = ROW_COUNT;
    
    RETURN format('Cleanup completed: %s bookings, %s quotes, %s users, %s businesses deleted', 
                  deleted_bookings, deleted_quotes, deleted_users, deleted_businesses);
END $$;


ALTER FUNCTION "public"."cleanup_rls_test_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_from_bot"("p_user_id" "uuid", "p_provider_id" "uuid", "p_quote_id" "uuid", "p_business_id" "uuid", "p_date_time" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  -- Bot function to create bookings after WhatsApp flow completion
  INSERT INTO bookings ("userId", "providerId", "quoteId", "businessId", "dateTime", status)
  VALUES (p_user_id, p_provider_id, p_quote_id, p_business_id, p_date_time, 'Not Completed')
  RETURNING id INTO v_booking_id;
  
  RETURN v_booking_id;
END;
$$;


ALTER FUNCTION "public"."create_booking_from_bot"("p_user_id" "uuid", "p_provider_id" "uuid", "p_quote_id" "uuid", "p_business_id" "uuid", "p_date_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_customer_account_from_whatsapp"("businessid" "uuid", "firstname" "text", "lastname" "text", "whatsappnumber" "text", "email" "text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  newUserId UUID;
  whatsappNormalized TEXT;
BEGIN
  -- Log the operation
  RAISE LOG 'Bot: Creating customer account for businessId % with phone %', businessId, whatsappNumber;
  
  -- Normalize WhatsApp number
  whatsappNormalized := normalize_phone(whatsappNumber);
  
  -- Validate business exists
  IF NOT EXISTS(SELECT 1 FROM businesses WHERE id = businessId) THEN
    RAISE EXCEPTION 'Business % does not exist', businessId;
  END IF;
  
  -- Check for duplicate WhatsApp number
  IF EXISTS(SELECT 1 FROM users WHERE "whatsAppNumberNormalized" = whatsappNormalized) THEN
    RAISE EXCEPTION 'User with phone % already exists', whatsappNumber;
  END IF;
  
  -- Check for duplicate email in this business
  IF EXISTS(SELECT 1 FROM users WHERE email = email AND "businessId" = businessId) THEN
    RAISE EXCEPTION 'User with email % already exists in this business', email;
  END IF;
  
  -- Generate user ID
  newUserId := gen_random_uuid();
  
  -- Create user record in database
  INSERT INTO users (
    id, "firstName", "lastName", email, role, "businessId",
    "whatsAppNumberNormalized", "createdAt", "updatedAt"
  ) VALUES (
    newUserId, firstName, lastName, email, 'customer', businessId,
    whatsappNormalized, now(), now()
  );
  
  RAISE LOG 'Bot: Created customer record % for businessId %', newUserId, businessId;
  
  -- Return success info
  RETURN json_build_object(
    'userId', newUserId,
    'email', email,
    'whatsappNormalized', whatsappNormalized,
    'message', 'Customer account created successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating customer account: %', SQLERRM;
    RAISE;
END;
$$;


ALTER FUNCTION "public"."create_customer_account_from_whatsapp"("businessid" "uuid", "firstname" "text", "lastname" "text", "whatsappnumber" "text", "email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_quote_from_bot"("p_user_id" "uuid", "p_business_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_quote_id UUID;
BEGIN
  -- Bot function to create quotes after WhatsApp flow completion
  INSERT INTO quotes ("userId", "businessId", "serviceId", "pickUp", "dropOff", "proposedDateTime", status)
  VALUES (p_user_id, p_business_id, p_service_id, p_pickup, p_dropoff, p_proposed_datetime, 'pending')
  RETURNING id INTO v_quote_id;
  
  RETURN v_quote_id;
END;
$$;


ALTER FUNCTION "public"."create_quote_from_bot"("p_user_id" "uuid", "p_business_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."customer_can_cancel_booking"("booking_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if customer owns booking and can cancel it (no time restrictions)
  RETURN EXISTS (
    SELECT 1 FROM bookings 
    WHERE id = booking_id 
    AND "userId" = auth.uid()
    AND status NOT IN ('Completed', 'Cancelled')
  );
END;
$$;


ALTER FUNCTION "public"."customer_can_cancel_booking"("booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."customer_can_cancel_quote"("quote_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if customer owns quote and can cancel it (not accepted/completed/cancelled)
  RETURN EXISTS (
    SELECT 1 FROM quotes 
    WHERE id = quote_id 
    AND "userId" = auth.uid()
    AND status NOT IN ('Accepted', 'Completed', 'Cancelled')
  );
END;
$$;


ALTER FUNCTION "public"."customer_can_cancel_quote"("quote_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."customer_has_interaction_with_business"("business_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if current authenticated user has any bookings or quotes with this business
  -- This ensures customers can only see business info where they are actual clients
  RETURN EXISTS (
    SELECT 1 FROM bookings 
    WHERE "userId" = auth.uid() AND "businessId" = business_id
    UNION
    SELECT 1 FROM quotes 
    WHERE "userId" = auth.uid() AND "businessId" = business_id
  );
END;
$$;


ALTER FUNCTION "public"."customer_has_interaction_with_business"("business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."customer_owns_session"("session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if customer owns session (either as registered user or guest by phone)
  RETURN EXISTS (
    SELECT 1 FROM "chatSessions" 
    WHERE id = session_id 
    AND (
      "userId" = auth.uid() 
      OR (
        "userId" IS NULL 
        AND "channelUserId" = (
          SELECT "whatsAppNumberNormalized"
          FROM users 
          WHERE id = auth.uid()
        )
      )
    )
  );
END;
$$;


ALTER FUNCTION "public"."customer_owns_session"("session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_user_by_phone_global"("phone_normalized" "text") RETURNS TABLE("id" "uuid", "businessId" "uuid", "firstName" "text", "lastName" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u."businessId",
    u."firstName",
    u."lastName",
    u.role
  FROM users u
  WHERE u."whatsAppNumberNormalized" = phone_normalized
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."find_user_by_phone_global"("phone_normalized" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_business_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT "businessId" 
    FROM users 
    WHERE id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."get_my_business_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM users 
    WHERE id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Insert a new row into the public.users table.
  -- The 'id' is taken directly from the new auth.users record (new.id).
  -- Other fields are extracted from the raw_user_meta_data JSON field,
  -- which is populated from the 'options.data' object during sign-up.
  insert into public.users (id, "firstName", "lastName", role, "businessId")
  values (
    new.id,
    new.raw_user_meta_data->>'firstName',
    new.raw_user_meta_data->>'lastName',
    new.raw_user_meta_data->>'role',
    (new.raw_user_meta_data->>'businessId')::uuid
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (SELECT role = 'staff' FROM public.users WHERE id = auth.uid());
END;
$$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "content" "text", "embedding" "public"."vector", "similarity" double precision)
    LANGUAGE "sql"
    AS $$
  select
    id,
    content,
    embedding,
    1 - (embedding <=> query_embedding) as similarity
  from embeddings
  order by embedding <=> query_embedding
  limit match_count;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "business_id_filter" "uuid", "category_filter" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "content" "text", "embedding" "public"."vector", "similarity" double precision, "category" "text", "source" "text")
    LANGUAGE "sql"
    AS $$
select
    d.id,
    d.content,
    d.embedding,
    1 - (d.embedding <=> query_embedding) as similarity,
    d.category,
    d.source
from
    documents d
where
    d."businessId" = business_id_filter 
    and (category_filter is null or d.category = category_filter)
order by
    similarity desc
limit
    match_count;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "business_id_filter" "uuid", "category_filter" "text", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_phone"("phone_input" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  -- Remove everything except digits
  RETURN regexp_replace(phone_input, '[^\d]', '', 'g');
END;
$$;


ALTER FUNCTION "public"."normalize_phone"("phone_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_can_update_notification_status"("notification_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if provider belongs to the business that owns this notification
  RETURN EXISTS (
    SELECT 1 FROM notifications 
    WHERE id = notification_id 
    AND "businessId" = get_my_business_id()
    AND get_my_role() IN ('provider', 'admin/provider')
  );
END;
$$;


ALTER FUNCTION "public"."provider_can_update_notification_status"("notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_can_update_quote_status"("quote_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if provider belongs to the business that received this quote
  RETURN EXISTS (
    SELECT 1 FROM quotes 
    WHERE id = quote_id 
    AND "businessId" = get_my_business_id()
    AND get_my_role() = 'provider'
  );
END;
$$;


ALTER FUNCTION "public"."provider_can_update_quote_status"("quote_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."session_has_escalation"("session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if chat session has active escalation (pending notification)
  RETURN EXISTS (
    SELECT 1 FROM notifications 
    WHERE "chatSessionId" = session_id 
    AND status = 'pending'
  );
END;
$$;


ALTER FUNCTION "public"."session_has_escalation"("session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."system_update_availability_slot"("p_provider_id" "uuid", "p_date" "date", "p_slots" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_slot_id UUID;
BEGIN
  -- System function to automatically update availability when bookings are made
  INSERT INTO "availabilitySlots" ("providerId", date, slots)
  VALUES (p_provider_id, p_date, p_slots)
  ON CONFLICT ("providerId", date) 
  DO UPDATE SET slots = p_slots, "createdAt" = NOW()
  RETURNING id INTO v_slot_id;
  
  RETURN v_slot_id;
END;
$$;


ALTER FUNCTION "public"."system_update_availability_slot"("p_provider_id" "uuid", "p_date" "date", "p_slots" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."availabilitySlots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "slots" "jsonb" NOT NULL,
    "businessId" "uuid" NOT NULL
);


ALTER TABLE "public"."availabilitySlots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text",
    "quoteId" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "businessId" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "providerId" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dateTime" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bookings"."status" IS 'Job status finished? Not completed | Completed';



CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "timeZone" "text" NOT NULL,
    "updatedAt" timestamp with time zone,
    "interfaceType" "text" NOT NULL,
    "websiteUrl" "text",
    "whatsappNumber" "text",
    "businessAddress" "text",
    "depositPercentage" double precision,
    "stripeConnectAccountId" "text",
    "stripeAccountStatus" "text",
    "whatsappPhoneNumberId" "text",
    "preferredPaymentMethod" "text",
    "businessCategory" "text",
    "numberOfProviders" integer DEFAULT 1
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."businesses"."businessCategory" IS 'Structured business categorization (e.g., restaurant, retail, service, etc.)';



CREATE TABLE IF NOT EXISTS "public"."calendarSettings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "userId" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "businessId" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "calendarId" "text",
    "calendarType" "text",
    "settings" "jsonb" NOT NULL,
    "workingHours" "jsonb" NOT NULL
);


ALTER TABLE "public"."calendarSettings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chatSessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "endedAt" timestamp with time zone,
    "sessionIntent" "text",
    "allMessages" "jsonb",
    "summarySession" "text",
    "feedbackDataAveraged" "jsonb",
    "overallChatScore" smallint,
    "channel" "text" NOT NULL,
    "userId" "uuid",
    "businessId" "uuid" NOT NULL,
    "channelUserId" "text",
    "status" "text",
    "controlledByUserId" "uuid",
    "controlTakenAt" timestamp with time zone
);


ALTER TABLE "public"."chatSessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."chatSessions" IS 'Stores every conversation between the user of our client and the bot';



COMMENT ON COLUMN "public"."chatSessions"."updatedAt" IS 'last update';



COMMENT ON COLUMN "public"."chatSessions"."channel" IS 'The communication channel through which the session is taking place (e.g., ''whatsapp'', ''web'', ''telegram'').';



COMMENT ON COLUMN "public"."chatSessions"."userId" IS 'User id is null if the user is a guest';



COMMENT ON COLUMN "public"."chatSessions"."businessId" IS 'businessId is set to NULL if the business is deleted. This is for data conservation reasons';



COMMENT ON COLUMN "public"."chatSessions"."channelUserId" IS 'The user identifier specific to the communication channel (e.g., WhatsApp phone number, web session ID).';



COMMENT ON COLUMN "public"."chatSessions"."controlledByUserId" IS 'ID of admin/staff user who has taken control of this chat session';



COMMENT ON COLUMN "public"."chatSessions"."controlTakenAt" IS 'Timestamp when admin control was taken';



CREATE TABLE IF NOT EXISTS "public"."crawlSessions" (
    "id" "uuid" NOT NULL,
    "businessId" "uuid",
    "startTime" bigint,
    "endTime" bigint,
    "totalPages" integer,
    "successfulPages" integer,
    "failedPages" integer,
    "categories" "jsonb",
    "errors" "jsonb",
    "missingInformation" "text"
);


ALTER TABLE "public"."crawlSessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "businessId" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "source" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contentHash" "text",
    "sessionId" "uuid",
    "confidence" double precision NOT NULL,
    "preChunkSourceIndex" integer,
    "embedding" "public"."vector"(1536),
    "updatedAt" timestamp with time zone,
    "embeddingInputText" "text",
    "embeddingAttemptResult" "jsonb",
    "serviceId" "uuid"
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."documents"."contentHash" IS 'It is used to uniquely identify the content of a page, regardless of its URL. The main purpose is to detect duplicate content—if two pages have the same content, their hashes will match.';



CREATE TABLE IF NOT EXISTS "public"."embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "documentId" "uuid",
    "content" "text",
    "embedding" "public"."vector"(1536),
    "category" "text",
    "chunkIndex" integer,
    "metadata" "jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."embeddings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."embeddings"."embedding" IS 'pgvector embedding';



CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "summary" "text",
    "description" "text",
    "location" "text",
    "startTime" timestamp with time zone NOT NULL,
    "endTime" timestamp with time zone NOT NULL,
    "status" "text" NOT NULL,
    "userId" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" bigint NOT NULL,
    "email" "text" NOT NULL
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


ALTER TABLE "public"."waitlist" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."instruments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."latest_chat_conversations" AS
 WITH "ranked_sessions" AS (
         SELECT "chatSessions"."id",
            "chatSessions"."businessId",
            "chatSessions"."channel",
            "chatSessions"."channelUserId",
            "chatSessions"."allMessages",
            "chatSessions"."updatedAt",
            "row_number"() OVER (PARTITION BY "chatSessions"."channelUserId", "chatSessions"."businessId" ORDER BY "chatSessions"."updatedAt" DESC) AS "rn"
           FROM "public"."chatSessions"
        )
 SELECT "ranked_sessions"."id",
    "ranked_sessions"."businessId",
    "ranked_sessions"."channel",
    "ranked_sessions"."channelUserId",
    (("ranked_sessions"."allMessages" -> '-1'::integer) ->> 'content'::"text") AS "last_message_preview",
    "ranked_sessions"."updatedAt" AS "last_message_timestamp"
   FROM "ranked_sessions"
  WHERE ("ranked_sessions"."rn" = 1);


ALTER TABLE "public"."latest_chat_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "businessId" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chatSessionId" "uuid" DEFAULT "gen_random_uuid"(),
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'unread'::"text" NOT NULL,
    "userId" "uuid",
    "deliveryStatus" "text" DEFAULT 'pending'::"text",
    "deliveryAttempts" integer DEFAULT 0,
    "lastDeliveryAttempt" timestamp with time zone,
    "deliveryError" "text",
    "targetPhoneNumber" "text",
    "whatsappMessageId" "text",
    "notificationType" "text" DEFAULT 'escalation'::"text",
    "priorityLevel" "text" DEFAULT 'medium'::"text",
    "languageCode" "text" DEFAULT 'en'::"text",
    "proxySessionData" "jsonb",
    CONSTRAINT "notifications_delivery_status_check" CHECK (("deliveryStatus" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'retry_scheduled'::"text"]))),
    CONSTRAINT "notifications_type_check" CHECK (("notificationType" = ANY (ARRAY['escalation'::"text", 'booking'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON COLUMN "public"."notifications"."userId" IS 'FK of public.users id';



COMMENT ON COLUMN "public"."notifications"."deliveryStatus" IS 'Tracks WhatsApp message delivery status: pending, sent, failed, retry_scheduled';



COMMENT ON COLUMN "public"."notifications"."deliveryAttempts" IS 'Number of delivery attempts made (max 3)';



COMMENT ON COLUMN "public"."notifications"."lastDeliveryAttempt" IS 'Timestamp of last delivery attempt';



COMMENT ON COLUMN "public"."notifications"."deliveryError" IS 'Error message from last failed delivery attempt';



COMMENT ON COLUMN "public"."notifications"."targetPhoneNumber" IS 'Phone number where notification was sent';



COMMENT ON COLUMN "public"."notifications"."whatsappMessageId" IS 'WhatsApp message ID returned by Meta API for tracking delivery status';



COMMENT ON COLUMN "public"."notifications"."notificationType" IS 'Type of notification: escalation (customer needs help), booking (new booking created), system (system alerts)';



CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "userId" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pickUp" "text",
    "dropOff" "text",
    "businessId" "uuid" NOT NULL,
    "travelCostEstimate" smallint,
    "status" "text",
    "totalJobCostEstimation" smallint NOT NULL,
    "updatedAt" timestamp with time zone,
    "travelTimeEstimate" smallint,
    "totalJobDurationEstimation" smallint NOT NULL,
    "serviceCost" smallint,
    "depositAmount" smallint,
    "remainingBalance" double precision,
    "proposedDateTime" timestamp with time zone,
    "serviceIds" "uuid"[] NOT NULL,
    CONSTRAINT "quotes_service_ids_not_empty" CHECK (("array_length"("serviceIds", 1) > 0))
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quotes"."status" IS 'Pendiente, aceptado, o rechazado por el usuario. Aceptado al finalizar. Pendiente si aun no se termino. Rechazado cuando se va la person.';



COMMENT ON COLUMN "public"."quotes"."travelTimeEstimate" IS 'from pick up to drop off customer addresses';



CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" NOT NULL,
    "businessId" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "pricingType" "text" NOT NULL,
    "fixedPrice" integer,
    "baseCharge" integer,
    "includedMinutes" integer,
    "ratePerMinute" double precision,
    "description" "text",
    "durationEstimate" integer,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "mobile" boolean
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."userContexts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "channelUserId" "text" NOT NULL,
    "businessId" "uuid",
    "currentGoal" "jsonb",
    "previousGoal" "jsonb",
    "participantPreferences" "jsonb" DEFAULT '{"language": "en", "timezone": "Australia/Melbourne", "notificationSettings": {"email": true}}'::"jsonb",
    "frequentlyDiscussedTopics" "text" DEFAULT '{}'::"text",
    "sessionData" "jsonb"
);


ALTER TABLE "public"."userContexts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."userContexts"."businessId" IS 'businessId is set to NULL if the business is deleted. This is for data conservation reasons';



COMMENT ON COLUMN "public"."userContexts"."sessionData" IS 'Stores session-specific data such as user creation state, temporary flags, and conversation flow state';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "firstName" "text" NOT NULL,
    "lastName" "text" NOT NULL,
    "role" "text" NOT NULL,
    "businessId" "uuid",
    "updatedAt" timestamp with time zone,
    "whatsAppNumberNormalized" "text",
    "phoneNormalized" "text",
    "email" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."whatsAppNumberNormalized" IS 'Gold rule: wpp number is unique. It prevents ambiguity';



ALTER TABLE ONLY "public"."availabilitySlots"
    ADD CONSTRAINT "availabilitySlots_businessId_date_unique" UNIQUE ("businessId", "date");



ALTER TABLE ONLY "public"."availabilitySlots"
    ADD CONSTRAINT "availabilitySlotss_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendarSettings"
    ADD CONSTRAINT "calendarSettings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendarSettings"
    ADD CONSTRAINT "calendarSettings_userId_key" UNIQUE ("userId");



ALTER TABLE ONLY "public"."chatSessions"
    ADD CONSTRAINT "chatSessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crawlSessions"
    ADD CONSTRAINT "crawl_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documentss_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."embeddings"
    ADD CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "instruments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."userContexts"
    ADD CONSTRAINT "userContexts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "availabilitySlots_businessId_date_idx" ON "public"."availabilitySlots" USING "btree" ("businessId", "date");



CREATE INDEX "chatSessions_channel_channelUserId_idx" ON "public"."chatSessions" USING "btree" ("channel", "channelUserId");



CREATE INDEX "chatSessions_controlled_by_idx" ON "public"."chatSessions" USING "btree" ("controlledByUserId") WHERE ("controlledByUserId" IS NOT NULL);



CREATE INDEX "idx_notifications_delivery_retry" ON "public"."notifications" USING "btree" ("deliveryStatus", "deliveryAttempts", "lastDeliveryAttempt") WHERE ("deliveryStatus" = 'retry_scheduled'::"text");



CREATE INDEX "idx_notifications_delivery_status" ON "public"."notifications" USING "btree" ("deliveryStatus");



CREATE INDEX "idx_notifications_notification_type" ON "public"."notifications" USING "btree" ("notificationType");



CREATE INDEX "idx_notifications_whatsapp_message_id" ON "public"."notifications" USING "btree" ("whatsappMessageId") WHERE ("whatsappMessageId" IS NOT NULL);



CREATE INDEX "idx_quotes_service_ids" ON "public"."quotes" USING "gin" ("serviceIds");



CREATE INDEX "notifications_proxy_mode_idx" ON "public"."notifications" USING "btree" ("status", "targetPhoneNumber") WHERE ("status" = 'proxy_mode'::"text");



ALTER TABLE ONLY "public"."availabilitySlots"
    ADD CONSTRAINT "availabilitySlots_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_providerId_fkey1" FOREIGN KEY ("providerId") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."quotes"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."calendarSettings"
    ADD CONSTRAINT "calendarSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."calendarSettings"
    ADD CONSTRAINT "calendarSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."chatSessions"
    ADD CONSTRAINT "chatSessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chatSessions"
    ADD CONSTRAINT "chatSessions_controlledByUserId_fkey" FOREIGN KEY ("controlledByUserId") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."chatSessions"
    ADD CONSTRAINT "chatSessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."crawlSessions"
    ADD CONSTRAINT "crawl_sessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."crawlSessions"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documentss_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."embeddings"
    ADD CONSTRAINT "embeddings_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "public"."chatSessions"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_businessId_fkey1" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."userContexts"
    ADD CONSTRAINT "userContexts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Allow anonymous access to businesses table for webhook operatio" ON "public"."users" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."services" FOR SELECT USING (true);



CREATE POLICY "admin_availability_all" ON "public"."availabilitySlots" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_bookings_all" ON "public"."bookings" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_business_insert" ON "public"."businesses" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_businesses_all" ON "public"."businesses" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_calendar_settings_all" ON "public"."calendarSettings" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_chat_sessions_all" ON "public"."chatSessions" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_crawl_sessions_all" ON "public"."crawlSessions" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_notifications_all" ON "public"."notifications" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_provider_availability_business" ON "public"."availabilitySlots" TO "authenticated" USING ((("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'admin/provider'::"text", 'provider'::"text"])) AND ("businessId" = "public"."get_my_business_id"()))) WITH CHECK ((("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'admin/provider'::"text", 'provider'::"text"])) AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_bookings_own_business" ON "public"."bookings" TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"()))) WITH CHECK ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_businesses_own" ON "public"."businesses" TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("id" = "public"."get_my_business_id"()))) WITH CHECK ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("id" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_calendar_settings_business" ON "public"."calendarSettings" TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"()))) WITH CHECK ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_chat_sessions_business_delete" ON "public"."chatSessions" FOR DELETE TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_chat_sessions_business_select" ON "public"."chatSessions" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_chat_sessions_business_update" ON "public"."chatSessions" FOR UPDATE TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"()))) WITH CHECK ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_crawl_sessions_business" ON "public"."crawlSessions" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_crawl_sessions_insert" ON "public"."crawlSessions" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_notifications_business" ON "public"."notifications" TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"()))) WITH CHECK ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_quotes_own_business" ON "public"."quotes" TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"()))) WITH CHECK ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_services_own_business" ON "public"."services" TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"()))) WITH CHECK ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_user_contexts_business" ON "public"."userContexts" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_provider_users_business" ON "public"."users" TO "authenticated" USING ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"()))) WITH CHECK ((("public"."get_my_role"() = 'admin/provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "admin_quotes_all" ON "public"."quotes" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_services_all" ON "public"."services" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_user_contexts_all" ON "public"."userContexts" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "admin_users_all" ON "public"."users" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "anon_business_insert" ON "public"."businesses" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "authenticated_business_insert" ON "public"."businesses" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."availabilitySlots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendarSettings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chatSessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crawlSessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_availability_read_all" ON "public"."availabilitySlots" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'customer'::"text"));



CREATE POLICY "customer_bookings_cancel_own" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ((("public"."get_my_role"() = 'customer'::"text") AND "public"."customer_can_cancel_booking"("id"))) WITH CHECK ((("public"."get_my_role"() = 'customer'::"text") AND "public"."customer_can_cancel_booking"("id") AND ("status" = 'Cancelled'::"text")));



CREATE POLICY "customer_bookings_own_select" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'customer'::"text") AND ("userId" = "auth"."uid"())));



CREATE POLICY "customer_businesses_interactions" ON "public"."businesses" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'customer'::"text") AND "public"."customer_has_interaction_with_business"("id")));



CREATE POLICY "customer_chat_sessions_feedback_update" ON "public"."chatSessions" FOR UPDATE TO "authenticated" USING ((("public"."get_my_role"() = 'customer'::"text") AND "public"."customer_owns_session"("id"))) WITH CHECK ((("public"."get_my_role"() = 'customer'::"text") AND "public"."customer_owns_session"("id")));



CREATE POLICY "customer_chat_sessions_own_select" ON "public"."chatSessions" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'customer'::"text") AND "public"."customer_owns_session"("id")));



CREATE POLICY "customer_quotes_cancel_own" ON "public"."quotes" FOR UPDATE TO "authenticated" USING ((("public"."get_my_role"() = 'customer'::"text") AND "public"."customer_can_cancel_quote"("id"))) WITH CHECK ((("public"."get_my_role"() = 'customer'::"text") AND "public"."customer_can_cancel_quote"("id") AND ("status" = 'Cancelled'::"text")));



CREATE POLICY "customer_quotes_create_own" ON "public"."quotes" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_my_role"() = 'customer'::"text") AND ("userId" = "auth"."uid"())));



CREATE POLICY "customer_quotes_own_select" ON "public"."quotes" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'customer'::"text") AND ("userId" = "auth"."uid"())));



CREATE POLICY "customer_services_read_all" ON "public"."services" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'customer'::"text"));



CREATE POLICY "customer_users_own" ON "public"."users" TO "authenticated" USING ((("public"."get_my_role"() = 'customer'::"text") AND ("id" = "auth"."uid"()))) WITH CHECK ((("public"."get_my_role"() = 'customer'::"text") AND ("id" = "auth"."uid"())));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_bookings_assigned_select" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND ("providerId" = "auth"."uid"())));



CREATE POLICY "provider_bookings_assigned_update_status" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND ("providerId" = "auth"."uid"()))) WITH CHECK ((("public"."get_my_role"() = 'provider'::"text") AND ("providerId" = "auth"."uid"())));



CREATE POLICY "provider_businesses_read_own" ON "public"."businesses" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND ("id" = "public"."get_my_business_id"())));



CREATE POLICY "provider_calendar_settings_no_delete" ON "public"."calendarSettings" FOR DELETE TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND false));



CREATE POLICY "provider_calendar_settings_own" ON "public"."calendarSettings" TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND ("userId" = "auth"."uid"()) AND ("businessId" = "public"."get_my_business_id"()))) WITH CHECK ((("public"."get_my_role"() = 'provider'::"text") AND ("userId" = "auth"."uid"()) AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "provider_chat_sessions_business_select" ON "public"."chatSessions" FOR SELECT USING ((("public"."get_my_role"() = 'provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "provider_chat_sessions_escalated_select" ON "public"."chatSessions" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND ("businessId" = "public"."get_my_business_id"()) AND "public"."session_has_escalation"("id")));



CREATE POLICY "provider_chat_sessions_escalated_update" ON "public"."chatSessions" FOR UPDATE TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND ("businessId" = "public"."get_my_business_id"()) AND "public"."session_has_escalation"("id"))) WITH CHECK ((("public"."get_my_role"() = 'provider'::"text") AND ("businessId" = "public"."get_my_business_id"()) AND "public"."session_has_escalation"("id")));



CREATE POLICY "provider_notifications_update_status" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ("public"."provider_can_update_notification_status"("id")) WITH CHECK ("public"."provider_can_update_notification_status"("id"));



CREATE POLICY "provider_notifications_view" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "provider_quotes_read_business" ON "public"."quotes" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "provider_quotes_update_status" ON "public"."quotes" FOR UPDATE TO "authenticated" USING ("public"."provider_can_update_quote_status"("id")) WITH CHECK ("public"."provider_can_update_quote_status"("id"));



CREATE POLICY "provider_services_read_own_business" ON "public"."services" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



CREATE POLICY "provider_user_contexts_business" ON "public"."userContexts" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = 'provider'::"text") AND ("businessId" = "public"."get_my_business_id"())));



ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."userContexts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "webhook_availability_read" ON "public"."availabilitySlots" FOR SELECT TO "anon" USING (true);



CREATE POLICY "webhook_availability_update" ON "public"."availabilitySlots" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "webhook_bookings_read" ON "public"."bookings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "webhook_bookings_write" ON "public"."bookings" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "webhook_businesses_read" ON "public"."businesses" FOR SELECT TO "anon" USING (true);



CREATE POLICY "webhook_calendar_settings_read" ON "public"."calendarSettings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "webhook_quotes_read" ON "public"."quotes" FOR SELECT TO "anon" USING (true);



CREATE POLICY "webhook_quotes_update" ON "public"."quotes" FOR SELECT TO "anon" USING (true);



CREATE POLICY "webhook_quotes_write" ON "public"."quotes" FOR INSERT TO "anon" WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chatSessions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."availability_belongs_to_business_provider"("slot_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."availability_belongs_to_business_provider"("slot_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."availability_belongs_to_business_provider"("slot_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."booking_belongs_to_provider"("booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."booking_belongs_to_provider"("booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."booking_belongs_to_provider"("booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_complete_goal_and_set_new"("p_context_id" "uuid", "p_new_current_goal" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bot_complete_goal_and_set_new"("p_context_id" "uuid", "p_new_current_goal" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_complete_goal_and_set_new"("p_context_id" "uuid", "p_new_current_goal" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_create_escalation_notification"("p_business_id" "uuid", "p_chat_session_id" "uuid", "p_message" "text", "p_escalation_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bot_create_escalation_notification"("p_business_id" "uuid", "p_chat_session_id" "uuid", "p_message" "text", "p_escalation_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_create_escalation_notification"("p_business_id" "uuid", "p_chat_session_id" "uuid", "p_message" "text", "p_escalation_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_create_guest_chat_session"("p_channel" "text", "p_channel_user_id" "text", "p_business_id" "uuid", "p_initial_messages" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bot_create_guest_chat_session"("p_channel" "text", "p_channel_user_id" "text", "p_business_id" "uuid", "p_initial_messages" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_create_guest_chat_session"("p_channel" "text", "p_channel_user_id" "text", "p_business_id" "uuid", "p_initial_messages" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_create_quote"("p_user_id" "uuid", "p_business_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone, "p_initial_cost_estimate" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."bot_create_quote"("p_user_id" "uuid", "p_business_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone, "p_initial_cost_estimate" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_create_quote"("p_user_id" "uuid", "p_business_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone, "p_initial_cost_estimate" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_create_user_context"("p_channel_user_id" "text", "p_business_id" "uuid", "p_current_goal" "jsonb", "p_participant_preferences" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bot_create_user_context"("p_channel_user_id" "text", "p_business_id" "uuid", "p_current_goal" "jsonb", "p_participant_preferences" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_create_user_context"("p_channel_user_id" "text", "p_business_id" "uuid", "p_current_goal" "jsonb", "p_participant_preferences" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_end_chat_session"("p_session_id" "uuid", "p_summary_session" "text", "p_final_intent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bot_end_chat_session"("p_session_id" "uuid", "p_summary_session" "text", "p_final_intent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_end_chat_session"("p_session_id" "uuid", "p_summary_session" "text", "p_final_intent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_find_user_context"("p_channel_user_id" "text", "p_business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bot_find_user_context"("p_channel_user_id" "text", "p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_find_user_context"("p_channel_user_id" "text", "p_business_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_link_user_to_session"("p_session_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bot_link_user_to_session"("p_session_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_link_user_to_session"("p_session_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_update_chat_session"("p_session_id" "uuid", "p_new_messages" "jsonb", "p_session_intent" "text", "p_summary_session" "text", "p_feedback_data" "jsonb", "p_overall_customer_satisfaction" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."bot_update_chat_session"("p_session_id" "uuid", "p_new_messages" "jsonb", "p_session_intent" "text", "p_summary_session" "text", "p_feedback_data" "jsonb", "p_overall_customer_satisfaction" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_update_chat_session"("p_session_id" "uuid", "p_new_messages" "jsonb", "p_session_intent" "text", "p_summary_session" "text", "p_feedback_data" "jsonb", "p_overall_customer_satisfaction" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_update_notification_status"("p_notification_id" "uuid", "p_new_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bot_update_notification_status"("p_notification_id" "uuid", "p_new_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_update_notification_status"("p_notification_id" "uuid", "p_new_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_update_quote"("p_quote_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone, "p_cost_estimate" integer, "p_travel_cost_estimate" integer, "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bot_update_quote"("p_quote_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone, "p_cost_estimate" integer, "p_travel_cost_estimate" integer, "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_update_quote"("p_quote_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone, "p_cost_estimate" integer, "p_travel_cost_estimate" integer, "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bot_update_user_context"("p_context_id" "uuid", "p_current_goal" "jsonb", "p_previous_goal" "jsonb", "p_participant_preferences" "jsonb", "p_frequently_discussed_topics" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bot_update_user_context"("p_context_id" "uuid", "p_current_goal" "jsonb", "p_previous_goal" "jsonb", "p_participant_preferences" "jsonb", "p_frequently_discussed_topics" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bot_update_user_context"("p_context_id" "uuid", "p_current_goal" "jsonb", "p_previous_goal" "jsonb", "p_participant_preferences" "jsonb", "p_frequently_discussed_topics" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_rls_test_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_rls_test_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_rls_test_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_from_bot"("p_user_id" "uuid", "p_provider_id" "uuid", "p_quote_id" "uuid", "p_business_id" "uuid", "p_date_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_from_bot"("p_user_id" "uuid", "p_provider_id" "uuid", "p_quote_id" "uuid", "p_business_id" "uuid", "p_date_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_from_bot"("p_user_id" "uuid", "p_provider_id" "uuid", "p_quote_id" "uuid", "p_business_id" "uuid", "p_date_time" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_customer_account_from_whatsapp"("businessid" "uuid", "firstname" "text", "lastname" "text", "whatsappnumber" "text", "email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_customer_account_from_whatsapp"("businessid" "uuid", "firstname" "text", "lastname" "text", "whatsappnumber" "text", "email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_customer_account_from_whatsapp"("businessid" "uuid", "firstname" "text", "lastname" "text", "whatsappnumber" "text", "email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_customer_account_from_whatsapp"("businessid" "uuid", "firstname" "text", "lastname" "text", "whatsappnumber" "text", "email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_quote_from_bot"("p_user_id" "uuid", "p_business_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_quote_from_bot"("p_user_id" "uuid", "p_business_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_quote_from_bot"("p_user_id" "uuid", "p_business_id" "uuid", "p_service_id" "uuid", "p_pickup" "text", "p_dropoff" "text", "p_proposed_datetime" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."customer_can_cancel_booking"("booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."customer_can_cancel_booking"("booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."customer_can_cancel_booking"("booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."customer_can_cancel_quote"("quote_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."customer_can_cancel_quote"("quote_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."customer_can_cancel_quote"("quote_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."customer_has_interaction_with_business"("business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."customer_has_interaction_with_business"("business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."customer_has_interaction_with_business"("business_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."customer_owns_session"("session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."customer_owns_session"("session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."customer_owns_session"("session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_user_by_phone_global"("phone_normalized" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_user_by_phone_global"("phone_normalized" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_user_by_phone_global"("phone_normalized" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_business_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_business_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_business_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "business_id_filter" "uuid", "category_filter" "text", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "business_id_filter" "uuid", "category_filter" "text", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "business_id_filter" "uuid", "category_filter" "text", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_phone"("phone_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_phone"("phone_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_phone"("phone_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."provider_can_update_notification_status"("notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."provider_can_update_notification_status"("notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_can_update_notification_status"("notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."provider_can_update_quote_status"("quote_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."provider_can_update_quote_status"("quote_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_can_update_quote_status"("quote_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."session_has_escalation"("session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."session_has_escalation"("session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_has_escalation"("session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."system_update_availability_slot"("p_provider_id" "uuid", "p_date" "date", "p_slots" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."system_update_availability_slot"("p_provider_id" "uuid", "p_date" "date", "p_slots" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."system_update_availability_slot"("p_provider_id" "uuid", "p_date" "date", "p_slots" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."availabilitySlots" TO "anon";
GRANT ALL ON TABLE "public"."availabilitySlots" TO "authenticated";
GRANT ALL ON TABLE "public"."availabilitySlots" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT ALL ON TABLE "public"."calendarSettings" TO "anon";
GRANT ALL ON TABLE "public"."calendarSettings" TO "authenticated";
GRANT ALL ON TABLE "public"."calendarSettings" TO "service_role";



GRANT ALL ON TABLE "public"."chatSessions" TO "anon";
GRANT ALL ON TABLE "public"."chatSessions" TO "authenticated";
GRANT ALL ON TABLE "public"."chatSessions" TO "service_role";



GRANT ALL ON TABLE "public"."crawlSessions" TO "anon";
GRANT ALL ON TABLE "public"."crawlSessions" TO "authenticated";
GRANT ALL ON TABLE "public"."crawlSessions" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."embeddings" TO "anon";
GRANT ALL ON TABLE "public"."embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";



GRANT ALL ON SEQUENCE "public"."instruments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."instruments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."instruments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."latest_chat_conversations" TO "anon";
GRANT ALL ON TABLE "public"."latest_chat_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."latest_chat_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."userContexts" TO "anon";
GRANT ALL ON TABLE "public"."userContexts" TO "authenticated";
GRANT ALL ON TABLE "public"."userContexts" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
