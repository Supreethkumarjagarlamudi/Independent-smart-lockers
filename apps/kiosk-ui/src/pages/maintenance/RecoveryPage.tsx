import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Layers,
    History,
    Unlock,
    UserCheck,
    AlertTriangle,
    Check,
    RefreshCw,
    X,
    Server,
    Cpu,
    Camera,
    ChevronRight,
    Activity,
    Eye,
    ShieldCheck,
    Zap,
    RotateCcw,
    Trash2,
    DollarSign,
    Lock,
    Settings,
    CreditCard,
    Calendar,
    Menu,
} from "lucide-react";

import { AppLayout } from "../../components/layout/AppLayout";
import {
    getAdminStats,
    getTransactions,
    getLogs,
    getSystemStatus,
    overrideLocker,
    getFaceDebugInfo,
    runFaceDebugLive,
    resetAllLockers,
    getAllTransactions,
    getRevenueStats,
    adminLogin,
    changeAdminPassword,
    getSystemConfig,
    updateSystemConfig,
} from "../../api/admin";
import type {
    AdminStats,
    AdminTransaction,
    SystemLogItem,
    SystemStatusResponse,
    FaceDebugInfo,
    FaceDebugLiveResult,
    DetailedTransaction,
    RevenueStats,
    SystemConfigData,
} from "../../api/admin";
import { getLockers } from "../../api/lockers";
import type { LockerInfo } from "../../api/lockers";

type ActiveTab = "DASHBOARD" | "TRANSACTIONS" | "LOCKERS" | "LOGS" | "DEVTOOLS" | "SETTINGS";

// ─── Utility row for dev tools ─────────────────────────────────────────────
function Row({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: color ?? "#cbd5e1", textAlign: "right", fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all" }}>{value}</span>
        </div>
    );
}

export default function RecoveryPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<ActiveTab>("DASHBOARD");
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (!mobile) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Authentication states
    const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem("admin_authenticated") === "true");
    const [isPasswordDefault, setIsPasswordDefault] = useState(() => sessionStorage.getItem("admin_password_default") === "true");
    const [passwordInput, setPasswordInput] = useState("");
    const [authError, setAuthError] = useState("");
    const [authLoading, setAuthLoading] = useState(false);

    // Password change states
    const [changePwOld, setChangePwOld] = useState("");
    const [changePwNew, setChangePwNew] = useState("");
    const [changePwConfirm, setChangePwConfirm] = useState("");
    const [changePwLoading, setChangePwLoading] = useState(false);

    // Revenue analytics states
    const [revenue, setRevenue] = useState<RevenueStats | null>(null);
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");
    const [customRevenue, setCustomRevenue] = useState<number | null>(null);
    const [customRevenueLoading, setCustomRevenueLoading] = useState(false);

    // System Config editing states
    const [systemConfig, setSystemConfig] = useState<SystemConfigData | null>(null);
    const [configClusterName, setConfigClusterName] = useState("");
    const [configStationName, setConfigStationName] = useState("");
    const [configLocation, setConfigLocation] = useState("");
    const [configFreeMinutes, setConfigFreeMinutes] = useState(0);
    const [configHourlyRate, setConfigHourlyRate] = useState(0);
    const [configMaxHours, setConfigMaxHours] = useState(0);
    const [configGracePeriod, setConfigGracePeriod] = useState(0);
    const [configLoading, setConfigLoading] = useState(false);

    // Detailed transactions states
    const [detailedTransactions, setDetailedTransactions] = useState<DetailedTransaction[]>([]);
    const [txTabFilter, setTxTabFilter] = useState<"ALL" | "DEPOSIT" | "RETRIEVE" | "FAILED">("ALL");

    const [stats, setStats] = useState<AdminStats | null>(null);
    const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
    const [logs, setLogs] = useState<SystemLogItem[]>([]);
    const [statusCheck, setStatusCheck] = useState<SystemStatusResponse | null>(null);
    const [lockers, setLockers] = useState<LockerInfo[]>([]);

    const [faceDebugInfo, setFaceDebugInfo] = useState<FaceDebugInfo | null>(null);
    const [liveDebugResult, setLiveDebugResult] = useState<FaceDebugLiveResult | null>(null);
    const [liveDebugLoading, setLiveDebugLoading] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [selectedLocker, setSelectedLocker] = useState<LockerInfo | null>(null);
    const [selectedActionLoading, setSelectedActionLoading] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);


    const refreshData = async () => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        setErrorMessage("");
        try {
            const [s, t, l, sc, lks, rev, allTx, cfg] = await Promise.all([
                getAdminStats(),
                getTransactions(),
                getLogs(),
                getSystemStatus(),
                getLockers(),
                getRevenueStats(),
                getAllTransactions(250),
                getSystemConfig()
            ]);
            setStats(s);
            setTransactions(t);
            setLogs(l);
            setStatusCheck(sc);
            setLockers(lks);
            setRevenue(rev);
            setDetailedTransactions(allTx);
            setSystemConfig(cfg);
        } catch (err: unknown) {
            setErrorMessage((err as Error).message || "Failed to sync admin data.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        if (isAuthenticated) {
            refreshData(); 
        }
    }, [activeTab, isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated && activeTab === "DEVTOOLS") {
            getFaceDebugInfo().then(setFaceDebugInfo).catch(() => setFaceDebugInfo(null));
        }
    }, [activeTab, isAuthenticated]);

    // Attach camera stream to video element AFTER React renders the <video> tag
    useEffect(() => {
        if (cameraStream && videoRef.current) {
            videoRef.current.srcObject = cameraStream;
            videoRef.current.play().catch(console.error);
        }
    }, [cameraStream]);

    const startDevCamera = async () => {
        setCameraError(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } });
            // Just set the state — the useEffect above will attach srcObject after render
            setCameraStream(stream);
        } catch { setCameraError(true); }
    };

    const stopDevCamera = () => {
        cameraStream?.getTracks().forEach((t) => t.stop());
        setCameraStream(null);
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    useEffect(() => {
        if (activeTab !== "DEVTOOLS") stopDevCamera();
        return () => stopDevCamera();
    }, [activeTab]);

    const runLiveScan = async () => {
        if (!videoRef.current) return;
        setLiveDebugLoading(true);
        setLiveDebugResult(null);
        try {
            const canvas = document.createElement("canvas");
            canvas.width = 480; canvas.height = 480;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.translate(480, 0); ctx.scale(-1, 1);
                ctx.drawImage(videoRef.current, 0, 0, 480, 480);
                const img = canvas.toDataURL("image/jpeg", 0.92);
                setLiveDebugResult(await runFaceDebugLive(img));
            }
        } catch (err: unknown) {
            setLiveDebugResult({ detection_success: false, detection_message: (err as Error).message || "Scan failed", candidates: [], model_active: false });
        } finally { setLiveDebugLoading(false); }
    };

    const handleResetAll = async () => {
        setResetLoading(true);
        setSuccessMessage(""); setErrorMessage("");
        try {
            const res = await resetAllLockers();
            setSuccessMessage(res.message);
            setShowResetConfirm(false);
            await refreshData();
        } catch (err: unknown) {
            setErrorMessage((err as Error).message || "Reset failed.");
        } finally {
            setResetLoading(false);
        }
    };

    const handleOverride = async (lockerId: string, action: "UNLOCK" | "RELEASE" | "MAINTENANCE" | "AVAILABLE") => {
        setSelectedActionLoading(true);
        setSuccessMessage(""); setErrorMessage("");
        try {
            await overrideLocker(lockerId, action);
            setSuccessMessage(`Action "${action}" applied to locker ${lockerId}.`);
            setSelectedLocker(null);
            await refreshData();
        } catch (err: unknown) {
            setErrorMessage((err as Error).message || `Failed to run ${action}.`);
        } finally { setSelectedActionLoading(false); }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");
        setAuthLoading(true);
        try {
            const res = await adminLogin(passwordInput);
            if (res.success) {
                sessionStorage.setItem("admin_authenticated", "true");
                sessionStorage.setItem("admin_password_default", res.is_default ? "true" : "false");
                setIsAuthenticated(true);
                setIsPasswordDefault(res.is_default);
                setPasswordInput("");
            }
        } catch (err: unknown) {
            setAuthError((err as Error).message || "Authentication failed.");
        } finally {
            setAuthLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(""); setSuccessMessage("");
        if (changePwNew !== changePwConfirm) {
            setErrorMessage("New passwords do not match.");
            return;
        }
        setChangePwLoading(true);
        try {
            const res = await changeAdminPassword(changePwOld, changePwNew);
            if (res.success) {
                setSuccessMessage("Password changed successfully.");
                sessionStorage.setItem("admin_password_default", "false");
                setIsPasswordDefault(false);
                setChangePwOld("");
                setChangePwNew("");
                setChangePwConfirm("");
            }
        } catch (err: unknown) {
            setErrorMessage((err as Error).message || "Failed to change password.");
        } finally {
            setChangePwLoading(false);
        }
    };

    const handleCalculateCustomRevenue = async () => {
        if (!customStartDate || !customEndDate) {
            setErrorMessage("Please select both start and end dates.");
            return;
        }
        setCustomRevenueLoading(true);
        try {
            const res = await getRevenueStats(customStartDate, customEndDate);
            setCustomRevenue(res.custom);
        } catch (err: unknown) {
            setErrorMessage((err as Error).message || "Failed to calculate range revenue.");
        } finally {
            setCustomRevenueLoading(false);
        }
    };

    useEffect(() => {
        if (systemConfig) {
            setConfigClusterName(systemConfig.cluster_name);
            setConfigStationName(systemConfig.station_name);
            setConfigLocation(systemConfig.location);
            setConfigFreeMinutes(systemConfig.free_minutes);
            setConfigHourlyRate(systemConfig.hourly_rate);
            setConfigMaxHours(systemConfig.max_hours);
            setConfigGracePeriod(systemConfig.grace_period);
        }
    }, [systemConfig]);

    const handleConfigUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setConfigLoading(true);
        setErrorMessage(""); setSuccessMessage("");
        try {
            const res = await updateSystemConfig({
                cluster_name: configClusterName,
                station_name: configStationName,
                location: configLocation,
                free_minutes: configFreeMinutes,
                hourly_rate: configHourlyRate,
                max_hours: configMaxHours,
                grace_period: configGracePeriod,
            });
            setSuccessMessage(res.message);
            await refreshData();
        } catch (err: unknown) {
            setErrorMessage((err as Error).message || "Failed to update configuration.");
        } finally {
            setConfigLoading(false);
        }
    };


    const getDurationText = (tx: DetailedTransaction) => {
        if (tx.completed_at && tx.created_at) {
            const start = new Date(tx.created_at).getTime();
            const end = new Date(tx.completed_at).getTime();
            const diffMs = end - start;
            const diffMins = Math.round(diffMs / 60000);
            if (diffMins < 60) return `${diffMins} mins`;
            const hrs = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            return `${hrs} hr ${mins} mins`;
        }
        if (tx.payment_status === "PAID" && tx.elapsed_seconds) {
            const mins = Math.floor(tx.elapsed_seconds / 60);
            if (mins < 60) return `${mins} mins (Active)`;
            const hrs = Math.floor(mins / 60);
            const rm = mins % 60;
            return `${hrs} hr ${rm} mins (Active)`;
        }
        return "—";
    };


    // ─── Dashboard ────────────────────────────────────────────────────────────
    const renderDashboard = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Locker Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: "14px" }}>
                {[
                    { label: "Total Lockers",  value: stats?.total_lockers    ?? "—", color: "#1e293b", bg: "#f8fafc", border: "#e2e8f0" },
                    { label: "Controllers",     value: stats?.controllers_count ?? "—", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
                    { label: "Available",        value: stats?.available_lockers ?? "—", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
                    { label: "In Use",           value: stats?.in_use_lockers    ?? "—", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
                ].map((tile) => (
                    <div key={tile.label} style={{ background: tile.bg, border: `1px solid ${tile.border}`, borderRadius: "20px", padding: "16px 14px" }}>
                        <p style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{tile.label}</p>
                        <p style={{ fontSize: isMobile ? "28px" : "40px", fontWeight: 900, color: tile.color, lineHeight: 1 }}>{tile.value}</p>
                    </div>
                ))}
            </div>

            {/* Revenue Stats & Range Selector Row */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "18px" }}>
                {/* Revenue Overview Card */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "22px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <DollarSign size={18} color="#16a34a" style={{ margin: "auto" }} />
                        </div>
                        <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>Revenue Overview</h3>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div style={{ padding: "14px", background: "#f0fdf4", borderRadius: "16px", border: "1px solid #bbf7d0" }}>
                            <p style={{ fontSize: "10px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Revenue Today</p>
                            <p style={{ fontSize: "20px", fontWeight: 900, color: "#15803d" }}>₹{revenue?.today.toFixed(2) ?? "0.00"}</p>
                        </div>
                        <div style={{ padding: "14px", background: "#eff6ff", borderRadius: "16px", border: "1px solid #bfdbfe" }}>
                            <p style={{ fontSize: "10px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>This Week</p>
                            <p style={{ fontSize: "20px", fontWeight: 900, color: "#1d4ed8" }}>₹{revenue?.week.toFixed(2) ?? "0.00"}</p>
                        </div>
                    </div>
                </div>

                {/* Range Selector Card */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "22px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Calendar size={18} color="#ea580c" style={{ margin: "auto" }} />
                        </div>
                        <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>Custom Date Revenue</h3>
                    </div>

                    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "12px", alignItems: isMobile ? "stretch" : "flex-end" }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Start Date</label>
                            <input 
                                type="date" 
                                value={customStartDate} 
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{ width: "100%", height: "38px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "0 10px", fontSize: "13px", fontWeight: 600, color: "#334155" }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>End Date</label>
                            <input 
                                type="date" 
                                value={customEndDate} 
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={{ width: "100%", height: "38px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "0 10px", fontSize: "13px", fontWeight: 600, color: "#334155" }}
                            />
                        </div>
                        <button 
                            onClick={handleCalculateCustomRevenue}
                            disabled={customRevenueLoading}
                            style={{ height: "38px", padding: "0 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                            {customRevenueLoading ? "..." : "Calculate"}
                        </button>
                    </div>

                    {customRevenue !== null && (
                        <div style={{ padding: "12px 16px", background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#6b21a8" }}>Calculated Revenue:</span>
                            <span style={{ fontSize: "18px", fontWeight: 900, color: "#6b21a8" }}>₹{customRevenue.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "320px 1fr", gap: "18px", alignItems: "start" }}>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", paddingBottom: "10px", borderBottom: "1px solid #f1f5f9" }}>System Health</h3>
                    {[
                        { label: "Camera Module",    key: "camera" },
                        { label: "Controllers",       key: "controllers" },
                        { label: "Payment Gateway",   key: "payment" },
                        { label: "Cluster Network",   key: "network" },
                    ].map((item) => {
                        const val = statusCheck?.[item.key as keyof SystemStatusResponse];
                        const online = val === "Online";
                        return (
                            <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", background: online ? "#f0fdf4" : "#fef2f2", borderRadius: "12px", border: `1px solid ${online ? "#bbf7d0" : "#fecaca"}` }}>
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>{item.label}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: online ? "#22c55e" : "#ef4444", display: "inline-block" }} />
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: online ? "#16a34a" : "#dc2626" }}>{val ?? "—"}</span>
                                </div>
                            </div>
                        );
                    })}
                    
                    {statusCheck?.hardware_mode && (
                        <div style={{ marginTop: "4px", padding: "10px 12px", background: statusCheck.hardware_mode.includes("Simulation") ? "#fffbeb" : "#f0fdf4", borderRadius: "12px", border: `1px solid ${statusCheck.hardware_mode.includes("Simulation") ? "#fde68a" : "#bbf7d0"}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Driver Mode</span>
                                <span style={{ fontSize: "12px", fontWeight: 850, color: statusCheck.hardware_mode.includes("Simulation") ? "#b45309" : "#15803d" }}>
                                    {statusCheck.hardware_mode}
                                </span>
                            </div>
                            {statusCheck.connected_ports && statusCheck.connected_ports.length > 0 ? (
                                <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    {statusCheck.connected_ports.map((port) => (
                                        <span key={port} style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", background: "#e2e8f0", color: "#475569", borderRadius: "6px", fontFamily: "monospace" }}>
                                            {port}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                !statusCheck.hardware_mode.includes("Simulation") && (
                                    <p style={{ fontSize: "10px", color: "#dc2626", fontWeight: 600, marginTop: "4px" }}>⚠️ No active USB Serial found</p>
                                )
                            )}
                        </div>
                    )}

                    <div style={{ padding: "9px 13px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Face AI Models</span>
                            <button onClick={() => setActiveTab("DEVTOOLS")} style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}>
                                Inspect <ChevronRight size={12} />
                            </button>
                        </div>
                        <p style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>YuNet + SFace (128-dim cosine)</p>
                    </div>
                </div>

                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "22px", padding: "22px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", paddingBottom: "10px", borderBottom: "1px solid #f1f5f9", marginBottom: "14px" }}>Recent Transactions</h3>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                            <thead>
                                <tr>
                                    {["Locker", "Flow", "Amount", "Status", "Time"].map((h) => (
                                        <th key={h} style={{ textAlign: "left", padding: "0 12px 10px 0", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "#94a3b8" }}>No transactions.</td></tr>
                                ) : transactions.map((tx) => (
                                    <tr key={tx.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                                        <td style={{ padding: "11px 12px 11px 0", fontWeight: 700, color: "#1e293b" }}>{tx.locker_id}</td>
                                        <td style={{ padding: "11px 12px 11px 0" }}>
                                            <span style={{ padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: tx.flow_type === "DEPOSIT" ? "#eff6ff" : "#f0fdf4", color: tx.flow_type === "DEPOSIT" ? "#2563eb" : "#16a34a" }}>{tx.flow_type}</span>
                                        </td>
                                        <td style={{ padding: "11px 12px 11px 0", fontWeight: 600, color: "#475569" }}>₹{tx.amount}</td>
                                        <td style={{ padding: "11px 12px 11px 0", fontWeight: 700, fontSize: "11px", color: tx.payment_status === "PAID" ? "#16a34a" : "#d97706" }}>{tx.payment_status}</td>
                                        <td style={{ padding: "11px 0", color: "#94a3b8", fontSize: "12px" }}>{tx.created_at?.slice(0, 16)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
    // ─── Transactions Tab ─────────────────────────────────────────────────────
    const renderTransactionsTab = () => {
        const filteredTx = detailedTransactions.filter(tx => {
            if (txTabFilter === "ALL") return true;
            if (txTabFilter === "DEPOSIT") return tx.flow_type === "DEPOSIT";
            if (txTabFilter === "RETRIEVE") return tx.flow_type === "RETRIEVE";
            if (txTabFilter === "FAILED") return tx.payment_status === "FAILED";
            return true;
        });

        return (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "22px", padding: isMobile ? "18px 16px" : "26px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "16px", gap: "12px" }}>
                    <div>
                        <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>Transaction History</h3>
                        <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>Showing last {detailedTransactions.length} operations on this cluster</p>
                    </div>

                    {/* Sub-tabs / Filters */}
                    <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "12px", padding: "4px", alignSelf: isMobile ? "stretch" : "auto", overflowX: "auto" }}>
                        {(["ALL", "DEPOSIT", "RETRIEVE", "FAILED"] as const).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setTxTabFilter(filter)}
                                style={{
                                    border: "none",
                                    flex: isMobile ? 1 : "none",
                                    background: txTabFilter === filter ? "#fff" : "transparent",
                                    color: txTabFilter === filter ? "#1e293b" : "#64748b",
                                    fontWeight: 700,
                                    fontSize: "11px",
                                    padding: "6px 10px",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    boxShadow: txTabFilter === filter ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                                    transition: "all 0.15s",
                                    whiteSpace: "nowrap"
                                }}
                            >
                                {filter === "ALL" && "All"}
                                {filter === "DEPOSIT" && "Deposits"}
                                {filter === "RETRIEVE" && "Retrievals"}
                                {filter === "FAILED" && "Failed"}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: "750px", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                            <tr style={{ color: "#94a3b8", borderBottom: "2px solid #f1f5f9" }}>
                                {["Locker", "Transaction ID", "Flow", "Amount", "Status", "Payment Reference", "Duration / Elapsed", "Time Enrolled"].map((h) => (
                                    <th key={h} style={{ textAlign: "left", padding: "10px 12px 10px 0", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTx.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#94a3b8", fontWeight: 600 }}>No matching transactions found.</td></tr>
                            ) : filteredTx.map((tx) => (
                                <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ padding: "12px 12px 12px 0", fontWeight: 800, color: "#0f172a" }}>Locker {tx.locker_id}</td>
                                    <td style={{ padding: "12px 12px 12px 0", fontFamily: "monospace", color: "#475569" }}>{tx.transaction_id}</td>
                                    <td style={{ padding: "12px 12px 12px 0" }}>
                                        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 800, background: tx.flow_type === "DEPOSIT" ? "#eff6ff" : "#f0fdf4", color: tx.flow_type === "DEPOSIT" ? "#2563eb" : "#16a34a" }}>
                                            {tx.flow_type}
                                        </span>
                                    </td>
                                    <td style={{ padding: "12px 12px 12px 0", fontWeight: 700, color: "#1e293b" }}>₹{tx.amount}</td>
                                    <td style={{ padding: "12px 12px 12px 0" }}>
                                        <span style={{
                                            fontWeight: 800,
                                            fontSize: "11px",
                                            color: tx.payment_status === "PAID" ? "#16a34a" : tx.payment_status === "FAILED" ? "#ef4444" : "#d97706"
                                        }}>
                                            {tx.payment_status}
                                        </span>
                                    </td>
                                    <td style={{ padding: "12px 12px 12px 0", fontFamily: "monospace", color: tx.payment_ref ? "#334155" : "#cbd5e1" }}>
                                        {tx.payment_ref || "—"}
                                    </td>
                                    <td style={{ padding: "12px 12px 12px 0", fontWeight: 600, color: "#475569" }}>
                                        {getDurationText(tx)}
                                    </td>
                                    <td style={{ padding: "12px 0", color: "#64748b", fontSize: "12px" }}>
                                        {tx.created_at}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // ─── Settings Tab ─────────────────────────────────────────────────────────
    const renderSettingsTab = () => (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "22px", alignItems: "start" }}>
            {/* Change Password Panel */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "22px", padding: "26px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #f1f5f9", paddingBottom: "14px", marginBottom: "18px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Lock size={18} color="#ef4444" />
                    </div>
                    <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>Update Password</h3>
                </div>

                <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div>
                        <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "5px" }}>Current Password</label>
                        <input
                            type="password"
                            value={changePwOld}
                            onChange={(e) => setChangePwOld(e.target.value)}
                            required
                            style={{ width: "100%", height: "40px", border: "1.5px solid #e2e8f0", borderRadius: "11px", padding: "0 12px", fontSize: "13px", color: "#334155" }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "5px" }}>New Password</label>
                        <input
                            type="password"
                            value={changePwNew}
                            onChange={(e) => setChangePwNew(e.target.value)}
                            required
                            style={{ width: "100%", height: "40px", border: "1.5px solid #e2e8f0", borderRadius: "11px", padding: "0 12px", fontSize: "13px", color: "#334155" }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "5px" }}>Confirm New Password</label>
                        <input
                            type="password"
                            value={changePwConfirm}
                            onChange={(e) => setChangePwConfirm(e.target.value)}
                            required
                            style={{ width: "100%", height: "40px", border: "1.5px solid #e2e8f0", borderRadius: "11px", padding: "0 12px", fontSize: "13px", color: "#334155" }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={changePwLoading}
                        style={{ height: "42px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "11px", fontWeight: 700, fontSize: "13px", cursor: "pointer", marginTop: "6px" }}
                    >
                        {changePwLoading ? "Changing..." : "Change Password"}
                    </button>
                </form>
            </div>

            {/* Cluster Configuration Panel */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "22px", padding: "26px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #f1f5f9", paddingBottom: "14px", marginBottom: "18px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Server size={18} color="#2563eb" />
                    </div>
                    <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>Edit Kiosk Settings</h3>
                </div>

                <form onSubmit={handleConfigUpdate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Cluster Name</label>
                            <input
                                type="text"
                                value={configClusterName}
                                onChange={(e) => setConfigClusterName(e.target.value)}
                                required
                                style={{ width: "100%", height: "38px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "0 10px", fontSize: "13px", color: "#334155" }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Station Name</label>
                            <input
                                type="text"
                                value={configStationName}
                                onChange={(e) => setConfigStationName(e.target.value)}
                                required
                                style={{ width: "100%", height: "38px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "0 10px", fontSize: "13px", color: "#334155" }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Physical Location</label>
                        <input
                            type="text"
                            value={configLocation}
                            onChange={(e) => setConfigLocation(e.target.value)}
                            required
                            style={{ width: "100%", height: "38px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "0 10px", fontSize: "13px", color: "#334155" }}
                        />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Hourly Rate (₹)</label>
                            <input
                                type="number"
                                value={configHourlyRate}
                                onChange={(e) => setConfigHourlyRate(Number(e.target.value))}
                                required
                                min="0"
                                style={{ width: "100%", height: "38px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "0 10px", fontSize: "13px", color: "#334155" }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Grace Period (mins)</label>
                            <input
                                type="number"
                                value={configGracePeriod}
                                onChange={(e) => setConfigGracePeriod(Number(e.target.value))}
                                required
                                min="0"
                                style={{ width: "100%", height: "38px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "0 10px", fontSize: "13px", color: "#334155" }}
                            />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Free Minutes</label>
                            <input
                                type="number"
                                value={configFreeMinutes}
                                onChange={(e) => setConfigFreeMinutes(Number(e.target.value))}
                                required
                                min="0"
                                style={{ width: "100%", height: "38px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "0 10px", fontSize: "13px", color: "#334155" }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Max Rental Hours</label>
                            <input
                                type="number"
                                value={configMaxHours}
                                onChange={(e) => setConfigMaxHours(Number(e.target.value))}
                                required
                                min="1"
                                style={{ width: "100%", height: "38px", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "0 10px", fontSize: "13px", color: "#334155" }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={configLoading}
                        style={{ height: "40px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "11px", fontWeight: 700, fontSize: "13px", cursor: "pointer", marginTop: "8px" }}
                    >
                        {configLoading ? "Saving..." : "Save Settings"}
                    </button>
                </form>
            </div>
        </div>
    );


    // ─── Lockers ──────────────────────────────────────────────────────────────
    const renderLockersList = () => (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "22px", padding: "26px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>Locker Grid — Click to manage</h3>
                <button 
                    onClick={() => setShowResetConfirm(true)} 
                    style={{ display: "flex", alignItems: "center", gap: "7px", padding: "6px 14px", borderRadius: "10px", border: "1.5px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                >
                    <RotateCcw size={13} /> Reset All Lockers
                </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: "12px" }}>
                {lockers.map((locker) => {
                    const s: Record<string, { bg: string; color: string; border: string }> = {
                        AVAILABLE:   { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
                        IN_USE:      { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
                        RESERVED:    { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
                        MAINTENANCE: { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
                    };
                    const st = s[locker.status] ?? s.MAINTENANCE;
                    return (
                        <button key={locker.id} onClick={() => setSelectedLocker(locker)}
                            style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 6px", borderRadius: "14px", border: `2px solid ${st.border}`, background: st.bg, color: st.color, fontWeight: 800, fontSize: "15px", cursor: "pointer", gap: "4px" }}>
                            <span>{locker.id}</span>
                            <span style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", opacity: 0.8 }}>{locker.status.replace("_", " ")}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    // ─── Logs ─────────────────────────────────────────────────────────────────
    const renderLogs = () => (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "22px", padding: "26px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", paddingBottom: "10px", borderBottom: "1px solid #f1f5f9", marginBottom: "14px" }}>System Audit Trail</h3>
            <div style={{ maxHeight: "520px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "7px" }}>
                {logs.map((log) => {
                    const c = {
                        INFO:    { bg: "#f8fafc", color: "#475569", border: "#e2e8f0", badge: "#64748b" },
                        WARNING: { bg: "#fffbeb", color: "#92400e", border: "#fde68a", badge: "#d97706" },
                        ERROR:   { bg: "#fef2f2", color: "#991b1b", border: "#fecaca", badge: "#dc2626" },
                    };
                    const st = c[log.level] ?? c.INFO;
                    return (
                        <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "11px 14px", borderRadius: "11px", background: st.bg, border: `1px solid ${st.border}` }}>
                            <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "monospace", whiteSpace: "nowrap", paddingTop: "1px" }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                            <span style={{ padding: "2px 7px", borderRadius: "5px", background: st.badge, color: "#fff", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", whiteSpace: "nowrap" }}>{log.level}</span>
                            <span style={{ fontSize: "12px", color: st.color, lineHeight: 1.5, fontFamily: "monospace" }}>{log.message}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    // ─── Dev Tools ────────────────────────────────────────────────────────────
    const renderDevTools = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* Algorithm Info */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "22px", padding: "26px", color: "#e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Cpu size={20} color="#60a5fa" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#f1f5f9" }}>Face Recognition Algorithm</h3>
                        <p style={{ fontSize: "12px", color: "#64748b" }}>OpenCV YuNet · SFace ONNX Pipeline</p>
                    </div>
                </div>

                {faceDebugInfo ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                        <div style={{ background: "#1e293b", borderRadius: "14px", padding: "16px" }}>
                            <p style={{ fontSize: "10px", fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Detection Stage</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <Row label="Model" value={faceDebugInfo.algorithm.detection_model} />
                                <Row label="File"  value={faceDebugInfo.algorithm.detection_model_file} mono />
                                <Row label="On Disk" value={faceDebugInfo.model_status.yunet_on_disk ? `✓ ${faceDebugInfo.model_status.yunet_size_kb} KB` : "✗ Missing"} color={faceDebugInfo.model_status.yunet_on_disk ? "#4ade80" : "#f87171"} />
                                <Row label="Loaded"  value={faceDebugInfo.model_status.yunet_loaded  ? "✓ Active" : "✗ Not loaded"} color={faceDebugInfo.model_status.yunet_loaded ? "#4ade80" : "#f87171"} />
                            </div>
                        </div>

                        <div style={{ background: "#1e293b", borderRadius: "14px", padding: "16px" }}>
                            <p style={{ fontSize: "10px", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Recognition Stage</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <Row label="Model" value={faceDebugInfo.algorithm.recognition_model} />
                                <Row label="File"  value={faceDebugInfo.algorithm.recognition_model_file} mono />
                                <Row label="On Disk" value={faceDebugInfo.model_status.sface_on_disk ? `✓ ${faceDebugInfo.model_status.sface_size_kb} KB` : "✗ Missing"} color={faceDebugInfo.model_status.sface_on_disk ? "#4ade80" : "#f87171"} />
                                <Row label="Embedding" value={`${faceDebugInfo.algorithm.embedding_dimensions}-dim vector`} />
                            </div>
                        </div>

                        <div style={{ background: "#1e293b", borderRadius: "14px", padding: "16px" }}>
                            <p style={{ fontSize: "10px", fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Matching Config</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <Row label="Metric"        value={faceDebugInfo.algorithm.similarity_metric} />
                                <Row label="Threshold"     value={`≥ ${faceDebugInfo.algorithm.match_threshold}`} color="#fbbf24" />
                                <Row label="Enrolled"      value={`${faceDebugInfo.database.active_enrolled_faces} active faces`} />
                                <Row label="Grace Period"  value={`${faceDebugInfo.database.grace_period_minutes} min`} />
                            </div>
                        </div>

                        <div style={{ background: "#1e293b", borderRadius: "14px", padding: "16px" }}>
                            <p style={{ fontSize: "10px", fontWeight: 700, color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Pipeline Flow</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {["1. Camera sends JPEG frame", "2. YuNet detects face + 5 keypoints", "3. SFace aligns crop → 128-dim vector", "4. Cosine similarity vs stored embeddings", "5. Match if similarity ≥ threshold"].map((step) => (
                                    <p key={step} style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.5 }}>{step}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "20px" }}>
                        <RefreshCw size={18} color="#64748b" />
                        <span style={{ color: "#64748b", fontSize: "14px" }}>Loading algorithm info...</span>
                    </div>
                )}
            </div>

            {/* Live Debug */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "22px", padding: "26px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Eye size={20} color="#10b981" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>Live Debug Inspector</h3>
                        <p style={{ fontSize: "12px", color: "#94a3b8" }}>Capture a frame and see raw cosine similarity scores vs every enrolled face</p>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", alignItems: "start" }}>
                    {/* Camera preview with controls overlaid */}
                    <div style={{ position: "relative", height: "220px", borderRadius: "18px", overflow: "hidden", background: "#0f172a" }}>
                        {/* Video / placeholder */}
                        {cameraStream ? (
                            <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} muted playsInline />
                        ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                                <Camera size={32} color="#334155" />
                                <p style={{ color: "#64748b", fontSize: "13px" }}>{cameraError ? "Camera unavailable" : "Camera not started"}</p>
                            </div>
                        )}

                        {/* Button bar — always visible at the bottom */}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px", background: "linear-gradient(to top, rgba(15,23,42,0.9) 0%, transparent 100%)", display: "flex", gap: "8px" }}>
                            {!cameraStream ? (
                                <button onClick={startDevCamera} style={{ flex: 1, height: "40px", background: "#2563eb", color: "#fff", borderRadius: "11px", border: "none", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                                    <Camera size={15} /> Start Camera
                                </button>
                            ) : (
                                <>
                                    <button onClick={runLiveScan} disabled={liveDebugLoading} style={{ flex: 1, height: "40px", background: "#10b981", color: "#fff", borderRadius: "11px", border: "none", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                                        {liveDebugLoading ? <><RefreshCw size={14} /> Scanning...</> : <><Zap size={15} /> Scan Frame</>}
                                    </button>
                                    <button onClick={stopDevCamera} style={{ height: "40px", width: "40px", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", borderRadius: "11px", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <X size={15} color="#fff" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div style={{ background: "#f8fafc", borderRadius: "18px", border: "1px solid #e2e8f0", padding: "18px", minHeight: "220px" }}>
                        {!liveDebugResult ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "180px", gap: "10px" }}>
                                <Activity size={28} color="#cbd5e1" />
                                <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center" }}>Run a scan to see similarity scores</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: liveDebugResult.detection_success ? "#22c55e" : "#ef4444", display: "inline-block" }} />
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: liveDebugResult.detection_success ? "#16a34a" : "#dc2626" }}>{liveDebugResult.detection_message}</span>
                                </div>
                                {liveDebugResult.embedding_dims && (
                                    <p style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>Embedding: {liveDebugResult.embedding_dims}-dim · Model: {liveDebugResult.model_active ? "Active" : "Mock"}</p>
                                )}
                                {liveDebugResult.candidates.length === 0 ? (
                                    <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "8px" }}>No enrolled faces to compare against.</p>
                                ) : liveDebugResult.candidates.map((c) => (
                                    <div key={c.transaction_id} style={{ background: "#fff", borderRadius: "11px", border: `2px solid ${c.would_match ? "#bbf7d0" : "#e2e8f0"}`, padding: "11px 13px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontWeight: 700, fontSize: "13px", color: "#1e293b" }}>Locker {c.locker_id}</span>
                                            <span style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 800, background: c.would_match ? "#dcfce7" : "#f1f5f9", color: c.would_match ? "#15803d" : "#64748b" }}>
                                                {c.would_match ? "MATCH" : "NO MATCH"}
                                            </span>
                                        </div>
                                        <div style={{ marginTop: "8px" }}>
                                            <div style={{ width: "100%", height: "5px", borderRadius: "999px", background: "#e2e8f0", overflow: "hidden" }}>
                                                <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, c.similarity_pct))}%`, background: c.would_match ? "#22c55e" : "#94a3b8", borderRadius: "999px", transition: "width 0.5s ease" }} />
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                                                <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>{c.similarity.toFixed(4)}</span>
                                                <span style={{ fontSize: "11px", color: "#94a3b8" }}>threshold: {c.threshold}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // ─── Main render ──────────────────────────────────────────────────────────
    const tabs: { id: ActiveTab; icon: React.ReactNode; label: string }[] = [
        { id: "DASHBOARD", icon: <LayoutDashboard size={19} />, label: "Dashboard" },
        { id: "TRANSACTIONS", icon: <CreditCard size={19} />, label: "Transactions" },
        { id: "LOCKERS",   icon: <Layers size={19} />,           label: "Lockers" },
        { id: "LOGS",      icon: <History size={19} />,           label: "Logs" },
        { id: "DEVTOOLS",  icon: <Cpu size={19} />,               label: "Dev Tools" },
        { id: "SETTINGS",  icon: <Settings size={19} />,          label: "Settings" },
    ];

    if (!isAuthenticated) {
        return (
            <AppLayout>
                <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                    <div style={{ width: "100%", maxWidth: "400px", background: "#ffffff", borderRadius: "28px", border: "1px solid #e2e8f0", boxShadow: "0 20px 50px rgba(15,23,42,0.08)", padding: "36px", display: "flex", flexDirection: "column", gap: "24px", textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                            <img src="/images/branding/simats-logo.png" alt="Logo" style={{ height: "48px", objectFit: "contain", borderRadius: "10px" }} />
                            <div>
                                <h2 style={{ fontSize: "20px", fontWeight: 900, color: "#0f172a" }}>Admin Console</h2>
                                <p style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Smart Locker Management Portal</p>
                            </div>
                        </div>

                        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ textAlign: "left" }}>
                                <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Enter Password</label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={passwordInput}
                                        onChange={(e) => setPasswordInput(e.target.value)}
                                        required
                                        style={{ width: "100%", height: "44px", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "0 14px 0 40px", fontSize: "14px", color: "#334155" }}
                                    />
                                    <div style={{ position: "absolute", left: "14px", top: "13px", color: "#94a3b8" }}>
                                        <Lock size={16} />
                                    </div>
                                </div>
                            </div>

                            {authError && (
                                <p style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600, background: "#fef2f2", padding: "8px 12px", borderRadius: "8px", border: "1px solid #fecaca" }}>
                                    {authError}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={authLoading}
                                style={{ width: "100%", height: "44px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
                            >
                                {authLoading ? "Authenticating..." : "Login"}
                            </button>
                        </form>

                        <button 
                            onClick={() => navigate("/home")}
                            style={{ border: "none", background: "none", color: "#64748b", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                        >
                            Return to Kiosk Mode
                        </button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div style={{ height: "100vh", display: "flex", background: "#f1f5f9", overflow: "hidden", position: "relative" }}>

                {/* SIDEBAR BACKDROP FOR MOBILE */}
                {isMobile && isSidebarOpen && (
                    <div 
                        onClick={() => setIsSidebarOpen(false)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(15, 23, 42, 0.4)",
                            backdropFilter: "blur(4px)",
                            zIndex: 90,
                        }}
                    />
                )}

                {/* SIDEBAR */}
                <aside style={{ 
                    width: "230px", 
                    background: "#0f172a", 
                    display: "flex", 
                    flexDirection: "column", 
                    padding: "22px 14px", 
                    gap: "28px", 
                    flexShrink: 0, 
                    boxShadow: "4px 0 24px rgba(0,0,0,0.2)",
                    position: isMobile ? "fixed" : "relative",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 100,
                    transform: isMobile ? (isSidebarOpen ? "translateX(0)" : "translateX(-100%)") : "none",
                    transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "4px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <img src="/images/branding/simats-logo.png" alt="SIMATS Logo" style={{ height: "34px", objectFit: "contain", borderRadius: "8px" }} />
                            <div>
                                <p style={{ fontSize: "13px", fontWeight: 800, color: "#f1f5f9", lineHeight: 1.2 }}>Smart Locker</p>
                                <p style={{ fontSize: "10px", color: "#475569", fontWeight: 600 }}>Admin Console</p>
                            </div>
                        </div>
                        {isMobile && (
                            <button 
                                onClick={() => setIsSidebarOpen(false)}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#64748b",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center"
                                }}
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    <nav style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                        {tabs.map((tab) => {
                            const active = activeTab === tab.id;
                            return (
                                <button key={tab.id} onClick={() => {
                                    setActiveTab(tab.id);
                                    if (isMobile) setIsSidebarOpen(false);
                                }}
                                    style={{ display: "flex", alignItems: "center", gap: "11px", padding: "11px 13px", borderRadius: "13px", border: "none", background: active ? "#1e3a8a" : "transparent", color: active ? "#93c5fd" : "#475569", fontWeight: active ? 700 : 600, fontSize: "14px", cursor: "pointer", width: "100%", textAlign: "left" }}>
                                    {tab.icon}
                                    {tab.label}
                                    {tab.id === "DEVTOOLS" && (
                                        <span style={{ marginLeft: "auto", fontSize: "9px", fontWeight: 800, padding: "2px 6px", background: "#1d4ed8", color: "#93c5fd", borderRadius: "20px", textTransform: "uppercase" }}>New</span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    <button 
                        onClick={() => {
                            sessionStorage.removeItem("admin_authenticated");
                            sessionStorage.removeItem("admin_password_default");
                            setIsAuthenticated(false);
                        }} 
                        style={{ display: "flex", alignItems: "center", gap: "11px", padding: "11px 13px", borderRadius: "13px", border: "1px solid #1e293b", background: "transparent", color: "#64748b", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
                    >
                        <Lock size={17} /> Lock Console
                    </button>
                </aside>

                {/* MAIN */}
                <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
                    <header style={{ height: "68px", background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "0 16px" : "0 30px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            {isMobile && (
                                <button 
                                    onClick={() => setIsSidebarOpen(true)}
                                    style={{
                                        marginRight: "6px",
                                        padding: "6px",
                                        border: "none",
                                        background: "transparent",
                                        color: "#0f172a",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center"
                                    }}
                                >
                                    <Menu size={20} />
                                </button>
                            )}
                            <h1 style={{ fontSize: isMobile ? "17px" : "19px", fontWeight: 900, color: "#0f172a" }}>{tabs.find((t) => t.id === activeTab)?.label ?? "Dashboard"}</h1>
                            {isLoading && <RefreshCw size={15} color="#94a3b8" className="animate-spin" />}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 13px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "20px" }}>
                                <ShieldCheck size={13} color="#16a34a" />
                                <span style={{ fontSize: "12px", fontWeight: 700, color: "#16a34a" }}>Admin Mode</span>
                            </div>
                            <button onClick={refreshData} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "7px 15px", borderRadius: "11px", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                                <RefreshCw size={14} /> Refresh
                            </button>
                        </div>
                    </header>

                    <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: isMobile ? "16px 12px" : "26px 30px" }}>
                        {isPasswordDefault && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "9px", padding: "13px 16px", borderRadius: "13px", background: "#fffbeb", border: "1px solid #fde68a", color: "#b45309", marginBottom: "18px", fontSize: "13px", fontWeight: 600 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <AlertTriangle size={17} />
                                    <span>Warning: You are logged in with the default password. Please update it immediately.</span>
                                </div>
                                <button 
                                    onClick={() => setActiveTab("SETTINGS")}
                                    style={{ border: "none", background: "#d97706", color: "#fff", padding: "6px 12px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontSize: "11px" }}
                                >
                                    Change Password
                                </button>
                            </div>
                        )}

                        {successMessage && (
                            <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "13px 16px", borderRadius: "13px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", marginBottom: "18px", fontSize: "13px", fontWeight: 600 }}>
                                <Check size={17} /> {successMessage}
                            </div>
                        )}
                        {errorMessage && (
                            <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "13px 16px", borderRadius: "13px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", marginBottom: "18px", fontSize: "13px", fontWeight: 600 }}>
                                <AlertTriangle size={17} /> {errorMessage}
                            </div>
                        )}

                        {activeTab === "DASHBOARD" && renderDashboard()}
                        {activeTab === "TRANSACTIONS" && renderTransactionsTab()}
                        {activeTab === "LOCKERS"   && renderLockersList()}
                        {activeTab === "LOGS"      && renderLogs()}
                        {activeTab === "DEVTOOLS"  && renderDevTools()}
                        {activeTab === "SETTINGS"  && renderSettingsTab()}
                    </div>
                </main>
            </div>

            {/* Override Modal */}
            {selectedLocker && (
                <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.65)", backdropFilter: "blur(6px)" }}>
                    <div style={{ width: "100%", maxWidth: "420px", background: "#fff", borderRadius: "26px", border: "1px solid #e2e8f0", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", padding: "30px", position: "relative", display: "flex", flexDirection: "column", gap: "22px" }}>
                        <button onClick={() => setSelectedLocker(null)} style={{ position: "absolute", top: "18px", right: "18px", background: "#f1f5f9", border: "none", borderRadius: "10px", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <X size={15} color="#64748b" />
                        </button>

                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Server size={24} color="#2563eb" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a" }}>Locker {selectedLocker.id}</h3>
                                <p style={{ fontSize: "12px", color: "#64748b" }}>Controller: {selectedLocker.controller_id} · Unit #{selectedLocker.locker_number}</p>
                            </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", borderRadius: "13px", border: "1px solid #e2e8f0" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748b" }}>Current Status</span>
                            <span style={{ fontSize: "13px", fontWeight: 800, color: "#1e293b" }}>{selectedLocker.status}</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            {[
                                { action: "UNLOCK"      as const, label: "Force Open",      icon: <Unlock size={15} />,       bg: "#fff",    color: "#475569", border: "#e2e8f0" },
                                { action: "RELEASE"     as const, label: "Release Locker",  icon: <UserCheck size={15} />,    bg: "#16a34a", color: "#fff",    border: "#15803d" },
                                { action: "MAINTENANCE" as const, label: "Set Maintenance", icon: <AlertTriangle size={15} />,bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
                                { action: "AVAILABLE"   as const, label: "Set Available",   icon: <Check size={15} />,        bg: "#f8fafc", color: "#475569", border: "#e2e8f0" },
                            ].map((btn) => (
                                <button key={btn.action} onClick={() => handleOverride(selectedLocker.id, btn.action)} disabled={selectedActionLoading}
                                    style={{ height: "50px", borderRadius: "13px", border: `1.5px solid ${btn.border}`, background: btn.bg, color: btn.color, fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                                    {btn.icon} {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── RESET ALL CONFIRMATION MODAL ─────────────────────────────── */}
            {showResetConfirm && (
                <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.75)", backdropFilter: "blur(8px)" }}>
                    <div style={{ width: "100%", maxWidth: "400px", background: "#fff", borderRadius: "24px", border: "1px solid #fecaca", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)", padding: "32px", display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Trash2 size={24} color="#dc2626" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: "17px", fontWeight: 900, color: "#0f172a" }}>Reset All Lockers?</h3>
                                <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>This cannot be undone</p>
                            </div>
                        </div>

                        <div style={{ padding: "14px 16px", background: "#fef2f2", borderRadius: "13px", border: "1px solid #fecaca" }}>
                            <p style={{ fontSize: "13px", color: "#991b1b", lineHeight: 1.6 }}>
                                This will:<br />
                                • Release all <strong>IN_USE</strong> and <strong>RESERVED</strong> lockers → AVAILABLE<br />
                                • Close all open transactions<br />
                                • Clear all face registrations from active sessions
                            </p>
                        </div>

                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                style={{ flex: 1, height: "46px", borderRadius: "13px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResetAll}
                                disabled={resetLoading}
                                style={{ flex: 1, height: "46px", borderRadius: "13px", border: "none", background: resetLoading ? "#fca5a5" : "#dc2626", color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                            >
                                {resetLoading ? <><RefreshCw size={14} /> Resetting...</> : <><RotateCcw size={15} /> Yes, Reset All</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

