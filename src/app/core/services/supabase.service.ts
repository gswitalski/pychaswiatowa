import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Database } from '../../../../shared/types/database.types';

@Injectable({
    providedIn: 'root'
})
export class SupabaseService {
    private supabase: SupabaseClient<Database>;

    constructor() {
        this.supabase = createClient<Database>(
            environment.supabase.url,
            environment.supabase.anonKey
        );
    }

    get client(): SupabaseClient<Database> {
        return this.supabase;
    }

    get auth() {
        return this.supabase.auth;
    }

    get from() {
        return this.supabase.from.bind(this.supabase);
    }

    get storage() {
        return this.supabase.storage;
    }

    get functions() {
        return this.supabase.functions;
    }
}

