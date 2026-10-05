export interface PaymentHistoryRowViewModel {
    id: number;
    paidAt: Date | null;
    planLabel: string;
    amountGross: number;
    methodLabel: string;
    statusLabel: string;
    statusKind: 'paid' | 'failed';
    documentUrl: string | null;
    documentNumber: string | null;
}
