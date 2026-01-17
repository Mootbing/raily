# Quick Start: Real-Time Train Tracking

## 🚀 Test the Integration (30 seconds)

```bash
# Run the test script to see live trains
npx tsx test-realtime.ts
```

You should see:
```
✅ Found 159 active trains

Sample trains:
  Train 228761:
    Position: 38.5816, -121.5700
    Speed: 35.2 mph
    Bearing: 90°
```

## 📱 Run the App

```bash
# Start the development server
npx expo start

# Then press:
# - 'i' for iOS simulator
# - 'a' for Android emulator
# - 'w' for web browser
```

The map will show live train markers automatically!

## 💻 Use in Your Code

### Get all active trains

```typescript
import { TrainAPIService } from './services/api';

const trains = await TrainAPIService.getActiveTrains();
// Returns Train[] with real-time positions
```

### Get specific train position

```typescript
import { RealtimeService } from './services/realtime';

const position = await RealtimeService.getPositionForTrip('543');
console.log(`Lat: ${position?.latitude}, Lon: ${position?.longitude}`);
```

### Check if train is delayed

```typescript
const delay = await RealtimeService.getDelayForStop('543', 'NYP');
console.log(RealtimeService.formatDelay(delay));
// Output: "On Time" or "Delayed 5m"
```

### Refresh a saved train

```typescript
let train = { /* existing train object */ };
train = await TrainAPIService.refreshRealtimeData(train);
// train.realtime.position now has latest location
```

## 📖 Documentation

- **[REALTIME_GUIDE.md](./REALTIME_GUIDE.md)** - Complete API reference
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Architecture details
- **[README.md](./README.md)** - Project overview

## ✅ What Works

- ✅ Live positions for 150+ active Amtrak trains
- ✅ Speed and bearing data
- ✅ Delay information at each stop
- ✅ Train ID matching (supports "543" or "2026-01-16_AMTK_543")
- ✅ 15-second cache for performance
- ✅ Automatic real-time enrichment
- ✅ Map markers for live trains

## 🔧 Key Files

| File | Purpose |
|------|---------|
| `services/realtime.ts` | GTFS-RT parser and cache |
| `services/api.ts` | High-level API with enrichment |
| `app/index.tsx` | Map UI with live markers |
| `test-realtime.ts` | Integration test script |

## 🎯 Common Use Cases

### Show all trains on map

```typescript
const trains = await TrainAPIService.getActiveTrains();
trains.forEach(train => {
  if (train.realtime?.position) {
    // Place marker at train.realtime.position.lat/lon
  }
});
```

### Auto-refresh every 30 seconds

```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const updated = await Promise.all(
      savedTrains.map(t => TrainAPIService.refreshRealtimeData(t))
    );
    setSavedTrains(updated);
  }, 30000);
  
  return () => clearInterval(interval);
}, [savedTrains]);
```

### Filter trains by region

```typescript
const visibleTrains = trains.filter(train => {
  const pos = train.realtime?.position;
  if (!pos) return false;
  
  return (
    pos.lat >= bounds.minLat && pos.lat <= bounds.maxLat &&
    pos.lon >= bounds.minLon && pos.lon <= bounds.maxLon
  );
});
```

## 🐛 Troubleshooting

**No trains showing?**
```bash
# Check if endpoint is reachable
curl -I https://asm-backend.transitdocs.com/gtfs/amtrak

# Clear cache and retry
RealtimeService.clearCache();
```

**TypeScript errors?**
```bash
# Check for compile errors
npx tsc --noEmit
```

**Need fresh data?**
```typescript
// Force cache refresh
RealtimeService.clearCache();
const positions = await RealtimeService.getAllPositions();
```

## 📊 Performance

- **Cache TTL:** 15 seconds
- **Active trains:** ~150-160
- **Update frequency:** Real-time (polled every 15s)
- **Parse time:** ~50-100ms per fetch
- **Memory usage:** ~2-3MB for all positions

## 🎉 That's It!

You now have live Amtrak train tracking integrated into your app. Check the full guides for advanced usage and customization options.

**Happy tracking! 🚂**
