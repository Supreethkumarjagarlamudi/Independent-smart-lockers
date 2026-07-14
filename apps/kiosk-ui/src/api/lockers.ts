import { APP_CONFIG } from "../config/app";

export interface LockerInfo {
    id: string;
    controller_id: string;
    locker_number: number;
    status: "AVAILABLE" | "IN_USE" | "RESERVED" | "MAINTENANCE";
}

export async function getLockers(): Promise<LockerInfo[]> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/lockers`);
    if (!response.ok) throw new Error("Failed to load locker statuses.");
    return response.json();
}

export async function unlockLocker(lockerId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/lockers/unlock/${lockerId}`, {
        method: "POST"
    });
    if (!response.ok) throw new Error("Failed to send hardware unlock command.");
    return response.json();
}

export async function releaseLocker(lockerId: string, transactionId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/lockers/release/${lockerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transactionId }),
    });
    if (!response.ok) throw new Error("Failed to release locker.");
    return response.json();
}
