import {
    Component,
    ChangeDetectionStrategy,
    inject,
    signal,
    computed,
    OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/services/auth.service';
import { PublicRecipesSearchComponent } from '../landing/components/public-recipes-search/public-recipes-search';

/**
 * Komponent strony Explore - publiczny katalog przepisów.
 * Umożliwia przeglądanie i wyszukiwanie publicznych przepisów.
 * 
 * Wykorzystuje pych-public-recipes-search z context="explore":
 * - Pusta fraza = feed (najnowsze przepisy)
 * - ≥3 znaki = wyszukiwanie z relevance i etykietami dopasowania
 */
@Component({
    selector: 'pych-explore-page',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        PublicRecipesSearchComponent,
    ],
    templateUrl: './explore-page.component.html',
    styleUrl: './explore-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorePageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);

    /** ID aktualnie zalogowanego użytkownika (null jeśli gość) */
    readonly currentUserId = signal<string | null>(null);

    /** Początkowe zapytanie z URL */
    readonly initialQuery = signal<string>('');

    ngOnInit(): void {
        // Pobierz ID zalogowanego użytkownika (jeśli jest)
        this.initializeCurrentUser();

        // Inicjalizacja zapytania z URL query params
        this.initializeFromUrl();
    }

    /**
     * Pobiera ID aktualnie zalogowanego użytkownika z sesji.
     */
    private async initializeCurrentUser(): Promise<void> {
        try {
            const { data } = await this.authService.getSession();
            const userId = data?.session?.user?.id ?? null;
            this.currentUserId.set(userId);
        } catch (error) {
            console.error('Błąd pobierania sesji użytkownika:', error);
            this.currentUserId.set(null);
        }
    }

    /**
     * Inicjalizuje zapytanie na podstawie parametrów URL.
     */
    private initializeFromUrl(): void {
        const params = this.route.snapshot.queryParamMap;
        const q = params.get('q') || '';
        this.initialQuery.set(q.trim());
    }
}
