# Raily 🚂

A real-time Amtrak train tracking app built with React Native and Expo. Track train positions, delays, and routes with live GTFS-RT data from Transitdocs.

## Features

- 🗺️ **Interactive Map** - View Amtrak routes and stations on an interactive map
- 📍 **Live Train Positions** - See real-time locations of all active Amtrak trains
- ⏱️ **Delay Information** - Get up-to-date delay and schedule information
- 🔍 **Search** - Find trains, routes, and stations quickly
- 💾 **Save Trains** - Track your favorite trains and get live updates

## Get Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npx expo start
   ```

3. Open the app:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your phone

Note: Web is not supported. This app targets iOS and Android only.

## Real-Time GTFS Integration

This app uses the [Transitdocs GTFS-RT feed](https://asm-backend.transitdocs.com/gtfs/amtrak) to provide live train positions and delays.

### How It Works

1. **Data Fetching** - Every 15 seconds, the app fetches the latest GTFS-RT protobuf data
2. **Train Matching** - Trains are matched by train number (e.g., "543") extracted from trip IDs
3. **Position Updates** - Live positions (lat/lon, speed, bearing) are displayed on the map
4. **Delay Tracking** - Real-time delay information is shown for each stop

### Testing Real-Time Integration

Run the test script to verify the integration:

```bash
npx tsx test-realtime.ts
```

This will:
- Fetch all active train positions
- Display sample train data (position, speed, bearing)
- Check for delay information
- Verify train number matching

### API Usage

#### Get All Active Trains

```typescript
import { TrainAPIService } from './services/api';

const trains = await TrainAPIService.getActiveTrains();
// Returns array of Train objects with real-time positions
```

#### Get Position for Specific Train

```typescript
import { RealtimeService } from './services/realtime';

const position = await RealtimeService.getPositionForTrip('543');
// Supports both train numbers ("543") and trip IDs ("2026-01-16_AMTK_543")
```

#### Refresh Real-Time Data

```typescript
const updatedTrain = await TrainAPIService.refreshRealtimeData(train);
// Updates position and delay information
```

## Architecture

### Services

- **`services/realtime.ts`** - GTFS-RT feed parser and cache manager
- **`services/api.ts`** - High-level API for train data and real-time enrichment
- **`services/gtfs-sync.ts`** - Weekly GTFS schedule data sync
- **`services/shape-loader.ts`** - Efficient route shape viewport culling
- **`services/station-loader.ts`** - Station visibility optimization

### Data Flow

```
Transitdocs GTFS-RT Feed
         ↓
   [Protobuf Parser]
         ↓
    [15s Cache]
         ↓
  [Train Matching]
         ↓
    [Map Markers]
```

### GTFS Data Sync

- On app startup, checks for fresh Amtrak GTFS schedule data
- If cache is missing or older than 7 days, fetches `GTFS.zip` from Amtrak
- Parses `routes.txt`, `stops.txt`, `stop_times.txt`, and `shapes.txt`
- Stores in local JSON files for offline access

## Technologies

- **React Native** - Cross-platform mobile framework
- **Expo** - Development toolchain
- **react-native-maps** - Interactive map component
- **gtfs-realtime-bindings** - GTFS-RT protobuf parser
- **TypeScript** - Type safety and better DX

## Project Structure

```
raily/
├── app/               # Screen components (Expo Router)
├── components/        # Reusable UI components
├── services/          # Business logic and API clients
├── utils/             # Helper functions and parsers
├── types/             # TypeScript type definitions
├── assets/            # Static assets and cached GTFS data
└── constants/         # Theme and configuration
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

---

Built with ❤️ using Expo and React Native
