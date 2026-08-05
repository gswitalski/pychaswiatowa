import { z } from 'npm:zod@3.22.4';

/**
 * Validation schema for GET /profile/username-available query parameters.
 */
export const usernameAvailabilityQuerySchema = z.object({
    username: z
        .string()
        .min(3, 'Username must contain between 3 and 50 characters')
        .max(50, 'Username must contain between 3 and 50 characters')
        .regex(/^\S+$/, 'Username must not contain whitespace'),
});

/**
 * Validation schema for PUT /profile payload.
 */
export const updateProfileSettingsSchema = z.object({
    username: z.string().trim().min(3).max(50),
    marketing_consent: z.boolean(),
    marketing_consent_text_version: z.string().trim().min(1),
});

/**
 * Validation schema for POST /profile/change-password payload.
 */
export const changePasswordSchema = z
    .object({
        current_password: z.string().trim().min(1),
        new_password: z.string().trim().min(1),
    })
    .refine(
        (value) => value.current_password !== value.new_password,
        {
            message: 'New password must be different from current password',
            path: ['new_password'],
        }
    );

export type UpdateProfileSettingsPayload = z.infer<typeof updateProfileSettingsSchema>;
export type ChangePasswordPayload = z.infer<typeof changePasswordSchema>;
export type UsernameAvailabilityQuery = z.infer<typeof usernameAvailabilityQuerySchema>;
