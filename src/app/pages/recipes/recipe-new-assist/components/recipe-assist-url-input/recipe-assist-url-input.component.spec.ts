import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import {
    RecipeAssistUrlInputComponent,
    urlValidator,
} from './recipe-assist-url-input.component';

describe('RecipeAssistUrlInputComponent', () => {
    it('akceptuje poprawny adres https', () => {
        const control = new RecipeAssistUrlInputComponent().urlControl;

        control.setValue('https://example.com/przepis');

        expect(control.valid).toBe(true);
    });

    it('odrzuca adres bez protokołu i zbyt długi adres', () => {
        expect(urlValidator({ value: 'example.com/przepis' } as never)).toEqual({
            urlNoProtocol: true,
        });
        expect(urlValidator({ value: `https://${'a'.repeat(2041)}.pl` } as never)).toEqual({
            urlTooLong: true,
        });
    });

    it('emituje null dla pustej lub niepoprawnej wartości', () => {
        const component = new RecipeAssistUrlInputComponent();
        let emitted: string | null | undefined;
        component.urlChange.subscribe((value) => (emitted = value));

        component.urlControl.setValue('not-a-url');
        expect(emitted).toBeNull();

        component.urlControl.setValue('');
        expect(emitted).toBeNull();
    });

    it('dezaktywuje kontrolkę po ustawieniu disabled', () => {
        const component = new RecipeAssistUrlInputComponent();

        component.disabled = true;
        component.ngOnChanges({
            disabled: {
                currentValue: true,
                previousValue: false,
                firstChange: true,
                isFirstChange: () => true,
            },
        });

        expect(component.urlControl.disabled).toBe(true);
    });
});
