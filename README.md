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

- Node.js 20+ (recommended for full compatibility)
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

1. Install dependencies:

   ```bash
   npm install --legacy-peer-deps
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

## Development

### Available Scripts

```bash
# Development
npm start              # Start Expo development server
npm run android        # Start on Android emulator
npm run ios            # Start on iOS simulator

# Code Quality
npm run type-check     # Run TypeScript type checking
npm run lint           # Run ESLint
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting

# Testing
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report

# Validation
npm run validate       # Run all quality checks (type-check + format + lint + test)
```

### Code Quality Standards

This project maintains high code quality with:

- **TypeScript**: Strict mode enabled for type safety
- **ESLint**: Expo preset with custom rules
- **Prettier**: Automated code formatting (120 line width, single quotes)
- **Jest**: Unit and integration tests with 40% coverage threshold
- **CI/CD**: Automated testing on all pull requests via GitHub Actions

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Test Coverage Status**: 47 passing tests across 4 suites

- Time formatting utilities
- Date helpers
- Train number extraction
- Logger utility

### Pre-commit Quality Checks

Before committing, run:

```bash
npm run validate
```

This ensures:

- ✅ TypeScript compiles without errors
- ✅ Code is properly formatted
- ✅ ESLint rules pass
- ✅ All tests pass

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

### Utilities

| Utility                 | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `time-formatting.ts`    | Time parsing and formatting (12/24-hour)       |
| `date-helpers.ts`       | Date calculations and formatting               |
| `train-helpers.ts`      | Train number extraction and normalization      |
| `logger.ts`             | Centralized logging with environment awareness |
| `gtfs-parser.ts`        | GTFS static data parsing                       |
| `route-colors.ts`       | Route color schemes                            |
| `station-clustering.ts` | Smart station marker clustering                |
| `train-clustering.ts`   | Train marker clustering                        |

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

### Core Framework

- **React Native** 0.81 with **React** 19
- **Expo** 54 with Expo Router
- **TypeScript** 5.9 (strict mode)

### UI & Animation

- **react-native-maps** for map rendering
- **react-native-reanimated** 4.1 for 60fps animations
- **react-native-gesture-handler** for gestures
- **lucide-react-native** for icons

### Data & APIs

- **gtfs-realtime-bindings** for protobuf parsing
- **AsyncStorage** for local persistence
- **Transitdocs GTFS-RT API** for real-time train positions
- **Amtrak GTFS** for schedule data

### Development Tools

- **Jest** 30 with React Native Testing Library
- **ESLint** 9 with Expo config
- **Prettier** 3.8 for code formatting
- **Zod** 4.3 for runtime validation
- **GitHub Actions** for CI/CD

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

## Code Quality & Testing

### Testing Infrastructure

This project uses Jest with React Native Testing Library for comprehensive testing:

- **Unit Tests**: Utility functions, helpers, and services
- **Integration Tests**: Hooks and context providers
- **Component Tests**: UI components and screens

**Coverage Thresholds**:

- Statements: 40%
- Branches: 30%
- Functions: 40%
- Lines: 40%

### CI/CD Pipeline

Every push and pull request runs:

1. TypeScript type checking (`tsc --noEmit`)
2. ESLint code quality checks
3. Prettier formatting validation
4. Full test suite with coverage reporting
5. Coverage uploaded to Codecov with PR comments

### Logging

Centralized logging utility with environment-aware behavior:

```typescript
import { logger } from './utils/logger';

// Debug and info logs only appear in development
logger.debug('Detailed debug info', data);
logger.info('Informational message');

// Warnings and errors appear in all environments
logger.warn('Warning message');
logger.error('Error occurred', error);
```

**Features**:

- Environment-aware (dev-only debug/info)
- In-memory log storage (last 100 entries)
- Export logs for debugging
- Ready for crash reporting integration (Sentry, Bugsnag)

### Data Validation

Runtime validation with Zod schemas for external data:

```typescript
import { TrainPositionSchema, StopSchema } from './types/gtfs-schemas';

// Validate GTFS-RT position data
const position = TrainPositionSchema.safeParse(rawPosition);
if (!position.success) {
  logger.error('Invalid train position', position.error);
  return null;
}
```

**Available Schemas**:

- `TrainPositionSchema` - GPS coordinates and bearing
- `RealtimePositionSchema` - GTFS-RT vehicle positions
- `RealtimeUpdateSchema` - Trip updates and delays
- `StopSchema`, `RouteSchema`, `TripSchema` - GTFS static data

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Code Quality**: Run `npm run validate` before committing
2. **Tests**: Add tests for new features or bug fixes
3. **Formatting**: Code is auto-formatted with Prettier
4. **Type Safety**: Maintain strict TypeScript compliance
5. **Pull Requests**: CI must pass before merging

### Development Workflow

```bash
# 1. Create a feature branch
git checkout -b feature/my-feature

# 2. Make changes and write tests
npm run test:watch

# 3. Validate code quality
npm run validate

# 4. Format code
npm run format

# 5. Commit and push
git add .
git commit -m "feat: add my feature"
git push origin feature/my-feature
```

The CI pipeline will automatically run all quality checks on your pull request.

## License

MIT
