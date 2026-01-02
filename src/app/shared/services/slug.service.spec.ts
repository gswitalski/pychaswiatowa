import { describe, it, expect, beforeEach } from 'vitest';
import { SlugService } from './slug.service';

describe('SlugService', () => {
    let service: SlugService;

    beforeEach(() => {
        service = new SlugService();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('slugify', () => {
        describe('podstawowe transformacje', () => {
            it('powinien konwertować tekst na lowercase', () => {
                expect(service.slugify('WIELKIE LITERY')).toBe('wielkie-litery');
                expect(service.slugify('MiXeD CaSe')).toBe('mixed-case');
            });

            it('powinien zamieniać spacje na myślniki', () => {
                expect(service.slugify('biała kiełbasa')).toBe('biala-kielbasa');
                expect(service.slugify('przepis na ciasto')).toBe('przepis-na-ciasto');
            });

            it('powinien usuwać znaki specjalne', () => {
                expect(service.slugify('przepis!')).toBe('przepis');
                expect(service.slugify('test@#$%^&*()')).toBe('test');
                expect(service.slugify('hello, world!')).toBe('hello-world');
            });
        });

        describe('polskie znaki diakrytyczne', () => {
            it('powinien transliterować małe polskie litery', () => {
                expect(service.slugify('ą')).toBe('a');
                expect(service.slugify('ć')).toBe('c');
                expect(service.slugify('ę')).toBe('e');
                expect(service.slugify('ł')).toBe('l');
                expect(service.slugify('ń')).toBe('n');
                expect(service.slugify('ó')).toBe('o');
                expect(service.slugify('ś')).toBe('s');
                expect(service.slugify('ż')).toBe('z');
                expect(service.slugify('ź')).toBe('z');
            });

            it('powinien transliterować duże polskie litery', () => {
                expect(service.slugify('Ą')).toBe('a');
                expect(service.slugify('Ć')).toBe('c');
                expect(service.slugify('Ę')).toBe('e');
                expect(service.slugify('Ł')).toBe('l');
                expect(service.slugify('Ń')).toBe('n');
                expect(service.slugify('Ó')).toBe('o');
                expect(service.slugify('Ś')).toBe('s');
                expect(service.slugify('Ż')).toBe('z');
                expect(service.slugify('Ź')).toBe('z');
            });

            it('powinien transliterować pełne polskie wyrazy', () => {
                expect(service.slugify('Biała kiełbasa z jabłkami')).toBe('biala-kielbasa-z-jablkami');
                expect(service.slugify('Żurek na śmietanie')).toBe('zurek-na-smietanie');
                expect(service.slugify('Łosoś wędzony')).toBe('losos-wedzony');
                expect(service.slugify('Gołąbki z kaszą')).toBe('golabki-z-kasza');
            });
        });

        describe('wielokrotne separatory', () => {
            it('powinien redukować wielokrotne myślniki do pojedynczego', () => {
                expect(service.slugify('test--slug')).toBe('test-slug');
                expect(service.slugify('test---slug')).toBe('test-slug');
                expect(service.slugify('test    slug')).toBe('test-slug');
            });

            it('powinien usuwać myślniki z początku i końca', () => {
                expect(service.slugify('-test')).toBe('test');
                expect(service.slugify('test-')).toBe('test');
                expect(service.slugify('-test-')).toBe('test');
                expect(service.slugify('---test---')).toBe('test');
            });

            it('powinien obsługiwać kombinacje spacji i znaków specjalnych', () => {
                expect(service.slugify('  hello   world  ')).toBe('hello-world');
                expect(service.slugify('test!!!slug')).toBe('test-slug');
            });
        });

        describe('limit długości', () => {
            it('powinien obcinać długie teksty do 80 znaków (domyślnie)', () => {
                const longText = 'a'.repeat(100);
                const result = service.slugify(longText);
                expect(result.length).toBeLessThanOrEqual(80);
            });

            it('powinien obcinać do niestandardowej długości', () => {
                const longText = 'a'.repeat(100);
                const result = service.slugify(longText, { maxLength: 20 });
                expect(result.length).toBeLessThanOrEqual(20);
            });

            it('powinien usuwać myślnik na końcu po obcięciu', () => {
                const text = 'test slug very long name that will be truncated';
                const result = service.slugify(text, { maxLength: 15 });
                expect(result).not.toMatch(/-$/);
                expect(result.length).toBeLessThanOrEqual(15);
            });

            it('nie powinien obcinać krótkich tekstów', () => {
                const text = 'short';
                expect(service.slugify(text, { maxLength: 80 })).toBe('short');
            });
        });

        describe('fallback', () => {
            it('powinien zwrócić domyślny fallback dla pustego tekstu', () => {
                expect(service.slugify('')).toBe('przepis');
                expect(service.slugify('   ')).toBe('przepis');
            });

            it('powinien zwrócić domyślny fallback dla tekstu składającego się tylko ze znaków specjalnych', () => {
                expect(service.slugify('!!!')).toBe('przepis');
                expect(service.slugify('@#$%')).toBe('przepis');
                expect(service.slugify('---')).toBe('przepis');
            });

            it('powinien zwrócić niestandardowy fallback', () => {
                expect(service.slugify('', { fallback: 'custom' })).toBe('custom');
                expect(service.slugify('!!!', { fallback: 'default-slug' })).toBe('default-slug');
            });

            it('powinien zwrócić fallback dla null/undefined', () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                expect(service.slugify(null as any)).toBe('przepis');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                expect(service.slugify(undefined as any)).toBe('przepis');
            });
        });

        describe('przypadki brzegowe', () => {
            it('powinien obsługiwać tekst z samymi cyframi', () => {
                expect(service.slugify('123')).toBe('123');
                expect(service.slugify('2024')).toBe('2024');
            });

            it('powinien obsługiwać tekst z cyframi i literami', () => {
                expect(service.slugify('przepis 123')).toBe('przepis-123');
                expect(service.slugify('top 10 przepisów')).toBe('top-10-przepisow');
            });

            it('powinien zachowywać myślniki w tekście', () => {
                expect(service.slugify('test-slug')).toBe('test-slug');
                expect(service.slugify('foo-bar-baz')).toBe('foo-bar-baz');
            });

            it('powinien obsługiwać emoji i unicode (usuwać je)', () => {
                expect(service.slugify('test 🍕 pizza')).toBe('test-pizza');
                expect(service.slugify('hello 😊 world')).toBe('hello-world');
            });

            it('powinien obsługiwać tekst z nawiasami', () => {
                expect(service.slugify('przepis (wersja 2)')).toBe('przepis-wersja-2');
                expect(service.slugify('[test] slug')).toBe('test-slug');
            });
        });

        describe('rzeczywiste przykłady przepisów', () => {
            it('powinien generować poprawne slug\'i dla typowych nazw przepisów', () => {
                expect(service.slugify('Biała kiełbasa z jabłkami')).toBe('biala-kielbasa-z-jablkami');
                expect(service.slugify('Pierogi z mięsem')).toBe('pierogi-z-miesem');
                expect(service.slugify('Rosół z kury')).toBe('rosol-z-kury');
                expect(service.slugify('Bigos staropolski')).toBe('bigos-staropolski');
                expect(service.slugify('Sernik na zimno')).toBe('sernik-na-zimno');
            });

            it('powinien obsługiwać nazwy z liczbami', () => {
                expect(service.slugify('Ciasto 3 bit')).toBe('ciasto-3-bit');
                expect(service.slugify('Top 10 przepisów na lato')).toBe('top-10-przepisow-na-lato');
            });

            it('powinien obsługiwać nazwy z cudzysłowami i apostrofami', () => {
                expect(service.slugify('"Najlepszy" przepis')).toBe('najlepszy-przepis');
                expect(service.slugify("Mama's recipe")).toBe('mama-s-recipe');
            });
        });
    });
});

