import { APP_CONFIG } from "../config/app";

export interface AdminStats {
    total_lockers: number;
    available_lockers: number;
    in_use_lockers: number;
    maintenance_lockers: number;
    controllers_count: number;
}

export interface AdminTransaction {
    id: number;
    transaction_id: string;
    locker_id: string;
    flow_type: "DEPOSIT" | "RETRIEVE";
    amount: number;
    payment_status: string;
    created_at: string;
    completed_at: string | null;
}

export interface SystemLogItem {
    id: number;
    timestamp: string;
    level: "INFO" | "WARNING" | "ERROR";
    message: string;
}

export interface SystemStatusResponse {
    camera: "Online" | "Offline";
    controllers: "Online" | "Offline";
    payment: "Online" | "Offline";
    network: "Online" | "Offline";
    hardware_mode?: string;
    connected_ports?: string[];
}

export interface FaceDebugInfo {
    algorithm: {
        detection_model: string;
        detection_model_file: string;
        recognition_model: string;
        recognition_model_file: string;
        embedding_dimensions: number;
        similarity_metric: string;
        match_threshold: number;
        description: string;
    };
    model_status: {
        yunet_loaded: boolean;
        sface_loaded: boolean;
        yunet_on_disk: boolean;
        sface_on_disk: boolean;
        yunet_size_kb: number;
        sface_size_kb: number;
        models_dir: string;
    };
    database: {
        active_enrolled_faces: number;
        face_match_threshold: number;
        hourly_rate: number;
        grace_period_minutes: number;
    };
}

export interface FaceDebugLiveResult {
    detection_success: boolean;
    detection_message: string;
    embedding_dims?: number;
    candidates: Array<{
        locker_id: string;
        transaction_id: string;
        similarity: number;
        similarity_pct: number;
        would_match: boolean;
        threshold: number;
    }>;
    model_active: boolean;
    threshold?: number;
}

export async function getAdminStats(): Promise<AdminStats> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/stats`);
    if (!response.ok) throw new Error("Failed to load dashboard stats.");
    return response.json();
}

export async function getTransactions(): Promise<AdminTransaction[]> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/transactions`);
    if (!response.ok) throw new Error("Failed to load recent transactions.");
    return response.json();
}

export async function getLogs(): Promise<SystemLogItem[]> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/logs`);
    if (!response.ok) throw new Error("Failed to load audit logs.");
    return response.json();
}

export async function getSystemStatus(): Promise<SystemStatusResponse> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/status`);
    if (!response.ok) throw new Error("Failed to fetch system diagnostic status.");
    return response.json();
}

export async function overrideLocker(lockerId: string, action: "UNLOCK" | "RELEASE" | "MAINTENANCE" | "AVAILABLE"): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/locker/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locker_id: lockerId, action }),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Override command failed.");
    }
    return response.json();
}

export async function getFaceDebugInfo(): Promise<FaceDebugInfo> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/face-debug`);
    if (!response.ok) throw new Error("Failed to load face algorithm debug info.");
    return response.json();
}

export async function runFaceDebugLive(imageBase64: string): Promise<FaceDebugLiveResult> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/face-debug-live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 }),
    });
    if (!response.ok) throw new Error("Live face debug scan failed.");
    return response.json();
}

export async function resetAllLockers(): Promise<{ success: boolean; released_lockers: number; closed_transactions: number; message: string }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/reset-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Reset failed.");
    return response.json();
}

export async function factoryReset(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/factory-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Factory reset failed.");
    return response.json();
}

export interface DetailedTransaction extends AdminTransaction {
    payment_ref?: string | null;
    elapsed_seconds?: number | null;
}

export interface RevenueStats {
    today: number;
    week: number;
    custom: number;
}

export async function adminLogin(password: string): Promise<{ success: boolean; is_default: boolean; message: string }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Authentication failed.");
    }
    return response.json();
}

export async function changeAdminPassword(old_password: string, new_password: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_password, new_password }),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Change password failed.");
    }
    return response.json();
}

export async function getRevenueStats(start_date?: string, end_date?: string): Promise<RevenueStats> {
    let url = `${APP_CONFIG.API_BASE_URL}/api/admin/revenue`;
    const params = new URLSearchParams();
    if (start_date) params.append("start_date", start_date);
    if (end_date) params.append("end_date", end_date);
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to load revenue statistics.");
    return response.json();
}

export async function getAllTransactions(limit = 250): Promise<DetailedTransaction[]> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/all-transactions?limit=${limit}`);
    if (!response.ok) throw new Error("Failed to load transactions list.");
    return response.json();
}

export interface SystemConfigData {
    cluster_name: string;
    station_name: string;
    location: string;
    timezone: string;
    free_minutes: number;
    hourly_rate: number;
    max_hours: number;
    grace_period: number;
    camera_model: string | null;
    controllers_count: number;
    lockers_count: number;
    initialized: boolean;
    razorpay_key_id?: string | null;
    razorpay_key_secret?: string | null;
    face_threshold?: number;
    liveness_enabled?: boolean;
}

export interface SystemConfigUpdatePayload {
    cluster_name: string;
    station_name: string;
    location: string;
    free_minutes: number;
    hourly_rate: number;
    max_hours: number;
    grace_period: number;
    razorpay_key_id?: string | null;
    razorpay_key_secret?: string | null;
    face_threshold?: number;
    liveness_enabled?: boolean;
}

export async function getSystemConfig(): Promise<SystemConfigData> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/setup/status`);
    if (!response.ok) throw new Error("Failed to load system configuration.");
    const data = await response.json();
    return data.config;
}

export async function updateSystemConfig(payload: SystemConfigUpdatePayload): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/admin/config/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to update configuration.");
    }
    return response.json();
}


