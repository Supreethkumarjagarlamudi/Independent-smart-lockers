import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { getClusterStatus } from "../../api/cluster";

export default function SplashPage() {
    const navigate = useNavigate();
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((p) => Math.min(p + 2, 100));
        }, 20);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (progress === 100) {
            const checkStatus = async () => {
                try {
                    const status = await getClusterStatus();
                    if (status.initialized) {
                        navigate("/home");
                    } else {
                        navigate("/setup");
                    }
                } catch (e) {
                    console.error("Failed to query cluster status", e);
                    // Fallback to setup if API fails
                    navigate("/setup");
                }
            };
            checkStatus();
        }
    }, [progress, navigate]);

    return (
        <AppLayout>
            <div className="relative flex h-screen w-full">

                {/* Entire content */}
                <div
                    className="
                        absolute
                        left-1/2
                        top-[42%]
                        -translate-x-1/2
                        -translate-y-1/2

                        flex
                        w-full
                        max-w-xl
                        flex-col
                        items-center

                        px-8
                    "
                >
                    {/* Logo */}
                    <img
                        src="/images/branding/simats-logo.png"
                        alt="SIMATS"
                        className="h-24 w-24 sm:h-28 sm:w-28 md:h-36 md:w-36 object-contain"
                    />

                    {/* Huge gap */}
                    <div className="h-8 md:h-12" />

                    {/* Title */}
                    <h1
                        className="
                            text-5xl
                            md:text-6xl
                            lg:text-7xl
                            font-bold
                            tracking-tight
                        "
                    >
                        SMART LOCKER
                    </h1>

                    {/* Gap */}
                    <div className="h-5 md:h-8" />

                    {/* Loading text */}
                    <p
                        className="
                            text-xl
                            text-slate-500
                        "
                    >
                        Initializing System...
                    </p>

                    {/* Bigger gap */}
                    <div className="h-8 md:h-10" />

                    {/* Progress */}
                    <div className="w-64 sm:w-72 md:w-[420px]">
                        <div className="h-1.5 rounded-full bg-slate-200">
                            <div
                                className="h-full rounded-full bg-blue-600 transition-all"
                                style={{
                                    width: `${progress}%`,
                                }}
                            />
                        </div>
                    </div>

                    {/* Gap */}
                    <div className="h-6 md:h-8" />

                    <p className="text-sm text-slate-400">
                        Version 1.0.0
                    </p>
                </div>
            </div>
        </AppLayout>
    );
}