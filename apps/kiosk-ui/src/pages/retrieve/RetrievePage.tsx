import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
    ArrowLeft, 
    RefreshCw, 
    CheckCircle2,
    QrCode
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { KioskShell } from "../../components/layout/KioskShell";
import { SessionTimeout } from "../../components/common/SessionTimeout";
import { verifyFace } from "../../api/face";
import { unlockLocker, releaseLocker } from "../../api/lockers";
import { createPayment, verifyPayment, simulateConfirmPayment, cancelPayment } from "../../api/payment";

type RetrieveStep = "FACE_RECOG" | "SELECT_LOCKER" | "PAYMENT" | "OPENING" | "RETRIEVE" | "SUCCESS";

export default function RetrievePage() {
    const navigate = useNavigate();
    const [step, setStep] = useState<RetrieveStep>("FACE_RECOG");
    const [isLoading, setIsLoading] = useState(false);
    const [isQrLoading, setIsQrLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    // Verification outcomes
    const [matchedLockerId, setMatchedLockerId] = useState("");
    const [transactionId, setTransactionId] = useState("");

    // Overdue payment states
    const [overdueFee, setOverdueFee] = useState(0);
    const [overduePaymentData, setOverduePaymentData] = useState<any | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);

    // Multiple locker matches list
    const [matchedLockersList, setMatchedLockersList] = useState<any[]>([]);

    // Camera and scan states
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanStatus, setScanStatus] = useState("Initializing camera...");

    // Opening animation progress
    const [openProgress, setOpenProgress] = useState(0);

    const isLoadingRef = useRef(isLoading);
    useEffect(() => {
        isLoadingRef.current = isLoading;
    }, [isLoading]);

    const transactionIdRef = useRef(transactionId);
    useEffect(() => {
        transactionIdRef.current = transactionId;
    }, [transactionId]);

    const stepRef = useRef(step);
    useEffect(() => {
        stepRef.current = step;
    }, [step]);

    const isMountedRef = useRef(true);
    const cameraStreamRef = useRef<MediaStream | null>(null);

    const startCamera = async () => {
        setCameraError(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 }, 
                    frameRate: { ideal: 30 } 
                } 
            });
            
            // If component unmounted while getUserMedia was resolving, stop the tracks immediately
            if (!isMountedRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }

            const track = stream.getVideoTracks()[0];
            if (track) {
                console.log("Retrieve Camera - Track Settings:", track.getSettings());
                if (typeof track.getCapabilities === "function") {
                    console.log("Retrieve Camera - Track Capabilities:", track.getCapabilities());
                }
                console.log("Retrieve Camera - Track Constraints:", track.getConstraints());
            }

            setCameraStream(stream);
            cameraStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(err => console.error(err));
            }
        } catch (err) {
            if (isMountedRef.current) {
                console.error("Camera access error:", err);
                setCameraError(true);
            }
        }
    };

    const stopCamera = () => {
        const streamToStop = cameraStreamRef.current || cameraStream;
        if (streamToStop) {
            streamToStop.getTracks().forEach((track) => {
                track.stop();
            });
            setCameraStream(null);
            cameraStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    // Clean up payment and camera when unmounting
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            const currentTxId = transactionIdRef.current;
            const currentStep = stepRef.current;
            if (currentTxId && currentStep === "PAYMENT") {
                cancelPayment(currentTxId).catch((err) => console.error("Auto-cancel retrieve payment on unmount failed:", err));
            }
            stopCamera();
        };
    }, []);

    useEffect(() => {
        if (step === "FACE_RECOG") {
            startCamera();
        } else {
            stopCamera();
        }
    }, [step]);

    // Polling check for retrieval overdue payments
    useEffect(() => {
        if (step !== "PAYMENT" || !overduePaymentData) return;
        
        let active = true;
        const interval = setInterval(async () => {
            try {
                const res = await verifyPayment(overduePaymentData.transaction_id);
                if (active && res.payment_status === "PAID") {
                    setStep("OPENING");
                }
            } catch (e) {
                console.error("Polling overdue payment status error:", e);
            }
        }, 3000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [step, overduePaymentData]);
    const handleSessionTimeout = async () => {
        const currentTxId = transactionIdRef.current;
        const currentStep = stepRef.current;
        if (currentTxId && currentStep === "PAYMENT") {
            try {
                await cancelPayment(currentTxId);
            } catch (err) {
                console.error("Timeout cancel failed:", err);
            }
        }
        navigate("/home");
    };

    const handleSimulateSuccess = async () => {
        if (!overduePaymentData) return;
        setIsSimulating(true);
        setErrorMessage("");
        try {
            await simulateConfirmPayment(overduePaymentData.transaction_id);
            setStep("OPENING");
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to simulate payment confirmation.");
        } finally {
            setIsSimulating(false);
        }
    };

    const captureAndVerify = async () => {
        if (!videoRef.current) return;
        setIsLoading(true);
        setErrorMessage("");
        
        try {
            const canvas = document.createElement("canvas");
            canvas.width = 480;
            canvas.height = 480;
            const ctx = canvas.getContext("2d");
            
            if (ctx && videoRef.current) {
                ctx.translate(480, 0);
                ctx.scale(-1, 1);
                
                const videoWidth = videoRef.current.videoWidth || 640;
                const videoHeight = videoRef.current.videoHeight || 480;
                const sSize = Math.min(videoWidth, videoHeight);
                const sx = (videoWidth - sSize) / 2;
                const sy = (videoHeight - sSize) / 2;
                
                ctx.drawImage(videoRef.current, sx, sy, sSize, sSize, 0, 0, 480, 480);
                
                const base64Image = canvas.toDataURL("image/jpeg", 0.95);
                const res = await verifyFace(base64Image);
                
                if (res.match) {
                    if (res.multiple_matches) {
                        setMatchedLockersList(res.matches || []);
                        setStep("SELECT_LOCKER");
                    } else {
                        setMatchedLockerId(res.locker_id);
                        setTransactionId(res.transaction_id);
                        setOverdueFee(res.overdue_fee || 0);
                        
                        if (res.overdue_fee && res.overdue_fee > 0) {
                            // Create retrieval overdue payment QR code
                            const calculatedAmount = res.overdue_fee;
                            const payData = await createPayment(calculatedAmount, "RETRIEVE", res.locker_id, res.transaction_id);
                            setOverduePaymentData(payData);
                            setStep("PAYMENT");
                        } else {
                            setStep("OPENING");
                        }
                    }
                }
            }
        } catch (err: any) {
            setErrorMessage(err.message || "No matching locker registration found. Please check alignment.");
            // Reset liveness scan progress so they can try again
            setScanProgress(0);
            setScanStatus("Liveness verification failed. Retrying...");
            setTimeout(() => {
                setScanProgress(0);
            }, 2000);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle selecting one locker from multiple matched options
    const handleLockerSelection = async (m: any) => {
        setIsLoading(true);
        setErrorMessage("");
        try {
            setMatchedLockerId(m.locker_id);
            setTransactionId(m.transaction_id);
            setOverdueFee(m.overdue_fee || 0);
            
            if (m.overdue_fee && m.overdue_fee > 0) {
                // Initialize overdue payment QR Code
                const calculatedAmount = m.overdue_fee;
                const payData = await createPayment(calculatedAmount, "RETRIEVE", m.locker_id, m.transaction_id);
                setOverduePaymentData(payData);
                setStep("PAYMENT");
            } else {
                setStep("OPENING");
            }
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to initiate payment. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };


    // Pure Client-Side Liveness & Movement Frame Differencing Loop
    useEffect(() => {
        if (step !== "FACE_RECOG" || !cameraStream || !videoRef.current) return;
        
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 40;
        const ctx = canvas.getContext("2d");
        
        let lastFrameData: Uint8ClampedArray | null = null;
        let active = true;
        let motionAccumulator = 0;
        let steadyCount = 0;
        let phase: "NEED_MOTION" | "NEED_STEADY" = "NEED_MOTION";
        
        setScanProgress(0);
        setScanStatus("Aligning face...");

        const checkFrame = () => {
            if (!active) return;
            if (isLoadingRef.current) {
                requestAnimationFrame(checkFrame);
                return;
            }
            
            if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
                ctx.drawImage(video, 0, 0, 40, 40);
                const frame = ctx.getImageData(0, 0, 40, 40);
                const data = frame.data;
                
                if (lastFrameData) {
                    let diff = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        const rDiff = Math.abs(data[i] - lastFrameData[i]);
                        const gDiff = Math.abs(data[i+1] - lastFrameData[i+1]);
                        const bDiff = Math.abs(data[i+2] - lastFrameData[i+2]);
                        if (rDiff + gDiff + bDiff > 35) {
                            diff++;
                        }
                    }
                    
                    const diffRatio = diff / (40 * 40);
                    
                    if (phase === "NEED_MOTION") {
                        setScanStatus("Please move your head slightly (Liveness Check)...");
                        if (diffRatio > 0.03) {
                            motionAccumulator += 3;
                            const prog = Math.min(50, motionAccumulator);
                            setScanProgress(prog);
                            if (motionAccumulator >= 50) {
                                phase = "NEED_STEADY";
                            }
                        }
                    } else if (phase === "NEED_STEADY") {
                        setScanStatus("Now hold still to verify...");
                        if (diffRatio < 0.015) {
                            steadyCount += 2;
                            const prog = 50 + Math.min(50, steadyCount);
                            setScanProgress(prog);
                            if (steadyCount >= 50) {
                                active = false;
                                captureAndVerify();
                            }
                        } else {
                            steadyCount = Math.max(0, steadyCount - 3);
                            setScanProgress(50 + steadyCount);
                        }
                    }
                }
                lastFrameData = data;
            }
            
            if (active) {
                requestAnimationFrame(checkFrame);
            }
        };
        
        const startTimeout = setTimeout(() => {
            checkFrame();
        }, 1500);
        
        return () => {
            active = false;
            clearTimeout(startTimeout);
        };
    }, [step, cameraStream]);

    // Unlocking progress simulation
    useEffect(() => {
        if (step === "OPENING") {
            const triggerUnlock = async () => {
                try {
                    await unlockLocker(matchedLockerId);
                } catch (e) {
                    console.error("Hardware unlock request failed", e);
                }
            };
            triggerUnlock();

            let progress = 0;
            const interval = setInterval(() => {
                progress += 5;
                setOpenProgress(progress);
                if (progress >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        setStep("RETRIEVE");
                    }, 400);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [step, matchedLockerId]);

    const handleRelease = async () => {
        setIsLoading(true);
        try {
            await releaseLocker(matchedLockerId, transactionId);
            setStep("SUCCESS");
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to release locker registration.");
        } finally {
            setIsLoading(false);
        }
    };

    // Beautiful SVG Cabinet Drawer Illustration (Matches 7 & 8 reference layout)
    const renderCabinetSVG = (isOpen: boolean, hasBag: boolean = false) => {
        return (
            <svg viewBox="0 0 160 160" className="w-36 h-36 select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Outer frame */}
                <rect x="25" y="15" width="110" height="130" rx="12" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="4" />
                
                {/* Inside compartment dark shadow */}
                <rect x="31" y="21" width="98" height="118" rx="8" fill="#F1F5F9" />
                
                {isOpen ? (
                    <>
                        {/* Shelf divider */}
                        <line x1="31" y1="80" x2="129" y2="80" stroke="#CBD5E1" strokeWidth="2.5" />
                        
                        {/* Door left */}
                        <path d="M25 15 L-12 25 L-12 135 L25 145 Z" fill="#94A3B8" stroke="#64748B" strokeWidth="2" opacity="0.95" />
                        
                        {/* Door right */}
                        <path d="M135 15 L172 25 L172 135 L135 145 Z" fill="#94A3B8" stroke="#64748B" strokeWidth="2" opacity="0.95" />
                        
                        {hasBag && (
                            // Blue Backpack Vector illustration inside locker
                            <g transform="translate(50, 42) scale(1)">
                                <rect x="8" y="16" width="44" height="42" rx="10" fill="#3b82f6" stroke="#2563eb" strokeWidth="2" />
                                <rect x="15" y="8" width="30" height="12" rx="4" fill="#60a5fa" stroke="#3b82f6" strokeWidth="1.5" />
                                <rect x="12" y="32" width="36" height="24" rx="6" fill="#1d4ed8" stroke="#1e40af" strokeWidth="1.5" />
                                <path d="M24 8 C24 4, 36 4, 36 8" stroke="#1e3a8a" strokeWidth="2" fill="none" />
                            </g>
                        )}
                    </>
                ) : (
                    <>
                        {/* Closed door */}
                        <rect x="25" y="15" width="110" height="130" rx="12" fill="#64748B" stroke="#475569" strokeWidth="4" />
                        {/* Door handle & vent slots */}
                        <line x1="40" y1="28" x2="64" y2="28" stroke="#475569" strokeWidth="3" />
                        <line x1="40" y1="38" x2="64" y2="38" stroke="#475569" strokeWidth="3" />
                        <rect x="108" y="65" width="12" height="30" rx="3" fill="#94A3B8" />
                    </>
                )}
            </svg>
        );
    };

    // ----------------------------------------
    // STEPS RENDERING
    // ----------------------------------------

    const renderFaceRecognition = () => {
        const radius = 102;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference * (1 - scanProgress / 100);

        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", width: "100%", userSelect: "none" }}>
                <div style={{ textAlign: "center" }}>
                    <h2 className="text-3xl font-black text-slate-900 leading-none">Face Recognition</h2>
                    <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "8px" }}>Auto-detection active</p>
                </div>

                {/* Circular camera view window with dynamic progress stroke ring */}
                <div className="relative h-56 w-56 rounded-full border-[6px] border-slate-100 overflow-hidden shadow-2xl bg-black flex items-center justify-center">
                    {cameraError ? (
                        <div className="text-white text-xs text-center px-4 font-medium">
                            Unable to access camera feed. Check connection.
                        </div>
                    ) : (
                        <video 
                            ref={videoRef}
                            className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                            muted 
                            playsInline
                        />
                    )}
                    
                    {!cameraError && (
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 224 224">
                            <circle 
                                cx="112" 
                                cy="112" 
                                r={radius} 
                                stroke="#10b981" 
                                strokeWidth="8" 
                                fill="transparent" 
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                style={{ transition: "stroke-dashoffset 150ms ease" }}
                            />
                        </svg>
                    )}

                    <div className="absolute inset-4 rounded-full border border-dashed border-white/20 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent w-full h-1/4 animate-scanner-line pointer-events-none" />
                    
                    {/* Centered percentage readout */}
                    <div style={{ position: "absolute", bottom: "16px", backgroundColor: "rgba(15,23,42,0.85)", color: "#ffffff", padding: "4px 10px", borderRadius: "9999px", fontSize: "11px", fontWeight: "bold", backdropFilter: "blur(4px)" }}>
                        {scanProgress}%
                    </div>
                </div>

                {/* Scanning status banner */}
                <div style={{ textAlign: "center", width: "100%", maxWidth: "340px" }}>
                    <p style={{ fontSize: "13px", fontWeight: "bold", color: "#10b981" }} className="animate-pulse">
                        {scanStatus}
                    </p>
                </div>

                {/* Information Warning Box */}
                <div 
                    style={{ 
                        width: "100%", 
                        maxWidth: "340px", 
                        backgroundColor: "#eff6ff", 
                        border: "1px solid #dbeafe", 
                        borderRadius: "16px", 
                        display: "flex", 
                        gap: "12px", 
                        padding: "12px 16px" 
                    }}
                >
                    <span className="text-blue-500 font-extrabold text-base select-none shrink-0">ⓘ</span>
                    <p className="text-xs text-blue-700 font-bold leading-normal text-left">
                        Please look directly at the camera. Verification will proceed automatically.
                    </p>
                </div>

                {errorMessage && (
                    <p className="text-xs text-rose-500 font-semibold bg-rose-50 px-4 py-2.5 rounded-xl border border-rose-100 max-w-[340px] text-center break-words mx-auto w-full">
                        {errorMessage}
                    </p>
                )}

                <div style={{ width: "100%", maxWidth: "340px" }}>
                    <button
                        onClick={() => navigate("/home")}
                        className="w-full h-12 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    };

    const renderSelectLocker = () => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", width: "100%", userSelect: "none", textAlign: "center" }}>
            {/* Heading */}
            <div style={{ marginBottom: "2px" }}>
                <h2 className="text-3xl font-black text-slate-900 leading-none">Select Locker</h2>
                <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "6px" }}>Multiple lockers matched your face. Please select one:</p>
            </div>

            {/* Locker cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                {matchedLockersList.map((m) => (
                    <button
                        key={m.transaction_id}
                        onClick={() => handleLockerSelection(m)}
                        style={{
                            width: "100%",
                            padding: "16px 20px",
                            background: "#fff",
                            border: "2px solid #e2e8f0",
                            borderRadius: "18px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            textAlign: "left",
                            cursor: "pointer",
                            transition: "border-color 0.15s, box-shadow 0.15s",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#3b82f6"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(59,130,246,0.12)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "18px", fontWeight: 900, color: "#1e293b", letterSpacing: "-0.02em" }}>Locker {m.locker_id}</span>
                            {m.overdue_fee > 0 ? (
                                <span style={{ padding: "4px 12px", background: "#fef2f2", color: "#ef4444", borderRadius: "9999px", fontWeight: 800, fontSize: "11px" }}>
                                    Overdue: ₹{m.overdue_fee}
                                </span>
                            ) : (
                                <span style={{ padding: "4px 12px", background: "#f0fdf4", color: "#16a34a", borderRadius: "9999px", fontWeight: 800, fontSize: "11px" }}>
                                    No Overdue
                                </span>
                            )}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
                            <span>Deposited: {m.created_at}</span>
                            <span>Paid: ₹{m.amount}</span>
                        </div>
                    </button>
                ))}
            </div>

            {errorMessage && (
                <p className="text-xs text-rose-500 font-semibold bg-rose-50 px-4 py-2.5 rounded-xl border border-rose-100 max-w-[340px] text-center break-words mx-auto w-full">
                    {errorMessage}
                </p>
            )}

            <button
                onClick={() => setStep("FACE_RECOG")}
                style={{ width: "100%", height: "46px", border: "1.5px solid #e2e8f0", borderRadius: "14px", fontWeight: 700, fontSize: "14px", color: "#64748b", background: "#f8fafc", cursor: "pointer", marginTop: "2px" }}
            >
                Back to Camera
            </button>
        </div>
    );


    const renderPayment = () => {
        if (isLoading) {
            return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "16px", userSelect: "none" }}>
                    <RefreshCw size={40} className="animate-spin text-blue-600" />
                    <p className="text-slate-500 text-sm font-semibold">Creating payment session...</p>
                </div>
            );
        }

        const getQrImageUrl = (link: string) => {
            if (!link) return "";
            if (link.startsWith("data:") || link.startsWith("blob:") || link.startsWith("http")) {
                return link;
            }
            return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(link)}`;
        };

        const qrDataUrl = overduePaymentData ? getQrImageUrl(overduePaymentData.upi_link) : "";
        const isPosterImage = Boolean(qrDataUrl && (qrDataUrl.startsWith("data:") || qrDataUrl.startsWith("http")));

        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", width: "100%", userSelect: "none" }}>
                <div style={{ textAlign: "center" }}>
                    <h2 className="text-3xl font-black text-slate-900 leading-none">Overdue Payment</h2>
                    <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "8px" }}>Locker rental time exceeded</p>
                </div>

                <div 
                    style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        alignItems: "center", 
                        backgroundColor: "#ffffff", 
                        border: "1px solid #e2e8f0", 
                        borderRadius: "28px", 
                        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", 
                        width: "100%", 
                        maxWidth: "340px", 
                        padding: "24px" 
                    }}
                >
                    <span style={{ color: "#ef4444", fontWeight: "bold", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Overdue Amount</span>
                    <span className="text-5xl font-black text-rose-600 mt-1 leading-none">₹{overdueFee}</span>
                    <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "bold", marginTop: "12px", textTransform: "uppercase" }}>UPI / QR Code</span>
                    
                    {/* QR Frame */}
                    <div 
                        style={{ 
                            margin: "16px 0", 
                            padding: "0px", 
                            borderRadius: "20px", 
                            backgroundColor: "#ffffff", 
                            border: "1px solid #e2e8f0", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            width: "220px", 
                            height: "220px",
                            overflow: "hidden",
                            position: "relative"
                        }}
                    >
                        {/* Skeleton Shimmer Loading Bar */}
                        {isQrLoading && (
                            <div className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center gap-2.5 p-4 z-10">
                                <div className="w-10 h-10 rounded-xl bg-rose-100/80 flex items-center justify-center animate-bounce">
                                    <QrCode size={20} className="text-rose-600" />
                                </div>
                                <div className="w-24 h-2.5 rounded-full bg-slate-200 animate-pulse" />
                                <div className="w-16 h-2 rounded-full bg-slate-200 animate-pulse" />
                            </div>
                        )}

                        {qrDataUrl ? (
                            <img 
                                src={qrDataUrl} 
                                alt="UPI QR Code" 
                                onLoad={() => setIsQrLoading(false)}
                                style={{ 
                                    width: "100%", 
                                    height: "100%", 
                                    objectFit: "cover",
                                    objectPosition: "center 42%",
                                    transform: isPosterImage ? "scale(2.05)" : "none",
                                    opacity: isQrLoading ? 0 : 1,
                                    transition: "opacity 0.3s ease"
                                }} 
                            />
                        ) : (
                            <RefreshCw size={24} className="animate-spin text-slate-300" />
                        )}
                    </div>
                    
                    <span style={{ fontSize: "11px", fontWeight: "bold", color: "#64748b", textAlign: "center", lineHeight: "1.4" }}>
                        Scan to pay the remaining balance to unlock
                    </span>
                </div>

                {errorMessage && (
                    <p className="text-xs text-rose-500 font-semibold bg-rose-50 px-4 py-2.5 rounded-xl border border-rose-100 max-w-[340px] text-center break-words mx-auto w-full">
                        {errorMessage}
                    </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "340px" }}>
                    {overduePaymentData?.is_test_mode && (
                        <button
                            onClick={handleSimulateSuccess}
                            disabled={isSimulating}
                            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                            {isSimulating ? "Simulating..." : "Simulate Payment Success (Test)"}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (matchedLockersList.length > 1) {
                                setStep("SELECT_LOCKER");
                            } else {
                                setStep("FACE_RECOG");
                            }
                        }}
                        className="w-full h-12 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>
            </div>
        );
    };

    const renderOpening = () => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", width: "100%", userSelect: "none", textAlign: "center" }}>
            <div>
                <h2 className="text-3xl font-black text-slate-900 leading-none">Opening Locker</h2>
                <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "8px" }}>Please wait while we open your locker</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", width: "100%", maxWidth: "340px" }}>
                {renderCabinetSVG(true, false)}
                
                <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#475569" }}>Opening locker {matchedLockerId}...</h3>
                
                {/* Progress bar */}
                <div style={{ width: "100%", height: "10px", borderRadius: "9999px", backgroundColor: "#f1f5f9", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)" }}>
                    <div 
                        style={{ 
                            height: "100%", 
                            backgroundColor: "#2563eb", 
                            borderRadius: "9999px", 
                            width: `${openProgress}%`, 
                            transition: "width 200ms ease" 
                        }}
                    />
                </div>
            </div>
        </div>
    );

    const renderRetrieve = () => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", width: "100%", userSelect: "none", textAlign: "center" }}>
            <div>
                <h2 className="text-3xl font-black text-slate-900 leading-none">Retrieve Your Items</h2>
                <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "8px" }}>Please take your items from the locker</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", width: "100%", maxWidth: "340px" }}>
                {renderCabinetSVG(true, true)}
                
                {/* Info banner */}
                <div 
                    style={{ 
                        width: "100%", 
                        backgroundColor: "#eff6ff", 
                        border: "1px solid #dbeafe", 
                        borderRadius: "16px", 
                        display: "flex", 
                        gap: "12px", 
                        padding: "12px 16px" 
                    }}
                >
                    <span className="text-blue-500 font-extrabold text-base select-none shrink-0">ⓘ</span>
                    <p className="text-xs text-blue-700 font-bold leading-normal text-left">
                        After taking your items, please close the locker door.
                    </p>
                </div>
            </div>

            {errorMessage && (
                <p className="text-xs text-rose-500 font-semibold bg-rose-50 px-4 py-2.5 rounded-xl border border-rose-100 max-w-[340px] text-center break-words mx-auto w-full">
                    {errorMessage}
                </p>
            )}

            <div style={{ width: "100%", maxWidth: "340px" }}>
                <button
                    onClick={handleRelease}
                    disabled={isLoading}
                    className="w-full h-13 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                    {isLoading ? (
                        <>
                            <RefreshCw size={18} className="animate-spin" /> Closing Session...
                        </>
                    ) : (
                        "Items Taken & Close Locker"
                    )}
                </button>
            </div>
        </div>
    );

    const renderSuccess = () => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", width: "100%", userSelect: "none", textAlign: "center" }}>
            <motion.div 
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-500 border border-green-100 shadow-sm"
            >
                <CheckCircle2 size={40} className="text-green-500" />
            </motion.div>

            <div>
                <h2 className="text-3xl font-black text-slate-900 leading-none">Retrieve Successful!</h2>
                <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "8px" }}>Thank you for using our service</p>
            </div>

            <div 
                style={{ 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "16px", 
                    backgroundColor: "#f8fafc", 
                    width: "100%", 
                    maxWidth: "340px", 
                    overflow: "hidden", 
                    padding: "4px" 
                }}
            >
                <div 
                    style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        padding: "14px 16px", 
                        borderBottom: "1px solid #e2e8f0" 
                    }}
                >
                    <span style={{ fontWeight: "bold", color: "#64748b", fontSize: "12px" }}>Locker Number</span>
                    <span style={{ padding: "4px 12px", backgroundColor: "#dcfce7", color: "#15803d", borderRadius: "9999px", fontWeight: "800", fontSize: "12px" }}>{matchedLockerId}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
                    <span style={{ fontWeight: "bold", color: "#64748b", fontSize: "12px" }}>Transaction ID</span>
                    <span style={{ fontFamily: "monospace", color: "#334155", fontWeight: "800", fontSize: "12px" }}>{transactionId}</span>
                </div>
            </div>

            <div style={{ width: "100%", maxWidth: "340px" }}>
                <button
                    onClick={() => navigate("/home")}
                    className="w-full h-13 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                    Done
                </button>
            </div>
        </div>
    );

    return (
        <KioskShell>
            <SessionTimeout timeoutMs={45000} onTimeout={handleSessionTimeout} />
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
                >
                    {step === "FACE_RECOG" && renderFaceRecognition()}
                    {step === "SELECT_LOCKER" && renderSelectLocker()}
                    {step === "PAYMENT" && renderPayment()}
                    {step === "OPENING" && renderOpening()}
                    {step === "RETRIEVE" && renderRetrieve()}
                    {step === "SUCCESS" && renderSuccess()}
                </motion.div>
            </AnimatePresence>
        </KioskShell>
    );
}