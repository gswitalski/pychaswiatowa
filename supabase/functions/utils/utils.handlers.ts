/**
 * HTTP handlers for utils Edge Function.
 * Responsible for request validation, calling services, and formatting responses.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { logger } from '../_shared/logger.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { generateSlug } from './utils.service.ts';

/**
 * Maximum allowed values for validation (prevent abuse).
 */
const MAX_TEXT_LENGTH = 500;
const MAX_MAX_LENGTH = 200;
const MAX_FALLBACK_LENGTH = 40;

/**
 * Zod schema for slugify request body validation.
 */
const slugifyRequestSchema = z.object({
    text: z
        .string()
        .trim()
        .min(1, 'Field "text" is required and cannot be empty.')
        .max(
            MAX_TEXT_LENGTH,
            `Field "text" cannot exceed ${MAX_TEXT_LENGTH} characters.`
        ),
    max_length: z
        .number()
        .int('Field "max_length" must be an integer.')
        .min(1, 'Field "max_length" must be at least 1.')
        .max(
            MAX_MAX_LENGTH,
            `Field "max_length" cannot exceed ${MAX_MAX_LENGTH}.`
        )
        .default(80),
    fallback: z
        .string()
        .trim()
        .min(1, 'Field "fallback" cannot be empty.')
        .max(
            MAX_FALLBACK_LENGTH,
            `Field "fallback" cannot exceed ${MAX_FALLBACK_LENGTH} characters.`
        )
        .default('przepis'),
});

/**
 * Handles POST /slugify endpoint.
 * Validates request body and generates URL-safe slug.
 * 
 * @param req - HTTP Request object
 * @returns HTTP Response with slug or error
 */
export async function handleSlugify(req: Request): Promise<Response> {
    try {
        // Parse and validate request body
        const body = await req.json();
        const validated = slugifyRequestSchema.parse(body);

        logger.info('Slugify request received', {
            textLength: validated.text.length,
            maxLength: validated.max_length,
        });

        // Call service to generate slug
        const slug = generateSlug({
            text: validated.text,
            maxLength: validated.max_length,
            fallback: validated.fallback,
        });

        logger.info('Slug generated successfully', { slug });

        // Return success response
        return new Response(
            JSON.stringify({ slug }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
            const firstError = error.errors[0];
            logger.warn('Slugify validation failed', {
                field: firstError.path.join('.'),
                message: firstError.message,
            });

            throw new ApplicationError(
                'VALIDATION_ERROR',
                firstError.message
            );
        }

        // Re-throw other errors
        throw error;
    }
}

/**
 * Router for /slugify path.
 * Maps HTTP methods to appropriate handlers.
 * 
 * @param req - HTTP Request object
 * @param pathname - Request pathname (e.g., "/utils/slugify")
 * @returns HTTP Response (wrapped in Promise) or null if path doesn't match
 */
export async function slugifyRouter(req: Request, pathname: string): Promise<Response | null> {
    // Match /utils/slugify (the "utils" is the function name, part of the path)
    if (pathname === '/utils/slugify' || pathname === '/utils/slugify/') {
        if (req.method === 'POST') {
            return await handleSlugify(req);
        }

        // Method not allowed for this path
        throw new ApplicationError(
            'METHOD_NOT_ALLOWED',
            `Method ${req.method} is not allowed for /slugify endpoint.`
        );
    }

    return null;
}

