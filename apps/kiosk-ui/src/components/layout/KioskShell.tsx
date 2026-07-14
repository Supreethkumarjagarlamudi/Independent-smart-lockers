import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { getClusterStatus } from "../../api/cluster";
import { AppLayout } from "./AppLayout";

type KioskShellProps = {
    children: ReactNode;
};

export function KioskShell({ children }: KioskShellProps) {
    const navigate = useNavigate();
    const [clusterName, setClusterName] = useState("Engineering Block A");
    const [stationName, setStationName] = useState("Locker Station 01");
    const [time, setTime] = useState("");

    // Fetch cluster metadata
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const status = await getClusterStatus();
                if (status.initialized) {
                    if ((status as any).cluster_name) setClusterName((status as any).cluster_name);
                    if ((status as any).station_name) setStationName((status as any).station_name);
                }
            } catch (err) {
                console.error("Failed to fetch cluster status in KioskShell", err);
            }
        };
        fetchStatus();
    }, []);

    // Live clock
    useEffect(() => {
        const updateTime = () => {
            setTime(new Intl.DateTimeFormat("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            }).format(new Date()));
        };
        updateTime();
        const interval = setInterval(updateTime, 10000);
        return () => clearInterval(interval);
    }, []);

    const generateKioskId = () => {
        if (!clusterName) return "SL-ENG-A-01";
        const cWords = clusterName.split(/\s+/).map(w => w[0]).join("").toUpperCase();
        const sNum = stationName.replace(/[^0-9]/g, "");
        const sChar = stationName.split(/\s+/).map(w => w[0]).join("").toUpperCase();
        
        const part1 = cWords.length >= 2 ? cWords : clusterName.substring(0, 3).toUpperCase();
        const part2 = sNum ? sNum : sChar || "01";
        return `SL-${part1}-${part2}`;
    };

    return (
        <AppLayout>
            <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8">
                <div 
                    className="w-full max-w-[480px] rounded-[36px] border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)] flex flex-col overflow-hidden"
                    style={{ minHeight: "580px" }}
                >
                    {/* Header */}
                    <header 
                        style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "space-between", 
                            borderBottom: "1px solid #f1f5f9", 
                            padding: "24px 28px", 
                            userSelect: "none", 
                            flexShrink: 0 
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <img
                                src="/images/branding/simats-logo.png"
                                alt="SIMATS"
                                className="h-9 w-9 object-contain cursor-default active:scale-95 transition-transform"
                                style={{ display: "block" }}
                            />
                            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#1d4ed8", letterSpacing: "-0.01em" }}>
                                {clusterName}
                            </span>
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b", letterSpacing: "-0.01em" }}>
                            {time}
                        </span>
                    </header>

                    {/* Content area */}
                    <div 
                        style={{ 
                            flex: 1, 
                            display: "flex", 
                            flexDirection: "column", 
                            padding: "28px 32px", 
                            justifyContent: "center", 
                            overflowY: "auto" 
                        }}
                    >
                        {children}
                    </div>

                    {/* Footer */}
                    <footer 
                        style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "space-between", 
                            borderTop: "1px solid #f1f5f9", 
                            padding: "18px 28px", 
                            userSelect: "none", 
                            flexShrink: 0, 
                            fontSize: "12px", 
                            fontWeight: 600, 
                            color: "#64748b", 
                            backgroundColor: "#f8fafc" 
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <CheckCircle2 size={16} className="text-green-500" />
                            <span>
                                Status: <span style={{ color: "#16a34a", fontWeight: "bold" }}>Ready</span>
                            </span>
                        </div>
                        <span className="cursor-default" onClick={() => navigate("/admin")}>
                            ID: <span style={{ color: "#2563eb", fontWeight: "bold" }}>{generateKioskId()}</span>
                        </span>
                    </footer>
                </div>
            </div>
        </AppLayout>
    );
}
