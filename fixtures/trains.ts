/**
 * Test fixtures and default data for development
 */
import { Train } from '../types/train';

export const DEFAULT_TRAIN: Train = {
  id: 43,
  airline: 'AMTK',
  flightNumber: '43',
  from: 'New York',
  to: 'Pittsburgh',
  fromCode: 'NYP',
  toCode: 'PGH',
  departTime: '11:05 AM',
  arriveTime: '7:40 PM',
  date: 'Today',
  daysAway: 0,
  routeName: 'Pennsylvanian',
  intermediateStops: [
    { time: '11:50 AM', name: 'Newark', code: 'NWK' },
    { time: '1:03 PM', name: 'Philadelphia', code: 'PHL' },
    { time: '2:22 PM', name: 'Harrisburg', code: 'HAR' },
    { time: '4:52 PM', name: 'Altoona', code: 'AOO' },
  ],
};

export const SAMPLE_TRAINS: Train[] = [DEFAULT_TRAIN];
