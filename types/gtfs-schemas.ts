/**
 * Zod validation schemas for GTFS data
 * Ensures data integrity from external APIs
 */

import { z } from 'zod';

/**
 * Train position schema (GTFS-RT vehicle position)
 */
export const TrainPositionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  bearing: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
});

/**
 * GTFS-RT realtime position schema
 */
export const RealtimePositionSchema = z.object({
  trip_id: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  bearing: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  timestamp: z.number(),
  vehicle_id: z.string().optional(),
  train_number: z.string().optional(),
});

/**
 * GTFS-RT realtime update schema
 */
export const RealtimeUpdateSchema = z.object({
  trip_id: z.string(),
  stop_id: z.string().optional(),
  arrival_delay: z.number().optional(),
  departure_delay: z.number().optional(),
  schedule_relationship: z.enum(['SCHEDULED', 'SKIPPED', 'NO_DATA']).optional(),
});

/**
 * GTFS Stop schema
 */
export const StopSchema = z.object({
  stop_id: z.string(),
  stop_name: z.string(),
  stop_lat: z.number().min(-90).max(90),
  stop_lon: z.number().min(-180).max(180),
  stop_code: z.string().optional(),
  platform_code: z.string().optional(),
  location_type: z.number().optional(),
  parent_station: z.string().optional(),
  wheelchair_boarding: z.number().optional(),
});

/**
 * GTFS Route schema
 */
export const RouteSchema = z.object({
  route_id: z.string(),
  route_short_name: z.string(),
  route_long_name: z.string(),
  route_type: z.number(),
  route_color: z.string().optional(),
  route_text_color: z.string().optional(),
});

/**
 * GTFS Trip schema
 */
export const TripSchema = z.object({
  trip_id: z.string(),
  route_id: z.string(),
  service_id: z.string(),
  trip_headsign: z.string().optional(),
  trip_short_name: z.string().optional(),
  direction_id: z.number().optional(),
  shape_id: z.string().optional(),
});

/**
 * GTFS Stop Time schema
 */
export const StopTimeSchema = z.object({
  trip_id: z.string(),
  stop_id: z.string(),
  stop_sequence: z.number(),
  arrival_time: z.string(),
  departure_time: z.string(),
  stop_headsign: z.string().optional(),
  pickup_type: z.number().optional(),
  drop_off_type: z.number().optional(),
  timepoint: z.number().optional(),
});

/**
 * GTFS Shape Point schema
 */
export const ShapePointSchema = z.object({
  shape_id: z.string(),
  shape_pt_lat: z.number().min(-90).max(90),
  shape_pt_lon: z.number().min(-180).max(180),
  shape_pt_sequence: z.number(),
  shape_dist_traveled: z.number().optional(),
});

// Type exports
export type TrainPosition = z.infer<typeof TrainPositionSchema>;
export type RealtimePosition = z.infer<typeof RealtimePositionSchema>;
export type RealtimeUpdate = z.infer<typeof RealtimeUpdateSchema>;
export type GtfsStop = z.infer<typeof StopSchema>;
export type GtfsRoute = z.infer<typeof RouteSchema>;
export type GtfsTrip = z.infer<typeof TripSchema>;
export type GtfsStopTime = z.infer<typeof StopTimeSchema>;
export type GtfsShapePoint = z.infer<typeof ShapePointSchema>;
