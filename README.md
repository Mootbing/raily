# Tracky

A real-time Amtrak train tracking app built with React Native and Expo. Track train positions, view schedules, save favorite trains, and explore station departure boards with live GTFS-RT data.

## Features

### Interactive Map

- Full-screen map interface with train and station markers
- Real-time train positions updated every 15 seconds
- Color-coded route polylines for each train
- Smart station clustering that adapts to zoom level
- Standard and satellite map views
- GPS-based user location with recenter button

### Live Train Tracking

- Real-time positions from Transitdocs GTFS-RT feed
- Train bearing, speed, and delay information
- Named train routes (Acela, Southwest Chief, Coast Starlight, etc.)
- Automatic refresh every 15 seconds with 15-second cache

### Saved Trains

- Save favorite trains for quick access
- Support for partial trip segments (e.g., Boston to NYC only)
- Persistent storage across app sessions
- Real-time updates for saved trains every 20 seconds
- Swipe-to-delete with haptic feedback

### Train Details

- Complete trip information with departure/arrival times
- Multi-day journey support with day offset indicators
- Intermediate stops with arrival times
- Real-time delay status
- Tap stations to view their departure boards

### Station Departure Boards

- View all arrivals and departures for any station
- Filter by arrivals, departures, or all
- Date picker for future schedules
- Search within station departures
- Tap trains to view full details

### Search

- Search trains by number or route name
- Search stations by name or code
- Two-station trip search with date selection
- Real-time autocomplete results

### Map Settings

Quick-access settings panel with:

- **Route Mode**: Show/hide train route lines
- **Station Mode**: Off, Compact (clustered), or All stations
- **Train Mode**: Off, Saved trains only, or All trains
- **Map Type**: Standard or Satellite view

## Getting Started

### Prerequisites

- Node.js 18+
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
   - Scan QR code with Expo Go on your device

Note: Web is not supported. This app targets iOS and Android only.

## Architecture

### Project Structure

```
tracky/
├── app/                    # Expo Router screens
├── components/
│   ├── map/                # Map markers and overlays
│   └── ui/                 # Modals, lists, and controls
├── context/                # React Context providers
├── hooks/                  # Custom React hooks
├── services/               # Business logic and APIs
├── utils/                  # Helpers and parsers
├── types/                  # TypeScript definitions
├── assets/                 # Static assets and GTFS cache
└── constants/              # Theme and configuration
```

### Services

| Service             | Purpose                          |
| ------------------- | -------------------------------- |
| `realtime.ts`       | GTFS-RT feed parsing and caching |
| `api.ts`            | High-level train data API        |
| `gtfs-sync.ts`      | Weekly GTFS schedule sync        |
| `storage.ts`        | AsyncStorage persistence         |
| `shape-loader.ts`   | Viewport-based route loading     |
| `station-loader.ts` | Viewport-based station loading   |

### State Management

- **TrainContext**: Manages saved trains and selected train state
- **ModalContext**: Handles modal navigation stack and transitions

### Data Flow

```
Transitdocs GTFS-RT Feed
         │
    [Protobuf Parser]
         │
     [15s Cache]
         │
   [Train Matching]
         │
     [Map Markers]
```

### GTFS Data Sync

On app startup:

1. Checks if cached GTFS data exists and is fresh (< 7 days old)
2. If stale, fetches `GTFS.zip` from Amtrak
3. Parses `routes.txt`, `stops.txt`, `stop_times.txt`, and `shapes.txt`
4. Stores compressed JSON locally for offline access

## Performance Optimizations

- **Viewport Culling**: Only loads visible routes and stations
- **Throttled Updates**: Region changes throttled to 100ms
- **Debounced Loading**: Viewport bounds updates debounced to 250ms
- **Real-Time Cache**: 15-second TTL prevents redundant API calls
- **Smart Clustering**: Reduces marker count at lower zoom levels
- **Reanimated Animations**: 60fps modal and marker transitions

## Tech Stack

- **React Native** 0.81 with **React** 19
- **Expo** 54 with Expo Router
- **TypeScript** 5.9
- **react-native-maps** for map rendering
- **react-native-reanimated** for animations
- **gtfs-realtime-bindings** for protobuf parsing
- **AsyncStorage** for persistence

## API Usage

### Get All Active Trains

```typescript
import { RealtimeService } from './services/realtime';

const trains = await RealtimeService.getAllActiveTrains();
```

### Get Train Position

```typescript
const position = await RealtimeService.getPositionForTrip('543');
// Supports train numbers ("543") or trip IDs ("2026-01-16_AMTK_543")
```

### Search Stations

```typescript
import { TrainAPIService } from './services/api';

const stations = await TrainAPIService.searchStations('Boston');
```

### Find Trips Between Stations

```typescript
const trips = await TrainAPIService.findTripsWithStops('BOS', 'NYP');
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT
