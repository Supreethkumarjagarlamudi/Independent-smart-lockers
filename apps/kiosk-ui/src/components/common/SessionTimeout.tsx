import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type SessionTimeoutProps = {
    timeoutMs?: number;      // inactivity timeout in ms (default: 60s)
    countdownSeconds?: number; // countdown popup seconds (default: 10s)
    onTimeout?: () => void;  // callback when timed out
};

export function SessionTimeout({
    timeoutMs = 45000, // 45 seconds of inactivity before trigger
    countdownSeconds = 10,
    onTimeout,
}: SessionTimeoutProps) {
    const navigate = useNavigate();
    const [isPromptVisible, setIsPromptVisible] = useState(false);
    const [timeLeft, setTimeLeft] = useState(countdownSeconds);
    
    const activityTimerRef = useRef<any | null>(null);
    const countdownTimerRef = useRef<any | null>(null);
    
    // Track activity
    const resetTimer = () => {
        if (isPromptVisible) return; // Don't reset if countdown is active
        
        if (activityTimerRef.current) {
            clearTimeout(activityTimerRef.current);
        }
        
        activityTimerRef.current = setTimeout(() => {
            setIsPromptVisible(true);
            setTimeLeft(countdownSeconds);
        }, timeoutMs);
    };

    // Setup event listeners for user activity
    useEffect(() => {
        const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
        
        events.forEach((event) => {
            window.addEventListener(event, resetTimer);
        });
        
        resetTimer(); // initial setup

        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, resetTimer);
            });
            if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
    }, [isPromptVisible, timeoutMs]);

    // Handle countdown timer ticking
    useEffect(() => {
        if (isPromptVisible) {
            countdownTimerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        // Timeout reached!
                        handleTimeout();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
        }

        return () => {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
    }, [isPromptVisible]);

    const handleTimeout = () => {
        setIsPromptVisible(false);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
        
        if (onTimeout) {
            onTimeout();
        } else {
            navigate("/"); // redirect to splash
        }
    };

    const handleContinue = () => {
        setIsPromptVisible(false);
        resetTimer();
    };

    return (
        <AnimatePresence>
            {isPromptVisible && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.4 }}
                        style={{
                            width: "85%",
                            maxWidth: "310px",
                            borderRadius: "24px",
                            border: "1px solid #f1f5f9",
                            backgroundColor: "#ffffff",
                            padding: "24px 20px",
                            textAlign: "center",
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            boxSizing: "border-box"
                        }}
                    >
                        <div style={{
                            display: "flex",
                            height: "48px",
                            width: "48px",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "9999px",
                            backgroundColor: "#fffbeb",
                            color: "#d97706",
                            marginBottom: "12px"
                        }}>
                            <Clock size={24} className="animate-pulse" />
                        </div>

                        <h2 style={{
                            fontSize: "20px",
                            fontWeight: 900,
                            color: "#0f172a",
                            letterSpacing: "-0.02em",
                            margin: "0 0 6px 0",
                            lineHeight: 1.2
                        }}>
                            Session Timeout
                        </h2>

                        <p style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#64748b",
                            margin: "0 0 16px 0",
                            lineHeight: 1.4
                        }}>
                            You have been inactive for a while.
                        </p>

                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: "18px"
                        }}>
                            <div style={{
                                position: "relative",
                                height: "76px",
                                width: "76px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}>
                                <svg className="-rotate-90 w-full h-full" viewBox="0 0 76 76">
                                    <circle
                                        cx="38"
                                        cy="38"
                                        r="34"
                                        stroke="#f1f5f9"
                                        strokeWidth="4"
                                        fill="transparent"
                                    />
                                    <motion.circle
                                        cx="38"
                                        cy="38"
                                        r="34"
                                        stroke="#d97706"
                                        strokeWidth="4"
                                        fill="transparent"
                                        strokeDasharray={2 * Math.PI * 34}
                                        animate={{ strokeDashoffset: (2 * Math.PI * 34) - (timeLeft / countdownSeconds) * (2 * Math.PI * 34) }}
                                        transition={{ duration: 1, ease: "linear" }}
                                    />
                                </svg>
                                <div style={{
                                    position: "absolute",
                                    fontSize: "24px",
                                    fontWeight: 900,
                                    color: "#d97706",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}>
                                    {timeLeft}
                                </div>
                            </div>
                            <p style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "#94a3b8",
                                margin: "8px 0 0 0"
                            }}>
                                Redirecting to home screen...
                            </p>
                        </div>

                        <button
                            onClick={handleContinue}
                            style={{
                                width: "100%",
                                height: "44px",
                                borderRadius: "12px",
                                backgroundColor: "#2563eb",
                                color: "#ffffff",
                                fontWeight: 700,
                                fontSize: "14px",
                                border: "none",
                                boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
                                cursor: "pointer"
                            }}
                        >
                            Continue Session
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
