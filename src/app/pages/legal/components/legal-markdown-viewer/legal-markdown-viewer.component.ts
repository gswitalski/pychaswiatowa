import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MarkdownComponent } from 'ngx-markdown';

type LegalMarkdownLoadState = 'idle' | 'loading' | 'success' | 'error';

interface LegalMarkdownViewerState {
    state: LegalMarkdownLoadState;
    content: string | null;
    errorMessage: string | null;
}

@Component({
    selector: 'pych-legal-markdown-viewer',
    standalone: true,
    imports: [MatButtonModule, MatProgressBarModule, MarkdownComponent],
    templateUrl: './legal-markdown-viewer.component.html',
    styleUrl: './legal-markdown-viewer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalMarkdownViewerComponent {
    private readonly http = inject(HttpClient);

    readonly assetPath = input.required<string>();
    readonly documentName = input<string>('treści strony prawnej');
    private readonly reloadTick = signal<number>(0);

    readonly state = signal<LegalMarkdownViewerState>({
        state: 'idle',
        content: null,
        errorMessage: null,
    });

    readonly content = computed(() => this.state().content);
    readonly isLoading = computed(() => this.state().state === 'loading');
    readonly errorMessage = computed(() => this.state().errorMessage);
    readonly loadingAriaLabel = computed(() => `Wczytywanie ${this.documentName()}`);

    constructor() {
        effect(() => {
            const currentAssetPath = this.assetPath();
            this.reloadTick();
            void this.load(currentAssetPath);
        });
    }

    reload(): void {
        this.reloadTick.update((value) => value + 1);
    }

    private createLoadErrorMessage(): string {
        return `Nie udało się wczytać ${this.documentName()}. Spróbuj ponownie.`;
    }

    private async load(assetPath: string): Promise<void> {
        if (!assetPath) {
            this.state.update((currentState) => ({
                ...currentState,
                state: 'error',
                errorMessage: this.createLoadErrorMessage(),
            }));
            return;
        }

        this.state.update((currentState) => ({
            ...currentState,
            state: 'loading',
            errorMessage: null,
        }));

        try {
            const content = await firstValueFrom(
                this.http.get(assetPath, { responseType: 'text' })
            );

            this.state.update(() => ({
                state: 'success',
                content,
                errorMessage: null,
            }));
        } catch {
            this.state.update((currentState) => ({
                ...currentState,
                state: 'error',
                errorMessage: this.createLoadErrorMessage(),
            }));
        }
    }
}
