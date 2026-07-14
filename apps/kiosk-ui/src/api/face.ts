import { APP_CONFIG } from "../config/app";

export interface FaceResponse {
    success: boolean;
    message: string;
    locker_id: string;
    transaction_id: string;
}

export interface FaceMatchResponse {
    match: boolean;
    locker_id: string;
    transaction_id: string;
    similarity: number;
    multiple_matches?: boolean;
    overdue_fee?: number;
    matches?: Array<{
        locker_id: string;
        transaction_id: string;
        similarity: number;
        created_at: string;
        amount: number;
        overdue_fee: number;
    }>;
}

export async function registerFace(transactionId: string, imageBase64: string): Promise<FaceResponse> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/face/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transactionId, image: imageBase64 }),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Face registration failed.");
    }
    return response.json();
}

export async function verifyFace(imageBase64: string): Promise<FaceMatchResponse> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/face/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 }),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Face verification failed.");
    }
    return response.json();
}
