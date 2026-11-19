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
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { AuthService } from '../../../../core/services/auth.service';
import {
    LoginDialogComponent,
    LoginDialogData,
} from '../../../../shared/components/login-dialog/login-dialog.component';

const SESSION_REQUIRED_PATH_PREFIXES = ['/settings'] as const;

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
    private readonly router = inject(Router);
    private readonly dialog = inject(MatDialog);
    private readonly authService = inject(AuthService);

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

    handleContentClick(event: MouseEvent): void {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        const anchor = target.closest('a');
        if (!anchor) {
            return;
        }

        const href = anchor.getAttribute('href');
        if (!href || !href.startsWith('/') || href.startsWith('//')) {
            return;
        }

        event.preventDefault();

        if (this.requiresSession(href) && !this.authService.isAuthenticated()) {
            this.openLoginDialog(href);
            return;
        }

        void this.router.navigateByUrl(href);
    }

    private requiresSession(url: string): boolean {
        const pathname = url.split('?')[0] ?? url;
        return SESSION_REQUIRED_PATH_PREFIXES.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
        );
    }

    private openLoginDialog(nextUrl: string): void {
        this.dialog.open<LoginDialogComponent, LoginDialogData>(LoginDialogComponent, {
            data: { nextUrl },
            width: '480px',
            maxWidth: 'calc(100vw - 32px)',
            panelClass: 'mobile-fullscreen-dialog',
        });
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
