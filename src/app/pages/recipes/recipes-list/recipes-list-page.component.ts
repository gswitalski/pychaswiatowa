import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'pych-recipes-list-page',
    standalone: true,
    imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule],
    templateUrl: './recipes-list-page.component.html',
    styleUrl: './recipes-list-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipesListPageComponent {}

