/**
 * Test script for real-time GTFS integration
 * Run with: npx tsx test-realtime.ts
 */

import { RealtimeService } from './services/realtime';

async function testRealtimeIntegration() {
  console.log('🚂 Testing Transitdocs GTFS-RT Integration...\n');

  try {
    // Test 1: Get all active trains
    console.log('📍 Fetching all active train positions...');
    const activeTrains = await RealtimeService.getAllActiveTrains();
    console.log(`✅ Found ${activeTrains.length} active trains\n`);

    if (activeTrains.length > 0) {
      // Show first 5 trains
      const sample = activeTrains.slice(0, 5);
      console.log('Sample trains:');
      sample.forEach(({ trainNumber, position }) => {
        console.log(`  Train ${trainNumber}:`);
        console.log(`    Position: ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`);
        console.log(`    Speed: ${position.speed?.toFixed(1) || 'N/A'} mph`);
        console.log(`    Bearing: ${position.bearing?.toFixed(0) || 'N/A'}°`);
        console.log(`    Updated: ${new Date(position.timestamp).toLocaleTimeString()}\n`);
      });
    }

    // Test 2: Query specific train (try train 543 from example)
    console.log('🔍 Testing specific train lookup (train 543)...');
    const position543 = await RealtimeService.getPositionForTrip('543');
    if (position543) {
      console.log('✅ Found train 543:');
      console.log(`  Position: ${position543.latitude}, ${position543.longitude}`);
      console.log(`  Trip ID: ${position543.trip_id}`);
    } else {
      console.log('⚠️  Train 543 not currently active\n');
    }

    // Test 3: Get trip updates (delays)
    console.log('\n⏱️  Testing trip updates (delays)...');
    const allUpdates = await RealtimeService.getAllUpdates();
    console.log(`✅ Found updates for ${allUpdates.size} trips\n`);

    if (allUpdates.size > 0) {
      const [firstTripId, firstUpdates] = Array.from(allUpdates.entries())[0];
      console.log(`Sample updates for trip ${firstTripId}:`);
      firstUpdates.slice(0, 3).forEach(update => {
        if (update.stop_id) {
          const delayMin = update.departure_delay ? Math.round(update.departure_delay / 60) : 0;
          console.log(`  Stop ${update.stop_id}: ${RealtimeService.formatDelay(delayMin)}`);
        }
      });
    }

    console.log('\n✨ Real-time integration test complete!');
  } catch (error) {
    console.error('❌ Error testing real-time integration:', error);
    process.exit(1);
  }
}

// Run the test
testRealtimeIntegration();
