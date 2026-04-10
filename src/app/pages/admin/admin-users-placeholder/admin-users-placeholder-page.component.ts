import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

interface AdminUsersPlaceholderSection {
    readonly title: string;
    readonly description: string;
}

@Component({
    selector: 'pych-admin-users-placeholder-page',
    standalone: true,
    imports: [MatCardModule],
    templateUrl: './admin-users-placeholder-page.component.html',
    styleUrl: './admin-users-placeholder-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersPlaceholderPageComponent {
    readonly title = 'Użytkownicy';
    readonly description =
        'Sekcja zarządzania kontami jest przygotowywana i zostanie dostarczona w kolejnej iteracji.';

    readonly sections: readonly AdminUsersPlaceholderSection[] = [
        {
            title: 'Lista użytkowników',
            description:
                'Widok tabeli, filtrów i wyszukiwarki zostanie dodany po zamknięciu prac nad podstawowym layoutem admina.',
        },
        {
            title: 'Role i uprawnienia',
            description:
                'Edycja ról, przypisania uprawnień i historia zmian będą wdrażane etapowo w kolejnych sprintach.',
        },
    ];
}
