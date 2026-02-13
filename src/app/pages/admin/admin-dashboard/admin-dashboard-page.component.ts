import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminSummaryDto } from '../../../../../shared/contracts/types';
import { AdminApiService } from '../../../core/services/admin-api.service';

interface AdminFeatureCard {
    readonly title: string;
    readonly description: string;
}

interface AdminDashboardState {
    readonly summary: AdminSummaryDto | null;
    readonly isLoading: boolean;
    readonly errorMessage: string | null;
}

@Component({
    selector: 'pych-admin-dashboard-page',
    standalone: true,
    imports: [MatCardModule, MatButtonModule, MatProgressSpinnerModule],
    templateUrl: './admin-dashboard-page.component.html',
    styleUrl: './admin-dashboard-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPageComponent implements OnInit {
    private readonly adminApi = inject(AdminApiService);
    private readonly router = inject(Router);

    readonly state = signal<AdminDashboardState>({
        summary: null,
        isLoading: false,
        errorMessage: null,
    });

    readonly summary = computed(() => this.state().summary);
    readonly isLoading = computed(() => this.state().isLoading);
    readonly errorMessage = computed(() => this.state().errorMessage);

    readonly featureCards: AdminFeatureCard[] = [
        {
            title: 'Statystyki (wkrótce)',
            description: 'Podgląd kluczowych metryk platformy i zdrowia systemu.',
        },
        {
            title: 'Zarządzanie użytkownikami (wkrótce)',
            description: 'Narzędzia do przeglądu kont, ról i zgłoszeń użytkowników.',
        },
        {
            title: 'Moderacja treści (wkrótce)',
            description: 'Sekcja do przeglądu i moderacji przepisów oraz komentarzy.',
        },
        {
            title: 'Konfiguracja (wkrótce)',
            description: 'Ustawienia administracyjne aplikacji i integracji.',
        },
    ];

    ngOnInit(): void {
        this.loadSummary();
    }

    refreshSummary(): void {
        this.loadSummary();
    }

    private loadSummary(): void {
        this.state.update((s) => ({ ...s, isLoading: true, errorMessage: null }));

        this.adminApi.getSummary().subscribe({
            next: (summary) => {
                this.state.update((s) => ({
                    ...s,
                    summary,
                    isLoading: false,
                    errorMessage: null,
                }));
            },
            error: (error: Error & { status?: number }) => {
                if (error.status === 401) {
                    this.router.navigate(['/login'], {
                        queryParams: { returnUrl: '/admin/dashboard' },
                    });
                    this.state.update((s) => ({ ...s, isLoading: false }));
                    return;
                }

                if (error.status === 403) {
                    this.router.navigate(['/forbidden']);
                    this.state.update((s) => ({ ...s, isLoading: false }));
                    return;
                }

                this.state.update((s) => ({
                    ...s,
                    isLoading: false,
                    errorMessage: 'Nie udało się pobrać podsumowania panelu administracyjnego.',
                }));
            },
        });
    }
}
