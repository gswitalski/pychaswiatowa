/**
 * Normalized Ingredients Worker Service
 * 
 * Implements the business logic for processing normalized ingredients jobs.
 * Handles job claiming, processing, retry/backoff, and result storage.
 */

import { logger } from '../_shared/logger.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { getSupabaseServiceClient } from '../_shared/supabase-client.ts';
import {
    generateNormalizedIngredients,
    NORMALIZED_INGREDIENT_UNITS,
    type NormalizedIngredientDto,
} from '../_shared/normalized-ingredients.ts';

// #region --- Types ---

/**
 * Job data from database (claimed job).
 */
interface ClaimedJob {
    job_id: number;
    recipe_id: number;
    user_id: string;
    attempts: number;
    last_error: string | null;
    ingredients: RecipeIngredients;
}

/**
 * Recipe ingredients structure (JSONB from DB).
 */
type RecipeIngredients = Array<{ type: 'header' | 'item'; content: string }>;

/**
 * Job processing result.
 */
interface JobProcessingResult {
    job_id: number;
    recipe_id: number;
    status: 'succeeded' | 'failed' | 'skipped';
    error?: string;
}

/**
 * Worker run summary.
 */
export interface WorkerRunSummary {
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
}

// #endregion

// #region --- Constants ---

/** Maximum number of jobs to process in a single run */
const DEFAULT_BATCH_SIZE = 10;

/** Maximum attempts before marking job as FAILED (MVP policy) */
const MAX_ATTEMPTS = 5;

/** Retry backoff schedule in milliseconds: [1m, 5m, 30m, 2h, 12h] */
const RETRY_BACKOFF_MS = [
    60_000,        // 1 minute
    300_000,       // 5 minutes
    1_800_000,     // 30 minutes
    7_200_000,     // 2 hours
    43_200_000,    // 12 hours
];

/** Jitter percentage for backoff (±30%) */
const JITTER_PERCENT = 0.3;

// #endregion

// #region --- Helper Functions ---

/**
 * Calculates next run time with exponential backoff and jitter.
 * 
 * @param attempts - Current attempt number (1-based after increment)
 * @returns ISO timestamp for next run
 */
function calculateNextRunAt(attempts: number): string {
    // Get base delay from backoff schedule
    const index = Math.min(attempts - 1, RETRY_BACKOFF_MS.length - 1);
    const baseDelayMs = RETRY_BACKOFF_MS[index];

    // Apply jitter (±30%)
    const jitterRange = baseDelayMs * JITTER_PERCENT;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    const delayMs = baseDelayMs + jitter;

    // Calculate next run timestamp
    const nextRunAt = new Date(Date.now() + delayMs);
    return nextRunAt.toISOString();
}

/**
 * Updates job status after processing.
 * 
 * @param jobId - Job ID to update
 * @param status - Final status (DONE, RETRY, FAILED)
 * @param attempts - Current attempt count
 * @param error - Error message (optional)
 */
async function updateJobStatus(
    jobId: number,
    status: 'DONE' | 'RETRY' | 'FAILED',
    attempts: number,
    error?: string
): Promise<void> {
    const supabase = getSupabaseServiceClient();

    const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
    };

    if (error) {
        updateData.last_error = error;
    }

    if (status === 'RETRY') {
        updateData.next_run_at = calculateNextRunAt(attempts);
    }

    const { error: updateError } = await supabase
        .from('normalized_ingredients_jobs')
        .update(updateData)
        .eq('id', jobId);

    if (updateError) {
        logger.error('Failed to update job status', {
            jobId,
            status,
            error: updateError.message,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to update job status'
        );
    }

    logger.info('Job status updated', { jobId, status, attempts });
}

/**
 * Updates recipe normalized ingredients status.
 * 
 * @param recipeId - Recipe ID
 * @param status - Status to set (READY or FAILED)
 */
async function updateRecipeStatus(
    recipeId: number,
    status: 'READY' | 'FAILED'
): Promise<void> {
    const supabase = getSupabaseServiceClient();

    const updateData: Record<string, unknown> = {
        normalized_ingredients_status: status,
    };

    if (status === 'READY') {
        updateData.normalized_ingredients_updated_at = new Date().toISOString();
    } else {
        updateData.normalized_ingredients_updated_at = null;
    }

    const { error: updateError } = await supabase
        .from('recipes')
        .update(updateData)
        .eq('id', recipeId);

    if (updateError) {
        logger.error('Failed to update recipe status', {
            recipeId,
            status,
            error: updateError.message,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to update recipe status'
        );
    }

    logger.info('Recipe status updated', { recipeId, status });
}

/**
 * Saves normalized ingredients to database.
 * 
 * @param recipeId - Recipe ID
 * @param items - Normalized ingredient items
 */
async function saveNormalizedIngredients(
    recipeId: number,
    items: NormalizedIngredientDto[]
): Promise<void> {
    const supabase = getSupabaseServiceClient();

    const { error: upsertError } = await supabase
        .from('recipe_normalized_ingredients')
        .upsert({
            recipe_id: recipeId,
            items: items,
            updated_at: new Date().toISOString(),
        });

    if (upsertError) {
        logger.error('Failed to save normalized ingredients', {
            recipeId,
            error: upsertError.message,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to save normalized ingredients'
        );
    }

    logger.info('Normalized ingredients saved', {
        recipeId,
        itemsCount: items.length,
    });
}

// #endregion

// #region --- Job Processing ---

/**
 * Processes a single job: normalizes ingredients and saves results.
 * 
 * @param job - Claimed job data
 * @returns JobProcessingResult with status and optional error
 */
async function processJob(job: ClaimedJob): Promise<JobProcessingResult> {
    const { job_id, recipe_id, user_id, attempts, ingredients } = job;

    logger.info('Processing job', {
        job_id,
        recipe_id,
        user_id,
        attempts,
    });

    try {
        // Filter out headers, keep only items
        const ingredientItems = ingredients.filter(item => item.type === 'item');

        if (ingredientItems.length === 0) {
            logger.warn('No ingredient items to normalize (only headers)', {
                job_id,
                recipe_id,
            });
            return {
                job_id,
                recipe_id,
                status: 'skipped',
                error: 'No ingredient items to normalize',
            };
        }

        // Call normalization logic
        const result = await generateNormalizedIngredients({
            userId: user_id,
            recipeId: recipe_id,
            ingredientItems,
            allowedUnits: [...NORMALIZED_INGREDIENT_UNITS],
            language: 'pl',
        });

        // Handle validation failure from LLM
        if (!result.success) {
            logger.warn('Normalization validation failed', {
                job_id,
                recipe_id,
                reasons: result.reasons,
            });
            return {
                job_id,
                recipe_id,
                status: 'failed',
                error: result.reasons.join('; '),
            };
        }

        // Save results to database
        await saveNormalizedIngredients(recipe_id, result.data.normalized_ingredients);
        await updateRecipeStatus(recipe_id, 'READY');

        logger.info('Job processed successfully', {
            job_id,
            recipe_id,
            itemsCount: result.data.normalized_ingredients.length,
            confidence: result.data.meta.confidence,
        });

        return {
            job_id,
            recipe_id,
            status: 'succeeded',
        };

    } catch (error) {
        // Handle errors (infrastructure, API, etc.)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logger.error('Job processing failed', {
            job_id,
            recipe_id,
            attempts,
            error: errorMessage,
            errorType: error instanceof ApplicationError ? error.code : 'UNKNOWN',
        });

        return {
            job_id,
            recipe_id,
            status: 'failed',
            error: errorMessage,
        };
    }
}

// #endregion

// #region --- Main Worker Logic ---

/**
 * Processes a batch of normalized ingredients jobs.
 * Claims jobs from queue, processes them, and updates statuses with retry/backoff.
 * 
 * @param batchSize - Maximum number of jobs to process (default: 10)
 * @returns WorkerRunSummary with processing statistics
 */
export async function processNormalizedIngredientsJobs(
    batchSize: number = DEFAULT_BATCH_SIZE
): Promise<WorkerRunSummary> {
    logger.info('Starting normalized ingredients worker run', { batchSize });

    const summary: WorkerRunSummary = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
    };

    try {
        // Step 1: Claim jobs atomically
        const supabase = getSupabaseServiceClient();
        
        const { data: claimedJobsData, error: claimError } = await supabase
            .rpc('claim_normalized_ingredients_jobs', { p_limit: batchSize });

        if (claimError) {
            logger.error('Failed to claim jobs', { error: claimError.message });
            throw new ApplicationError(
                'INTERNAL_ERROR',
                'Failed to claim jobs from queue'
            );
        }

        const claimedJobs: ClaimedJob[] = claimedJobsData || [];

        if (claimedJobs.length === 0) {
            logger.info('No jobs available for processing');
            return summary;
        }

        logger.info('Jobs claimed', { count: claimedJobs.length });

        // Step 2: Process each job sequentially
        for (const job of claimedJobs) {
            summary.processed++;

            const result = await processJob(job);

            // Step 3: Update job and recipe status based on result
            if (result.status === 'succeeded') {
                summary.succeeded++;
                await updateJobStatus(job.job_id, 'DONE', job.attempts);

            } else if (result.status === 'skipped') {
                summary.skipped++;
                await updateJobStatus(job.job_id, 'DONE', job.attempts, result.error);

            } else {
                // Failed - apply retry logic
                summary.failed++;

                if (job.attempts < MAX_ATTEMPTS) {
                    // Still have retries left
                    await updateJobStatus(job.job_id, 'RETRY', job.attempts, result.error);
                    logger.info('Job scheduled for retry', {
                        job_id: job.job_id,
                        recipe_id: job.recipe_id,
                        attempts: job.attempts,
                        maxAttempts: MAX_ATTEMPTS,
                    });
                } else {
                    // Max attempts reached - mark as FAILED
                    await updateJobStatus(job.job_id, 'FAILED', job.attempts, result.error);
                    await updateRecipeStatus(job.recipe_id, 'FAILED');
                    logger.warn('Job marked as FAILED after max attempts', {
                        job_id: job.job_id,
                        recipe_id: job.recipe_id,
                        attempts: job.attempts,
                    });
                }
            }
        }

        logger.info('Worker run completed', summary);
        return summary;

    } catch (error) {
        logger.error('Worker run failed with unhandled error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            summary,
        });
        throw error;
    }
}

// #endregion
