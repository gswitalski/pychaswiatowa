import { logger } from '../logger.ts';

export interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
}

export interface SendEmailResult {
    ok: boolean;
    status: number;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
    const from = Deno.env.get('EMAIL_FROM')?.trim();
    if (!apiKey || !from) {
        logger.error('[email] Resend configuration is missing');
        return { ok: false, status: 0 };
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': params.idempotencyKey,
            },
            body: JSON.stringify({
                from,
                to: [params.to],
                subject: params.subject,
                html: params.html,
                text: params.text,
            }),
            signal: AbortSignal.timeout(5_000),
        });

        return {
            ok: response.ok,
            status: response.status,
        };
    } catch (error) {
        logger.error('[email] Resend request failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return { ok: false, status: 0 };
    }
}
