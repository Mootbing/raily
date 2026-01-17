/**
 * GTFS weekly sync service
 * - Checks freshness (7 days)
 * - Fetches GTFS.zip from Amtrak
 * - Unzips in memory (fflate) and parses CSVs
 * - Caches parsed JSON in AsyncStorage
 * - Applies cached data to the GTFS parser
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { strFromU8, unzipSync } from 'fflate';
import type { Route, Stop, StopTime } from '../types/train';
import { gtfsParser } from '../utils/gtfs-parser';

const GTFS_URL = 'https://content.amtrak.com/content/gtfs/GTFS.zip';

const STORAGE_KEYS = {
  LAST_FETCH: 'GTFS_LAST_FETCH',
  ROUTES: 'GTFS_ROUTES_JSON',
  STOPS: 'GTFS_STOPS_JSON',
  STOP_TIMES: 'GTFS_STOP_TIMES_JSON',
  SHAPES: 'GTFS_SHAPES_JSON',
};

function isOlderThanDays(dateMs: number, days: number): boolean {
  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000;
  return now - dateMs > ms;
}

function safeJSONParse<T>(text: string | null): T | null {
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

// Basic CSV parser that respects quoted fields
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCSVLine(lines[0]);
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cols[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { // escaped quote
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  // Trim outer quotes
  return result.map(v => v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);
}

async function fetchZipBytes(): Promise<Uint8Array> {
  const res = await fetch(GTFS_URL);
  if (!res.ok) throw new Error(`GTFS fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function buildRoutes(rows: Array<Record<string, string>>): Route[] {
  return rows.map(r => ({
    route_id: r['route_id'],
    agency_id: r['agency_id'] || undefined,
    route_short_name: r['route_short_name'] || undefined,
    route_long_name: r['route_long_name'] || r['route_short_name'] || r['route_id'],
    route_type: r['route_type'] || undefined,
    route_url: r['route_url'] || undefined,
    route_color: r['route_color'] || undefined,
    route_text_color: r['route_text_color'] || undefined,
  })).filter(r => !!r.route_id);
}

function buildStops(rows: Array<Record<string, string>>): Stop[] {
  return rows.map(r => ({
    stop_id: r['stop_id'],
    stop_name: r['stop_name'],
    stop_url: r['stop_url'] || undefined,
    stop_timezone: r['stop_timezone'] || undefined,
    stop_lat: parseFloat(r['stop_lat']),
    stop_lon: parseFloat(r['stop_lon']),
  })).filter(s => !!s.stop_id && !!s.stop_name);
}

function buildStopTimes(rows: Array<Record<string, string>>): Record<string, StopTime[]> {
  const grouped: Record<string, StopTime[]> = {};
  for (const r of rows) {
    const trip_id = r['trip_id'];
    if (!trip_id) continue;
    const st: StopTime = {
      trip_id,
      arrival_time: r['arrival_time'],
      departure_time: r['departure_time'],
      stop_id: r['stop_id'],
      stop_sequence: parseInt(r['stop_sequence'] || '0', 10),
      pickup_type: r['pickup_type'] ? parseInt(r['pickup_type'], 10) : undefined,
      drop_off_type: r['drop_off_type'] ? parseInt(r['drop_off_type'], 10) : undefined,
      timepoint: r['timepoint'] ? parseInt(r['timepoint'], 10) : undefined,
    };
    if (!grouped[trip_id]) grouped[trip_id] = [];
    grouped[trip_id].push(st);
  }
  // sort sequences per trip
  Object.values(grouped).forEach(arr => arr.sort((a, b) => a.stop_sequence - b.stop_sequence));
  return grouped;
}

function buildShapes(rows: Array<Record<string, string>>): Record<string, Shape[]> {
  const grouped: Record<string, Shape[]> = {};
  for (const r of rows) {
    const shape_id = r['shape_id'];
    if (!shape_id) continue;
    const shape: Shape = {
      shape_id,
      shape_pt_lat: parseFloat(r['shape_pt_lat']),
      shape_pt_lon: parseFloat(r['shape_pt_lon']),
      shape_pt_sequence: parseInt(r['shape_pt_sequence'] || '0', 10),
    };
    if (!grouped[shape_id]) grouped[shape_id] = [];
    grouped[shape_id].push(shape);
  }
  // sort by sequence
  Object.values(grouped).forEach(arr => arr.sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence));
  return grouped;
}

export async function ensureFreshGTFS(): Promise<{ usedCache: boolean }> {
  try {
    const lastFetchStr = await AsyncStorage.getItem(STORAGE_KEYS.LAST_FETCH);
    const lastFetchMs = lastFetchStr ? parseInt(lastFetchStr, 10) : 0;

    // If cache is fresh, apply and return
    if (lastFetchMs && !isOlderThanDays(lastFetchMs, 7)) {
      const routes = safeJSONParse<Route[]>(await AsyncStorage.getItem(STORAGE_KEYS.ROUTES));
      const stops = safeJSONParse<Stop[]>(await AsyncStorage.getItem(STORAGE_KEYS.STOPS));
      const stopTimes = safeJSONParse<Record<string, StopTime[]>>(await AsyncStorage.getItem(STORAGE_KEYS.STOP_TIMES));
      const shapes = safeJSONParse<Record<string, Shape[]>>(await AsyncStorage.getItem(STORAGE_KEYS.SHAPES));
      if (routes && stops && stopTimes) {
        gtfsParser.overrideData(routes, stops, stopTimes, shapes || {});
        return { usedCache: true };
      }
    }

    // Fetch and rebuild cache
    const zipBytes = await fetchZipBytes();
    const files = unzipSync(zipBytes);

    const routesTxt = files['routes.txt'] ? strFromU8(files['routes.txt']) : '';
    const stopsTxt = files['stops.txt'] ? strFromU8(files['stops.txt']) : '';
    const stopTimesTxt = files['stop_times.txt'] ? strFromU8(files['stop_times.txt']) : '';
    const shapesTxt = files['shapes.txt'] ? strFromU8(files['shapes.txt']) : '';

    if (!routesTxt || !stopsTxt || !stopTimesTxt) {
      throw new Error('Missing expected GTFS files (routes/stops/stop_times)');
    }

    const routes = buildRoutes(parseCSV(routesTxt));
    const stops = buildStops(parseCSV(stopsTxt));
    const stopTimes = buildStopTimes(parseCSV(stopTimesTxt));
    const shapes = shapesTxt ? buildShapes(parseCSV(shapesTxt)) : {};

    await AsyncStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(routes));
    await AsyncStorage.setItem(STORAGE_KEYS.STOPS, JSON.stringify(stops));
    await AsyncStorage.setItem(STORAGE_KEYS.STOP_TIMES, JSON.stringify(stopTimes));
    await AsyncStorage.setItem(STORAGE_KEYS.SHAPES, JSON.stringify(shapes));
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_FETCH, String(Date.now()));

    gtfsParser.overrideData(routes, stops, stopTimes, shapes);
    return { usedCache: false };
  } catch (err) {
    console.warn('GTFS sync failed; falling back to bundled assets.', err);
    return { usedCache: true };
  }
}

export async function hasCachedGTFS(): Promise<boolean> {
  const routes = await AsyncStorage.getItem(STORAGE_KEYS.ROUTES);
  const stops = await AsyncStorage.getItem(STORAGE_KEYS.STOPS);
  const stopTimes = await AsyncStorage.getItem(STORAGE_KEYS.STOP_TIMES);
  return !!(routes && stops && stopTimes);
}

export async function isCacheStale(): Promise<boolean> {
  const lastFetchStr = await AsyncStorage.getItem(STORAGE_KEYS.LAST_FETCH);
  const lastFetchMs = lastFetchStr ? parseInt(lastFetchStr, 10) : 0;
  return !lastFetchMs || isOlderThanDays(lastFetchMs, 7);
}
