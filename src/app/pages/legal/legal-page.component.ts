import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

type LegalPageId = 'terms' | 'privacy' | 'publisher';

interface LegalRouteData {
    page: LegalPageId;
    title: string;
}

@Component({
    selector: 'pych-legal-page',
    standalone: true,
    imports: [MatCardModule, PageHeaderComponent],
    templateUrl: './legal-page.component.html',
    styleUrl: './legal-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalPageComponent {
    private readonly route = inject(ActivatedRoute);

    private readonly routeData = toSignal(
        this.route.data.pipe(
            map((data) => data as Partial<LegalRouteData>),
            startWith(this.route.snapshot.data as Partial<LegalRouteData>)
        ),
        { initialValue: this.route.snapshot.data as Partial<LegalRouteData> }
    );

    readonly title = computed(() => this.routeData()?.title ?? 'Informacje');
    readonly pageId = computed<LegalPageId | null>(() => this.routeData()?.page ?? null);
}
