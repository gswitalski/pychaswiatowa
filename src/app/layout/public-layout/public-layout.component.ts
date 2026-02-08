import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { PublicHeaderComponent } from '../../shared/components/public-header/public-header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
    selector: 'pych-public-layout',
    standalone: true,
    imports: [RouterOutlet, PublicHeaderComponent, FooterComponent],
    templateUrl: './public-layout.component.html',
    styleUrl: './public-layout.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLayoutComponent {
    private readonly router = inject(Router);

    private readonly currentUrl = toSignal(
        this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd),
            map((event) => event.urlAfterRedirects),
            startWith(this.router.url)
        ),
        { initialValue: this.router.url }
    );

    readonly isAuthCallbackRoute = computed(() =>
        (this.currentUrl() ?? '').startsWith('/auth/callback')
    );
}


