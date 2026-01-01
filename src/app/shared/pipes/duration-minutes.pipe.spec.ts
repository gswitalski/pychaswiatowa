import { DurationMinutesPipe } from './duration-minutes.pipe';

describe('DurationMinutesPipe', () => {
    let pipe: DurationMinutesPipe;

    beforeEach(() => {
        pipe = new DurationMinutesPipe();
    });

    it('should create an instance', () => {
        expect(pipe).toBeTruthy();
    });

    it('should return null for null input', () => {
        expect(pipe.transform(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
        expect(pipe.transform(undefined)).toBeNull();
    });

    it('should format 0 minutes as "0 min"', () => {
        expect(pipe.transform(0)).toBe('0 min');
    });

    it('should format minutes less than 60 as "X min"', () => {
        expect(pipe.transform(1)).toBe('1 min');
        expect(pipe.transform(30)).toBe('30 min');
        expect(pipe.transform(45)).toBe('45 min');
        expect(pipe.transform(59)).toBe('59 min');
    });

    it('should format exact hours as "X h"', () => {
        expect(pipe.transform(60)).toBe('1 h');
        expect(pipe.transform(120)).toBe('2 h');
        expect(pipe.transform(180)).toBe('3 h');
    });

    it('should format hours with minutes as "X h Y min"', () => {
        expect(pipe.transform(61)).toBe('1 h 1 min');
        expect(pipe.transform(90)).toBe('1 h 30 min');
        expect(pipe.transform(125)).toBe('2 h 5 min');
        expect(pipe.transform(150)).toBe('2 h 30 min');
    });

    it('should handle edge case of 999 minutes (max value)', () => {
        expect(pipe.transform(999)).toBe('16 h 39 min');
    });
});


