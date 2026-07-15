import { APP_CONFIG } from "../config/app";

export interface CameraInfo {
    id: string;
    name: string;
    status: string;
}

export interface ControllerInfo {
    id: string;
    status: string;
}

export interface SetupConfigPayload {
    cluster_name: string;
    station_name: string;
    location: string;
    timezone: string;
    free_minutes: number;
    hourly_rate: number;
    max_hours: number;
    grace_period: number;
    camera_model: string;
    controllers_count: number;
    lockers_count: number;
    locker_prefix?: string;
    razorpay_key_id?: string;
    razorpay_key_secret?: string;
    admin_password?: string;
}

export async function getCameras(): Promise<CameraInfo[]> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/setup/cameras`);
    if (!response.ok) throw new Error("Failed to scan cameras.");
    return response.json();
}

export async function getControllers(count: number): Promise<ControllerInfo[]> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/setup/controllers?count=${count}`);
    if (!response.ok) throw new Error("Failed to scan controllers.");
    return response.json();
}

export async function initializeCluster(payload: SetupConfigPayload): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/setup/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Setup initialization failed.");
    }
    return response.json();
}
