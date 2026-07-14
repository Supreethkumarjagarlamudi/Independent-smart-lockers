import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Lock, Package } from "lucide-react";
import { KioskShell } from "../../components/layout/KioskShell";

export default function HomePage() {
    const navigate = useNavigate();

    return (
        <KioskShell>
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
                style={{ margin: "36px auto 12px auto", width: "100%", maxWidth: "280px" }}
            >
                {/* Deposit button */}
                <motion.button
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate("/deposit")}
                    className="group w-full h-[180px] rounded-3xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-md hover:shadow-xl hover:shadow-blue-500/10 flex flex-col items-center justify-center text-white cursor-pointer"
                >
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 group-hover:scale-105 transition-transform">
                        <Lock size={32} strokeWidth={1.8} />
                    </div>
                    <h2 className="mt-4 text-2xl font-extrabold tracking-tight">Drop</h2>
                    <p className="mt-1 text-sm text-blue-100 font-medium">
                        Store your items safely
                    </p>
                </motion.button>

                {/* Retrieve button */}
                <motion.button
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate("/retrieve")}
                    className="group w-full h-[180px] rounded-3xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-md hover:shadow-xl hover:shadow-green-500/10 flex flex-col items-center justify-center text-white cursor-pointer"
                >
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 group-hover:scale-105 transition-transform">
                        <Package size={32} strokeWidth={1.8} />
                    </div>
                    <h2 className="mt-4 text-2xl font-extrabold tracking-tight">Pickup</h2>
                    <p className="mt-1 text-sm text-green-100 font-medium">
                        Retrieve your items
                    </p>
                </motion.button>
            </section>
        </KioskShell>
    );
}