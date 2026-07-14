import { useEffect, useState } from "react";

export function SplashProgress() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((old) => {
                if (old >= 100) return 100;
                return old + 2;
            });
        }, 35);

        return () => clearInterval(timer);
    }, []);

    return (
        <div
            className="
                mt-10
                flex
                flex-col
                items-center
            "
        >
            <div
                className="
                    w-64
                    sm:w-72
                    md:w-[420px]
                    h-1.5
                    overflow-hidden
                    rounded-full
                    bg-slate-200
                "
            >
                <div
                    className="
                        h-full
                        rounded-full
                        bg-blue-600
                        transition-all
                        duration-150
                    "
                    style={{
                        width: `${progress}%`,
                    }}
                />
            </div>

            <p
                className="
                    mt-6
                    text-sm
                    tracking-wide
                    text-slate-400
                "
            >
                Version 1.0.0
            </p>
        </div>
    );
}