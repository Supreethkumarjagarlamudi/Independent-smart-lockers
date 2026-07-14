import { APP_CONFIG } from "../config/app";

export interface HealthResponse {
    status: string;
}

export async function getHealth(): Promise<HealthResponse> {
    const response = await fetch(
        `${APP_CONFIG.API_BASE_URL}/health`
    );

    if (!response.ok) {
        throw new Error("Unable to reach backend.");
    }

    return response.json();
}