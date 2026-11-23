import 'zone.js';
import 'zone.js/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { CollectionsApiService } from '../../../../core/services/collections-api.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { SlugService } from '../../../../shared/services/slug.service';
import { SidebarCollectionsTreeComponent } from './sidebar-collections-tree.component';

describe('SidebarCollectionsTreeComponent — linki wariantów', () => {
    let fixture: ComponentFixture<SidebarCollectionsTreeComponent>;
    let router: {
        navigate: ReturnType<typeof vi.fn>;
        url: string;
        events: Subject<unknown>;
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        router = {
            navigate: vi.fn(),
            url: '/collections',
            events: new Subject<unknown>(),
        };

        await TestBed.configureTestingModule({
            imports: [SidebarCollectionsTreeComponent],
            providers: [
                provideRouter([]),
                { provide: Router, useValue: router },
                {
                    provide: CollectionsApiService,
                    useValue: {
                        getCollections: vi.fn().mockReturnValue(of([])),
                        getCollectionRecipesForSidebar: vi.fn(),
                    },
                },
                {
                    provide: SupabaseService,
                    useValue: {
                        storage: {
                            from: vi.fn().mockReturnValue({
                                getPublicUrl: vi.fn().mockReturnValue({
                                    data: { publicUrl: null },
                                }),
                            }),
                        },
                    },
                },
                {
                    provide: SlugService,
                    useValue: { slugify: (value: string) => value.toLowerCase().replaceAll(' ', '-') },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SidebarCollectionsTreeComponent);
        fixture.detectChanges();
    });

    it('nawiguje bez parametru variant dla N=1', () => {
        fixture.componentInstance.onNavigateToRecipe(7, 'Lasagne', 1);

        expect(router.navigate).toHaveBeenCalledWith(
            ['/recipes', '7-lasagne'],
            { queryParams: undefined }
        );
    });

    it('dodaje parametr variant dla N>=2', () => {
        fixture.componentInstance.onNavigateToRecipe(8, 'Lasagne', 2);

        expect(router.navigate).toHaveBeenCalledWith(
            ['/recipes', '8-lasagne'],
            { queryParams: { variant: 8 } }
        );
    });

    it('zachowuje regresję wsteczną, gdy pola PS-111 nie są obecne', () => {
        fixture.componentInstance.onNavigateToRecipe(9, 'Zupa');

        expect(router.navigate).toHaveBeenCalledWith(
            ['/recipes', '9-zupa'],
            { queryParams: undefined }
        );
    });
});
