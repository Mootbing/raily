# Real-Time GTFS Integration Guide

## Overview

This app integrates with the Transitdocs GTFS-RT feed to provide live train positions and delay information for all active Amtrak trains.

## Data Source

**Endpoint:** `https://asm-backend.transitdocs.com/gtfs/amtrak`

**Format:** GTFS-RT Protobuf (Protocol Buffers)

**Update Frequency:** Real-time (app polls every 15 seconds)

**Data Included:**

- Vehicle positions (lat/lon, speed, bearing)
- Trip updates (delays, schedule adherence)
- Train identification (trip ID, train number, vehicle ID)

## Train ID Matching

### Trip ID Format

Transitdocs uses this format: `YYYY-MM-DD_AMTK_NNN`

Examples:

- `2026-01-16_AMTK_543` → Train 543
- `2026-01-16_AMTK_228761` → Train 228761

### Matching Strategy

The app supports flexible train ID matching:

1. **Direct match** - Look up by exact trip ID or train number
2. **Extract train number** - Parse train number from trip ID format
3. **Dual indexing** - Cache entries by both trip ID and train number

This allows you to query with either:

- Full trip ID: `"2026-01-16_AMTK_543"`
- Just train number: `"543"`

## API Reference

### RealtimeService

Core service for GTFS-RT data.

#### `getPositionForTrip(tripIdOrTrainNumber: string): Promise<RealtimePosition | null>`

Get live position for a specific train.

```typescript
const position = await RealtimeService.getPositionForTrip('543');
if (position) {
  console.log(`Train at: ${position.latitude}, ${position.longitude}`);
  console.log(`Speed: ${position.speed} mph`);
  console.log(`Bearing: ${position.bearing}°`);
}
```

#### `getAllActiveTrains(): Promise<Array<{trainNumber: string, position: RealtimePosition}>>`

Get all trains currently transmitting positions.

```typescript
const trains = await RealtimeService.getAllActiveTrains();
console.log(`${trains.length} trains active`);
trains.forEach(({ trainNumber, position }) => {
  console.log(`Train ${trainNumber}: ${position.latitude}, ${position.longitude}`);
});
```

#### `getUpdatesForTrip(tripIdOrTrainNumber: string): Promise<RealtimeUpdate[]>`

Get delay and schedule information for a train.

```typescript
const updates = await RealtimeService.getUpdatesForTrip('543');
updates.forEach(update => {
  if (update.departure_delay) {
    console.log(`Stop ${update.stop_id}: ${update.departure_delay}s delay`);
  }
});
```

#### `getDelayForStop(tripIdOrTrainNumber: string, stopId: string): Promise<number | null>`

Get delay in minutes for a specific stop.

```typescript
const delay = await RealtimeService.getDelayForStop('543', 'NYP');
console.log(`Delay at NYP: ${delay} minutes`);
```

#### `formatDelay(delayMinutes: number | null): string`

Format delay for user display.

```typescript
console.log(RealtimeService.formatDelay(5)); // "Delayed 5m"
console.log(RealtimeService.formatDelay(0)); // "On Time"
console.log(RealtimeService.formatDelay(-2)); // "Early 2m"
```

#### `clearCache(): void`

Force cache refresh on next request.

```typescript
RealtimeService.clearCache();
```

### TrainAPIService

High-level API with GTFS schedule + real-time integration.

#### `getActiveTrains(): Promise<Train[]>`

Get all active trains with full details (schedule + real-time).

```typescript
const trains = await TrainAPIService.getActiveTrains();
trains.forEach(train => {
  console.log(`${train.trainNumber}: ${train.from} → ${train.to}`);
  if (train.realtime?.position) {
    console.log(`  Position: ${train.realtime.position.lat}, ${train.realtime.position.lon}`);
  }
});
```

#### `getTrainDetails(tripId: string): Promise<Train | null>`

Get schedule and real-time data for a specific train.

```typescript
const train = await TrainAPIService.getTrainDetails('543');
if (train?.realtime?.position) {
  console.log(`Train ${train.trainNumber} is at ${train.realtime.position.lat}, ${train.realtime.position.lon}`);
  console.log(`Status: ${train.realtime.status}`);
}
```

#### `refreshRealtimeData(train: Train): Promise<Train>`

Update real-time data for an existing train object.

```typescript
let train = {
  /* existing train object */
};
train = await TrainAPIService.refreshRealtimeData(train);
// train.realtime now has latest position and delay
```

## Caching Strategy

### Cache TTL: 15 seconds

The app caches GTFS-RT data for 15 seconds to balance:

- **Freshness** - Real-time updates appear quickly
- **Performance** - Reduces API calls and parsing overhead
- **Battery** - Limits network usage on mobile devices

### Cache Behavior

- **Hit** - If cache is < 15s old, return cached data immediately
- **Miss** - Fetch fresh protobuf, parse, and update cache
- **Error** - Return stale cache if available, empty map otherwise

### Manual Cache Control

```typescript
// Force immediate refresh
RealtimeService.clearCache();
const freshData = await RealtimeService.getAllPositions();
```

## UI Integration

The map automatically displays live train positions:

```typescript
// In app/index.tsx
{savedTrains
  .filter(train => train.realtime?.position)
  .map((train) => (
    <Marker
      key={`live-${train.id}`}
      coordinate={{
        latitude: train.realtime!.position!.lat,
        longitude: train.realtime!.position!.lon
      }}
      title={`Train ${train.trainNumber}`}
      description={train.realtime?.status || 'Live'}
    />
  ))}
```

### Auto-Refresh Pattern

```typescript
// Refresh saved trains every 30 seconds
useEffect(() => {
  const interval = setInterval(async () => {
    const trains = await TrainStorageService.getSavedTrains();
    const refreshed = await Promise.all(trains.map(train => TrainAPIService.refreshRealtimeData(train)));
    setSavedTrains(refreshed);
  }, 30000);

  return () => clearInterval(interval);
}, []);
```

## Data Structures

### RealtimePosition

```typescript
interface RealtimePosition {
  trip_id: string; // Full trip ID
  train_number?: string; // Extracted train number
  latitude: number; // Decimal degrees
  longitude: number; // Decimal degrees
  bearing?: number; // 0-360 degrees (0 = North)
  speed?: number; // Miles per hour
  timestamp: number; // Unix timestamp (milliseconds)
  vehicle_id?: string; // Vehicle identifier
}
```

### RealtimeUpdate

```typescript
interface RealtimeUpdate {
  trip_id: string;
  stop_id?: string;
  arrival_delay?: number; // Seconds (positive = late)
  departure_delay?: number; // Seconds (positive = late)
  schedule_relationship?: 'SCHEDULED' | 'SKIPPED' | 'NO_DATA';
}
```

### Train (with real-time)

```typescript
interface Train {
  // ... schedule fields ...
  realtime?: {
    position?: { lat: number; lon: number };
    delay?: number; // Minutes
    status?: string; // "On Time", "Delayed 5m", etc.
    lastUpdated?: number; // Unix timestamp
  };
}
```

## Testing

### Run the Test Suite

```bash
npx tsx test-realtime.ts
```

Expected output:

```
🚂 Testing Transitdocs GTFS-RT Integration...

📍 Fetching all active train positions...
✅ Found 159 active trains

Sample trains:
  Train 228761:
    Position: 38.5667, -121.6362
    Speed: 35.7 mph
    Bearing: 90°
    Updated: 7:42:19 PM
  ...

⏱️  Testing trip updates (delays)...
✅ Found updates for 175 trips

✨ Real-time integration test complete!
```

## Troubleshooting

### No trains showing on map

1. Check network connectivity
2. Verify Transitdocs endpoint is accessible: `curl -I https://asm-backend.transitdocs.com/gtfs/amtrak`
3. Clear cache: `RealtimeService.clearCache()`
4. Check console for parsing errors

### Train number not found

- Try full trip ID format: `2026-01-16_AMTK_543`
- Check if train is currently active: `RealtimeService.getAllActiveTrains()`
- Verify train is running today (not all trains run daily)

### Stale positions

- Check `position.timestamp` to see when position was last updated
- Some trains may not transmit position frequently
- Clear cache to force fresh fetch

## Performance Considerations

### Map Viewport Optimization

The app only renders trains visible in the current map viewport:

```typescript
const visibleTrains = trains.filter(train => {
  if (!train.realtime?.position) return false;
  const { lat, lon } = train.realtime.position;
  return lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLon && lon <= bounds.maxLon;
});
```

### Batch Updates

When refreshing multiple trains, use `Promise.all()`:

```typescript
// Good: Parallel requests
const updated = await Promise.all(trains.map(t => TrainAPIService.refreshRealtimeData(t)));

// Bad: Sequential requests
for (const train of trains) {
  await TrainAPIService.refreshRealtimeData(train); // Slow!
}
```

### Memory Management

- Cache is automatically pruned after 15s
- Old train objects are garbage collected
- Map markers reuse component instances

## Future Enhancements

Potential improvements:

- [ ] WebSocket support for push updates
- [ ] Historical position tracking (breadcrumb trail)
- [ ] Speed-based marker icons (stopped vs moving)
- [ ] Predictive arrival times using speed + distance
- [ ] Offline mode with last-known positions
- [ ] Push notifications for saved train delays

## References

- [GTFS-RT Specification](https://gtfs.org/realtime/)
- [Transitdocs Documentation](https://www.transitdocs.com/)
- [gtfs-realtime-bindings](https://www.npmjs.com/package/gtfs-realtime-bindings)
