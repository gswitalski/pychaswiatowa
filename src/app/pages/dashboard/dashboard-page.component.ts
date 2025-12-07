import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { WelcomeHeaderComponent } from './components/welcome-header/welcome-header.component';
import { NavigationTileComponent } from './components/navigation-tile/navigation-tile.component';
import { RecentRecipesListComponent } from './components/recent-recipes-list/recent-recipes-list.component';
import { ProfileService } from './services/profile.service';
import { RecipesService } from './services/recipes.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { ApiError, ProfileDto, RecipeListItemDto } from '../../../../shared/contracts/types';

export interface NavigationTileViewModel {
    title: string;
    link: string;
    icon?: string;
}

interface DashboardState {
    profile: ProfileDto | null;
    recentRecipes: RecipeListItemDto[];
    isLoading: boolean;
    error: ApiError | null;
}

@Component({
    selector: 'pych-dashboard-page',
    standalone: true,
    imports: [
        WelcomeHeaderComponent,
        NavigationTileComponent,
        RecentRecipesListComponent,
        MatProgressSpinnerModule,
        MatButtonModule,
    ],
    templateUrl: './dashboard-page.component.html',
    styleUrl: './dashboard-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
    private readonly profileService = inject(ProfileService);
    private readonly recipesService = inject(RecipesService);

    state = signal<DashboardState>({
        profile: null,
        recentRecipes: [],
        isLoading: true,
        error: null,
    });

    profile = computed(() => this.state().profile);
    recentRecipes = computed(() => this.state().recentRecipes);
    isLoading = computed(() => this.state().isLoading);
    error = computed(() => this.state().error);

    navigationTiles: NavigationTileViewModel[] = [
        {
            title: 'Moje przepisy',
            link: '/recipes',
            icon: 'menu_book',
        },
        {
            title: 'Moje kolekcje',
            link: '/collections',
            icon: 'collections_bookmark',
        },
    ];

    ngOnInit(): void {
        this.loadDashboardData();
    }

    loadDashboardData(): void {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        forkJoin({
            profile: this.profileService.getProfile(),
            recipes: this.recipesService.getRecipes({ sort: 'created_at.desc', limit: 5 }),
        }).subscribe({
            next: ({ profile, recipes }) => {
                this.state.update((s) => ({
                    ...s,
                    profile,
                    recentRecipes: recipes.data,
                    isLoading: false,
                }));
            },
            error: (err) => {
                this.state.update((s) => ({
                    ...s,
                    isLoading: false,
                    error: {
                        message: 'Wystąpił błąd podczas ładowania danych.',
                        status: err.status ?? 500,
                    },
                }));
            },
        });
    }

    retryLoad(): void {
        this.loadDashboardData();
    }
}


