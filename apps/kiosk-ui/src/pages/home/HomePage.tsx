import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Lock, Package } from "lucide-react";
import { KioskShell } from "../../components/layout/KioskShell";
import { getLockers } from "../../api/lockers";
import type { LockerInfo } from "../../api/lockers";

export default function HomePage() {
    const navigate = useNavigate();
    const [lockers, setLockers] = useState<LockerInfo[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getLockers()
            .then((data) => {
                setLockers(data);
            })
            .catch((err) => {
                console.error("Failed to fetch lockers on home page:", err);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const totalCount = lockers ? lockers.length : 0;
    const availableCount = lockers ? lockers.filter((l) => l.status === "AVAILABLE").length : 0;
    const isFull = lockers !== null && availableCount === 0;

    const footerCenterNode = !isLoading && lockers !== null ? (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ 
                display: "inline-flex", 
                alignItems: "center", 
                gap: "6px", 
                fontSize: "12px", 
                fontWeight: 600, 
                whiteSpace: "nowrap",
                color: isFull ? "#e11d48" : "#475569"
            }}
        >
            <motion.span 
                animate={!isFull ? { scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] } : {}}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                style={{ 
                    width: "7px", 
                    height: "7px", 
                    borderRadius: "50%", 
                    backgroundColor: isFull ? "#e11d48" : "#10b981", 
                    flexShrink: 0 
                }} 
            />
            <span>
                {isFull ? (
                    <span style={{ fontWeight: 700, color: "#e11d48" }}>All Occupied</span>
                ) : (
                    <>
                        <span style={{ fontWeight: 700, color: "#059669" }}>{availableCount}/{totalCount}</span> Available
                    </>
                )}
            </span>
        </motion.div>
    ) : null;

    return (
        <KioskShell footerCenter={footerCenterNode}>
            {/* Welcome text */}
            <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col items-center text-center select-none"
            >
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 leading-none">
                    Welcome!
                </h1>
                <p className="mt-3 text-base text-slate-500 font-medium">
                    What would you like to do today?
                </p>
            </motion.section>

            {/* Action buttons */}
            <section 
                className="flex flex-col gap-6 items-center"
                style={{ margin: "28px auto 12px auto", width: "100%", maxWidth: "280px" }}
            >
                {/* Deposit button */}
                <motion.button
                    whileHover={!isFull ? { y: -4, scale: 1.02 } : undefined}
                    whileTap={!isFull ? { scale: 0.98 } : undefined}
                    disabled={isFull}
                    onClick={() => {
                        if (!isFull) navigate("/deposit");
                    }}
                    className={`group w-full h-[170px] rounded-3xl shadow-md flex flex-col items-center justify-center text-white transition-all ${
                        isFull
                            ? "bg-slate-300 text-slate-400 cursor-not-allowed opacity-60 shadow-none"
                            : "bg-gradient-to-br from-blue-600 to-blue-500 hover:shadow-xl hover:shadow-blue-500/10 cursor-pointer"
                    }`}
                >
                    <div className={`flex items-center justify-center h-14 w-14 rounded-2xl ${isFull ? "bg-slate-400/20" : "bg-white/10 group-hover:scale-105"} transition-transform`}>
                        <Lock size={28} strokeWidth={1.8} />
                    </div>
                    <h2 className="mt-3 text-2xl font-extrabold tracking-tight">Drop</h2>
                    <p className={`mt-1 text-xs font-medium ${isFull ? "text-slate-400" : "text-blue-100"}`}>
                        {isFull ? "No Lockers Available" : "Store your items safely"}
                    </p>
                </motion.button>

                {/* Retrieve button */}
                <motion.button
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate("/retrieve")}
                    className="group w-full h-[170px] rounded-3xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-md hover:shadow-xl hover:shadow-green-500/10 flex flex-col items-center justify-center text-white cursor-pointer"
                >
                    <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-white/10 group-hover:scale-105 transition-transform">
                        <Package size={28} strokeWidth={1.8} />
                    </div>
                    <h2 className="mt-3 text-2xl font-extrabold tracking-tight">Pickup</h2>
                    <p className="mt-1 text-xs text-green-100 font-medium">
                        Retrieve your items
                    </p>
                </motion.button>
            </section>
        </KioskShell>
    );
}