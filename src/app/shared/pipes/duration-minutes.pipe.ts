import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe do formatowania czasu w minutach na czytelny string.
 * 
 * Przykłady:
 * - 0 → "0 min"
 * - 45 → "45 min"
 * - 60 → "1 h"
 * - 90 → "1 h 30 min"
 * - 120 → "2 h"
 * - null/undefined → null (nie renderować)
 * 
 * @example
 * {{ 45 | durationMinutes }} // "45 min"
 * {{ 90 | durationMinutes }} // "1 h 30 min"
 */
@Pipe({
    name: 'durationMinutes',
    standalone: true,
})
export class DurationMinutesPipe implements PipeTransform {
    transform(minutes: number | null | undefined): string | null {
        // Jeśli wartość jest null lub undefined, nie renderujemy
        if (minutes === null || minutes === undefined) {
            return null;
        }

        // Przypadek 0 minut
        if (minutes === 0) {
            return '0 min';
        }

        // Przypadek < 60 minut (tylko minuty)
        if (minutes < 60) {
            return `${minutes} min`;
        }

        // Przypadek >= 60 minut (godziny + minuty)
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (remainingMinutes === 0) {
            // Pełne godziny (np. "2 h")
            return `${hours} h`;
        } else {
            // Godziny + minuty (np. "1 h 30 min")
            return `${hours} h ${remainingMinutes} min`;
        }
    }
}


