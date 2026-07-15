import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
    ArrowLeft, 
    RefreshCw, 
    CheckCircle2
} from "lucide-react";

import { KioskShell } from "../../components/layout/KioskShell";
import { SessionTimeout } from "../../components/common/SessionTimeout";
import { 
    createPayment, 
    verifyPayment, 
    simulateConfirmPayment,
    cancelPayment
} from "../../api/payment";
import type { PaymentCreateResponse } from "../../api/payment";
import { registerFace } from "../../api/face";
import { unlockLocker } from "../../api/lockers";

type DepositStep = "DURATION" | "PAYMENT" | "FACE_REG" | "ASSIGNED" | "SUCCESS";

export default function DepositPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState<DepositStep>("DURATION");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // Pricing details
    const [rentHours, setRentHours] = useState(1);
    const [hourlyRate, setHourlyRate] = useState(10);

    // Payment details
    const [paymentData, setPaymentData] = useState<PaymentCreateResponse | null>(null);

    // Camera and Scan status
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanStatus, setScanStatus] = useState("Initializing camera...");

    // Locker assigned
    const [assignedLockerId, setAssignedLockerId] = useState("");
    const [transactionId, setTransactionId] = useState("");

    // Refs for animation loop to avoid stale closure state
    const paymentDataRef = useRef(paymentData);
    useEffect(() => {
        paymentDataRef.current = paymentData;
    }, [paymentData]);

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

    useEffect(() => {
        return () => {
            const currentTxId = transactionIdRef.current;
            const currentStep = stepRef.current;
            if (currentTxId && (currentStep === "PAYMENT" || currentStep === "FACE_REG")) {
                cancelPayment(currentTxId).catch((err) => console.error("Auto-cancel on unmount failed:", err));
            }
        };
    }, []);


    // Fetch setup configuration for hourly rate on mount
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await fetch("http://localhost:8000/api/setup/status");
                if (response.ok) {
                    const data = await response.json();
                    if (data.initialized && data.config) {
                        setHourlyRate(data.config.hourly_rate !== undefined && data.config.hourly_rate !== null ? data.config.hourly_rate : 10);
                    }
                }
            } catch (err) {
                console.error("Failed to load hourly rate config:", err);
            }
        };
        fetchConfig();
        return () => stopCamera();
    }, []);

    // Automatic Payment Status Polling
    useEffect(() => {
        if (step !== "PAYMENT" || !paymentData) return;
        
        let active = true;
        const pollInterval = setInterval(async () => {
            try {
                const res = await verifyPayment(paymentData.transaction_id);
                if (active && res.payment_status === "PAID") {
                    setStep("FACE_REG");
                }
            } catch (err) {
                console.error("Polling payment error:", err);
            }
        }, 3000);

        return () => {
            active = false;
            clearInterval(pollInterval);
        };
    }, [step, paymentData]);

    const handleSessionTimeout = async () => {
        const currentTxId = transactionIdRef.current;
        const currentStep = stepRef.current;
        if (currentTxId && (currentStep === "PAYMENT" || currentStep === "FACE_REG")) {
            try {
                await cancelPayment(currentTxId);
            } catch (err) {
                console.error("Timeout cancel failed:", err);
            }
        }
        navigate("/home");
    };

    // Handle proceeding to payment from duration step
    const handleProceedToPayment = async () => {
        setIsLoading(true);
        setErrorMessage("");
        try {
            const calculatedAmount = rentHours * hourlyRate;
            const data = await createPayment(calculatedAmount, "DEPOSIT");
            setPaymentData(data);
            setTransactionId(data.transaction_id);
            setAssignedLockerId(data.locker_id);
            
            if (calculatedAmount === 0) {
                // Automatically confirm zero-amount payment and skip to face registration!
                await simulateConfirmPayment(data.transaction_id);
                setStep("FACE_REG");
            } else {
                setStep("PAYMENT");
            }
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to initialize payment transaction. Lockers might be full.");
        } finally {
            setIsLoading(false);
        }
    };

    const cameraStreamRef = useRef<MediaStream | null>(null);

    // Camera Handlers
    const startCamera = async () => {
        setCameraError(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 480, height: 480, aspectRatio: 1 } 
            });
            setCameraStream(stream);
            cameraStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(err => console.error(err));
            }
        } catch (err) {
            console.error("Camera error:", err);
            setCameraError(true);
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

    useEffect(() => {
        if (step === "FACE_REG") {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [step]);


    // Capture & register face, then trigger unlock
    const captureAndRegister = async (customPaymentData?: PaymentCreateResponse | null) => {
        const activePayment = customPaymentData || paymentDataRef.current;
        if (!videoRef.current || !activePayment) return;
        setIsLoading(true);
        setErrorMessage("");
        
        try {
            const canvas = document.createElement("canvas");
            canvas.width = 480;
            canvas.height = 480;
            const ctx = canvas.getContext("2d");
            
            if (ctx) {
                ctx.translate(480, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(videoRef.current, 0, 0, 480, 480);
                
                const base64Image = canvas.toDataURL("image/jpeg", 0.95);
                await registerFace(activePayment.transaction_id, base64Image);
                
                // Unlock physical solenoid door
                await unlockLocker(activePayment.locker_id);
                setStep("ASSIGNED");
            }
        } catch (err: any) {
            setErrorMessage(err.message || "Face extraction failed. Retrying liveness check...");
            // Restart detection if fails
            setScanProgress(0);
            setScanStatus("Liveness verification failed. Retrying...");
            setTimeout(() => {
                setScanProgress(0);
            }, 2000);
        } finally {
            setIsLoading(false);
        }
    };

    // Pure Client-Side Liveness & Movement Frame Differencing Loop
    useEffect(() => {
        if (step !== "FACE_REG" || !cameraStream || !videoRef.current) return;
        
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
                        setScanStatus("Now hold still to complete registration...");
                        if (diffRatio < 0.015) {
                            steadyCount += 2;
                            const prog = 50 + Math.min(50, steadyCount);
                            setScanProgress(prog);
                            if (steadyCount >= 50) {
                                active = false;
                                captureAndRegister();
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

    // ----------------------------------------
    // STEPS RENDERING
    // ----------------------------------------

    const renderDuration = () => {
        const standardHours = [1, 2, 4, 8, 12, 24];
        
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", width: "100%", userSelect: "none", textAlign: "center" }}>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 leading-none">Select Duration</h2>
                    <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "8px" }}>How long do you need the locker?</p>
                </div>

                {/* Duration grid options */}
                <div 
                    className="grid grid-cols-3 gap-3 w-full max-w-[340px]"
                >
                    {standardHours.map((h) => (
                        <button
                            key={h}
                            onClick={() => setRentHours(h)}
                            className={`h-14 rounded-2xl border font-bold text-sm flex flex-col items-center justify-center transition-all cursor-pointer ${
                                rentHours === h
                                ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/10 scale-[1.02]"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            <span>{h} {h === 1 ? "Hour" : "Hours"}</span>
                        </button>
                    ))}
                </div>

                {/* Custom Hours Counter */}
                <div 
                    style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between", 
                        width: "100%", 
                        maxWidth: "340px", 
                        border: "1px solid #e2e8f0", 
                        backgroundColor: "#f8fafc", 
                        borderRadius: "16px", 
                        padding: "16px" 
                    }}
                >
                    <span style={{ fontSize: "12px", fontWeight: "bold", color: "#64748b" }}>Custom Hours</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            type="button"
                            onClick={() => setRentHours(prev => Math.max(1, prev - 1))}
                            className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 active:scale-95 cursor-pointer"
                        >
                            -
                        </button>
                        <span style={{ fontSize: "14px", fontWeight: "900", color: "#0f172a", width: "24px", textAlign: "center" }}>{rentHours}</span>
                        <button
                            type="button"
                            onClick={() => setRentHours(prev => Math.min(72, prev + 1))}
                            className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 active:scale-95 cursor-pointer"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Price Display */}
                <div 
                    style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        alignItems: "center", 
                        backgroundColor: "#f0fdf4", 
                        border: "1px solid #dcfce7", 
                        borderRadius: "24px", 
                        width: "100%", 
                        maxWidth: "340px", 
                        padding: "20px" 
                    }}
                >
                    <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Amount</span>
                    <span className="text-4xl font-black text-slate-900 mt-1 leading-none">₹{rentHours * hourlyRate}</span>
                    <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: "bold", marginTop: "6px" }}>Rate: ₹{hourlyRate}/hour</span>
                </div>

                {errorMessage && (
                    <p className="text-xs text-rose-500 font-semibold bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 max-w-[340px]">
                        {errorMessage}
                    </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "340px" }}>
                    <button
                        onClick={handleProceedToPayment}
                        disabled={isLoading}
                        className="w-full h-13 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                    >
                        {isLoading ? (
                            <RefreshCw size={18} className="animate-spin" />
                        ) : (
                            "Proceed to Payment"
                        )}
                    </button>

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

    const renderPayment = () => {
        if (isLoading) {
            return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "16px", userSelect: "none" }}>
                    <RefreshCw size={40} className="animate-spin text-blue-600" />
                    <p className="text-slate-500 text-sm font-semibold">Creating payment session...</p>
                </div>
            );
        }

        if (errorMessage && !paymentData) {
            return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "16px", textAlign: "center", userSelect: "none" }}>
                    <p className="text-rose-500 font-bold text-base leading-relaxed">{errorMessage}</p>
                    <button 
                        onClick={() => setStep("DURATION")} 
                        className="mt-6 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md cursor-pointer"
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        const qrDataUrl = paymentData 
            ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentData.upi_link)}`
            : "";

        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", width: "100%", userSelect: "none" }}>
                <div style={{ textAlign: "center" }}>
                    <h2 className="text-3xl font-black text-slate-900 leading-none">Payment</h2>
                    <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "8px" }}>Complete your payment</p>
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
                    <span style={{ color: "#94a3b8", fontWeight: "bold", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Amount</span>
                    <span className="text-5xl font-black text-slate-900 mt-1 leading-none">₹{paymentData?.amount || rentHours * hourlyRate}</span>
                    <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "bold", marginTop: "12px", textTransform: "uppercase" }}>UPI / QR Code</span>
                    
                    {/* QR Frame */}
                    <div 
                        style={{ 
                            margin: "20px 0", 
                            padding: "12px", 
                            borderRadius: "16px", 
                            backgroundColor: "#f8fafc", 
                            border: "1px solid #f1f5f9", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            width: "192px", 
                            height: "192px" 
                        }}
                    >
                        {qrDataUrl ? (
                            <img src={qrDataUrl} alt="UPI QR Code" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : (
                            <RefreshCw size={24} className="animate-spin text-slate-300" />
                        )}
                    </div>
                    
                    <span style={{ fontSize: "11px", fontWeight: "bold", color: "#64748b", textAlign: "center", lineHeight: "1.4" }}>
                        Scan with any UPI app to pay
                    </span>
                </div>

                {errorMessage && (
                    <p className="text-xs text-rose-500 font-semibold bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 max-w-[340px] text-center">
                        {errorMessage}
                    </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "340px" }}>
                    <button
                        onClick={() => setStep("DURATION")}
                        className="w-full h-12 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>
            </div>
        );
    };

    const renderFaceRegistration = () => {
        const radius = 102;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference * (1 - scanProgress / 100);

        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", width: "100%", userSelect: "none" }}>
                <div style={{ textAlign: "center" }}>
                    <h2 className="text-3xl font-black text-slate-900 leading-none">Face Registration</h2>
                    <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "8px" }}>Auto-detection active</p>
                </div>

                {/* Circular camera overlay with dynamic progress stroke ring */}
                <div className="relative h-56 w-56 rounded-full border-[6px] border-slate-100 overflow-hidden shadow-2xl bg-black flex items-center justify-center">
                    {cameraError ? (
                        <div className="text-white text-xs text-center px-4 font-medium leading-relaxed">
                            Unable to access camera. Please check connections.
                        </div>
                    ) : (
                        <video 
                            ref={videoRef}
                            className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                            muted 
                            playsInline
                        />
                    )}
                    
                    {/* Radial progress ring SVG */}
                    {!cameraError && (
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 224 224">
                            <circle 
                                cx="112" 
                                cy="112" 
                                r={radius} 
                                stroke="#2563eb" 
                                strokeWidth="8" 
                                fill="transparent" 
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                style={{ transition: "stroke-dashoffset 150ms ease" }}
                            />
                        </svg>
                    )}

                    <div className="absolute inset-4 rounded-full border border-dashed border-white/20 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent w-full h-1/4 animate-scanner-line pointer-events-none" />
                    
                    {/* Centered percentage readout */}
                    <div style={{ position: "absolute", bottom: "16px", backgroundColor: "rgba(15,23,42,0.85)", color: "#ffffff", padding: "4px 10px", borderRadius: "9999px", fontSize: "11px", fontWeight: "bold", backdropFilter: "blur(4px)" }}>
                        {scanProgress}%
                    </div>
                </div>

                {/* Scanning status banner */}
                <div style={{ textAlign: "center", width: "100%", maxWidth: "340px" }}>
                    <p style={{ fontSize: "13px", fontWeight: "bold", color: "#2563eb" }} className="animate-pulse">
                        {scanStatus}
                    </p>
                </div>

                {/* Warning box */}
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
                    <p className="text-xs text-rose-500 font-semibold bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 max-w-[340px] text-center">
                        {errorMessage}
                    </p>
                )}
            </div>
        );
    };

    const renderLockerAssigned = () => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", width: "100%", userSelect: "none" }}>
            <div style={{ textAlign: "center" }}>
                <h2 className="text-3xl font-black text-slate-900 leading-none">Locker Assigned</h2>
                <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "8px" }}>Your locker has been assigned</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-blue-50 border border-blue-100 text-blue-600 shadow-md">
                    <span className="text-4xl font-black leading-none">{assignedLockerId}</span>
                </div>
                
                <p className="max-w-sm text-sm text-slate-500 font-semibold leading-relaxed px-4 text-center">
                    Please proceed to the locker and place your items.
                </p>
            </div>

            <div style={{ width: "100%", maxWidth: "340px", marginTop: "8px" }}>
                <button
                    onClick={() => setStep("SUCCESS")}
                    className="w-full h-13 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md active:scale-[0.98] cursor-pointer"
                >
                    Done
                </button>
            </div>
        </div>
    );

    const renderSuccess = () => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", width: "100%", userSelect: "none" }}>
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-500 border border-green-100 shadow-sm">
                <CheckCircle2 size={40} className="animate-bounce" />
            </div>

            <div style={{ textAlign: "center" }}>
                <h2 className="text-3xl font-black text-slate-900 leading-none">Deposit Successful!</h2>
                <p className="text-slate-500 text-sm font-semibold" style={{ marginTop: "8px" }}>Your item has been stored safely</p>
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
                    <span style={{ padding: "4px 12px", backgroundColor: "#dcfce7", color: "#15803d", borderRadius: "9999px", fontWeight: "800", fontSize: "12px" }}>{assignedLockerId}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
                    <span style={{ fontWeight: "bold", color: "#64748b", fontSize: "12px" }}>Transaction ID</span>
                    <span style={{ fontFamily: "monospace", color: "#334155", fontWeight: "800", fontSize: "12px" }}>{transactionId}</span>
                </div>
            </div>

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
                <p className="text-xs text-blue-700 font-bold leading-normal">
                    Please use face recognition to retrieve your item.
                </p>
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
            {step === "DURATION" && renderDuration()}
            {step === "PAYMENT" && renderPayment()}
            {step === "FACE_REG" && renderFaceRegistration()}
            {step === "ASSIGNED" && renderLockerAssigned()}
            {step === "SUCCESS" && renderSuccess()}
        </KioskShell>
    );
}