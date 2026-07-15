import { APP_CONFIG } from "../config/app";

export interface PaymentCreateResponse {
    transaction_id: string;
    upi_link: string;
    amount: number;
    locker_id: string;
    is_test_mode?: boolean;
}

export interface PaymentVerifyResponse {
    transaction_id: string;
    payment_status: "PENDING" | "PAID" | "FAILED";
    locker_id: string;
}

export async function createPayment(
    amount: number, 
    flowType: string, 
    lockerId?: string, 
    parentTransactionId?: string
): Promise<PaymentCreateResponse> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/payment/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            amount, 
            flow_type: flowType, 
            locker_id: lockerId, 
            parent_transaction_id: parentTransactionId 
        }),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to create payment transaction.");
    }
    return response.json();
}

export async function verifyPayment(transactionId: string): Promise<PaymentVerifyResponse> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transactionId }),
    });
    if (!response.ok) throw new Error("Payment status verification failed.");
    return response.json();
}

export async function simulateConfirmPayment(transactionId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/payment/simulate-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transactionId }),
    });
    if (!response.ok) throw new Error("Payment simulation callback failed.");
    return response.json();
}

export async function cancelPayment(transactionId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/payment/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transactionId }),
    });
    if (!response.ok) throw new Error("Failed to cancel payment.");
    return response.json();
}

