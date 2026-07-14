import { APP_CONFIG } from "../config/app";

export interface ClusterStatusResponse {
    initialized: boolean;
}

export async function getClusterStatus(): Promise<ClusterStatusResponse> {
    const response = await fetch(
        `${APP_CONFIG.API_BASE_URL}/cluster/status`
    );

    if (!response.ok) {
        throw new Error("Unable to load cluster status.");
    }

    return response.json();
}