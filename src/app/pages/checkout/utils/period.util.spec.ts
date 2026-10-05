import { describe, expect, it } from 'vitest';

import { calculatePeriodEnd } from './period.util';

describe('calculatePeriodEnd', () => {
    it('powinien dodać miesiąc do planu miesięcznego', () => {
        const result = calculatePeriodEnd('premium_monthly', new Date(2026, 8, 15, 12));

        expect(result).toEqual(new Date(2026, 9, 15, 12));
    });

    it('powinien obciąć dzień do końca krótszego miesiąca', () => {
        const result = calculatePeriodEnd('premium_monthly', new Date(2026, 0, 31, 12));

        expect(result).toEqual(new Date(2026, 1, 28, 12));
    });

    it('powinien uwzględnić luty roku przestępnego', () => {
        const result = calculatePeriodEnd('premium_monthly', new Date(2028, 0, 31, 12));

        expect(result).toEqual(new Date(2028, 1, 29, 12));
    });

    it('powinien dodać dwanaście miesięcy do planu rocznego', () => {
        const result = calculatePeriodEnd('premium_yearly', new Date(2026, 8, 30, 12));

        expect(result).toEqual(new Date(2027, 8, 30, 12));
    });

    it('powinien obciąć 29 lutego do 28 lutego kolejnego roku', () => {
        const result = calculatePeriodEnd('premium_yearly', new Date(2028, 1, 29, 12));

        expect(result).toEqual(new Date(2029, 1, 28, 12));
    });
});
