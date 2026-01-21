import {
  extractTrainNumber,
  normalizeTrainNumber,
  matchTrainNumber,
  formatTrainNumber,
} from '../../utils/train-helpers';

// Mock the gtfsParser
jest.mock('../../utils/gtfs-parser', () => ({
  gtfsParser: {
    getTrainNumber: jest.fn((tripId: string) => {
      // Simulate GTFS parser behavior
      if (tripId === 'Amtrak-43-20240104') return '43';
      if (tripId === '2151') return '2151';
      return tripId; // Fallback
    }),
  },
}));

describe('train-helpers utilities', () => {
  describe('extractTrainNumber', () => {
    it('should extract train number from GTFS trip ID', () => {
      expect(extractTrainNumber('Amtrak-43-20240104')).toBe('43');
    });

    it('should return train number directly if already a number', () => {
      expect(extractTrainNumber('2151')).toBe('2151');
    });

    it('should extract numeric portion as fallback', () => {
      // When gtfsParser returns the tripId unchanged, extract numbers
      expect(extractTrainNumber('train-123-xyz')).toMatch(/123/);
    });
  });

  describe('normalizeTrainNumber', () => {
    it('should remove leading zeros', () => {
      expect(normalizeTrainNumber('043')).toBe('43');
      expect(normalizeTrainNumber('0001')).toBe('1');
      expect(normalizeTrainNumber('2151')).toBe('2151');
    });

    it('should handle already normalized numbers', () => {
      expect(normalizeTrainNumber('43')).toBe('43');
      expect(normalizeTrainNumber('123')).toBe('123');
    });
  });

  describe('matchTrainNumber', () => {
    it('should match train numbers with different leading zeros', () => {
      expect(matchTrainNumber('43', '043')).toBe(true);
      expect(matchTrainNumber('001', '1')).toBe(true);
    });

    it('should match identical train numbers', () => {
      expect(matchTrainNumber('2151', '2151')).toBe(true);
      expect(matchTrainNumber('43', '43')).toBe(true);
    });

    it('should not match different train numbers', () => {
      expect(matchTrainNumber('43', '44')).toBe(false);
      expect(matchTrainNumber('2151', '2152')).toBe(false);
    });
  });

  describe('formatTrainNumber', () => {
    it('should format train number without leading zeros', () => {
      expect(formatTrainNumber('043')).toBe('43');
      expect(formatTrainNumber('2151')).toBe('2151');
      expect(formatTrainNumber('001')).toBe('1');
    });
  });
});
