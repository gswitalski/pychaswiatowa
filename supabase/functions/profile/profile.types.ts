import { z } from 'npm:zod@3.22.4';

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
