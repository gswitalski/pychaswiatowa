import { Injectable, signal, computed } from '@angular/core';
import {
    AiRecipeDraftDto,
    AiRecipeDraftMetaDto,
} from '../../../../../shared/contracts/types';

/** Time-to-live for draft in milliseconds (10 minutes) */
const DRAFT_TTL_MS = 10 * 60 * 1000;

/**
 * Service for storing AI-generated recipe draft state.
 * Allows passing draft data between /recipes/new/assist and /recipes/new.
 * Uses signals for reactive state management.
 */
@Injectable({
    providedIn: 'root',
})
export class RecipeDraftStateService {
    /** Current draft (if any) */
    private readonly _draft = signal<AiRecipeDraftDto | null>(null);

    /** Draft metadata (if any) */
    private readonly _meta = signal<AiRecipeDraftMetaDto | null>(null);

    /** Timestamp when draft was created */
    private readonly _createdAt = signal<number | null>(null);

    /** Public readonly access to draft */
    readonly draft = computed(() => {
        if (!this.isDraftValid()) {
            return null;
        }
        return this._draft();
    });

    /** Public readonly access to meta */
    readonly meta = computed(() => {
        if (!this.isDraftValid()) {
            return null;
        }
        return this._meta();
    });

    /** Check if draft exists and is not expired */
    readonly hasDraft = computed(() => {
        return this.isDraftValid();
    });

    /**
     * Set new draft data
     */
    setDraft(draft: AiRecipeDraftDto, meta: AiRecipeDraftMetaDto): void {
        this._draft.set(draft);
        this._meta.set(meta);
        this._createdAt.set(Date.now());
    }

    /**
     * Clear draft data
     */
    clearDraft(): void {
        this._draft.set(null);
        this._meta.set(null);
        this._createdAt.set(null);
    }

    /**
     * Consume draft (get and clear).
     * This is a one-time use operation - after consuming, the draft is cleared.
     *
     * @returns Draft and meta if available and valid, null otherwise
     */
    consumeDraft(): { draft: AiRecipeDraftDto; meta: AiRecipeDraftMetaDto } | null {
        if (!this.isDraftValid()) {
            this.clearDraft();
            return null;
        }

        const draft = this._draft();
        const meta = this._meta();

        // Clear after consuming
        this.clearDraft();

        if (draft && meta) {
            return { draft, meta };
        }

        return null;
    }

    /**
     * Check if current draft is valid (exists and not expired)
     */
    private isDraftValid(): boolean {
        const draft = this._draft();
        const createdAt = this._createdAt();

        if (!draft || !createdAt) {
            return false;
        }

        // Check TTL
        const age = Date.now() - createdAt;
        if (age > DRAFT_TTL_MS) {
            return false;
        }

        return true;
    }
}

