import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
    Cpu, 
    Camera, 
    Layers, 
    CheckCircle2, 
    RefreshCw,
    QrCode,
    ShieldCheck
} from "lucide-react";

import { SetupLayout } from "../../components/setup/SetupLayout";
import { SetupHeader } from "../../components/setup/SetupHeader";
import { SetupProgress } from "../../components/setup/SetupProgress";
import { SetupNavigation } from "../../components/setup/SetupNavigation";
import { AppButton } from "../../components/ui/AppButton";
import { 
    getControllers, 
    getSetupStatus,
    initializeCluster
} from "../../api/setup";
import type {
    CameraInfo,
    ControllerInfo,
    SetupConfigPayload 
} from "../../api/setup";

const TOTAL_STEPS = 8;

const QrScanModal = ({ isOpen, onClose, onScanSuccess }: { isOpen: boolean; onClose: () => void; onScanSuccess: (keyId: string, keySecret: string) => void }) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [scanError, setScanError] = useState("");
    const [jsonInput, setJsonInput] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        let stream: MediaStream | null = null;
        let animationFrameId: number;

        const startScan = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();

                    if ('BarcodeDetector' in window) {
                        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                        const scanLoop = async () => {
                            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                                try {
                                    const barcodes = await detector.detect(videoRef.current);
                                    if (barcodes.length > 0) {
                                        const raw = barcodes[0].rawValue;
                                        handleRawQr(raw);
                                        return;
                                    }
                                } catch (e) {
                                    // continue
                                }
                            }
                            animationFrameId = requestAnimationFrame(scanLoop);
                        };
                        scanLoop();
                    }
                }
            } catch (err: any) {
                setScanError("Webcam scanning unavailable. You can paste the JSON credentials below.");
            }
        };

        startScan();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [isOpen]);

    const handleRawQr = (raw: string) => {
        try {
            const data = JSON.parse(raw);
            const keyId = data.key_id || data.razorpay_key_id || data.keyId;
            const keySecret = data.key_secret || data.razorpay_key_secret || data.keySecret;
            if (keyId && keySecret) {
                onScanSuccess(keyId, keySecret);
                onClose();
            } else {
                setScanError("QR code must contain key_id and key_secret fields.");
            }
        } catch (e) {
            setScanError("Invalid QR format. Expecting JSON format: {\"key_id\": \"...\", \"key_secret\": \"...\"}");
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            boxSizing: "border-box"
        }}>
            <div style={{
                backgroundColor: "#ffffff",
                borderRadius: "24px",
                padding: "28px",
                width: "100%",
                maxWidth: "440px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                border: "1px solid #f1f5f9",
                boxSizing: "border-box"
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: "14px",
                    gap: "12px"
                }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.3 }}>Scan Razorpay Credentials QR</h3>
                        <p style={{ fontSize: "12px", color: "#64748b", margin: 0, fontWeight: 500 }}>Hold the QR code on your phone in front of the camera.</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#f1f5f9",
                            color: "#64748b",
                            border: "none",
                            fontSize: "14px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{
                    width: "100%",
                    height: "200px",
                    backgroundColor: "#090d16",
                    borderRadius: "16px",
                    overflow: "hidden",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #1e293b"
                }}>
                    <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} playsInline muted />
                    <div style={{
                        position: "absolute",
                        top: "20px",
                        bottom: "20px",
                        left: "20px",
                        right: "20px",
                        border: "2px dashed rgba(96, 165, 250, 0.8)",
                        borderRadius: "12px",
                        pointerEvents: "none"
                    }} />
                </div>

                {scanError && (
                    <p style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#e11d48",
                        backgroundColor: "#fff1f2",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        border: "1px solid #fecdd3",
                        textAlign: "center",
                        margin: 0
                    }}>
                        {scanError}
                    </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Or Paste Credentials JSON</label>
                    <input 
                        type="text"
                        placeholder='{"key_id":"rzp_live_...","key_secret":"..."}'
                        value={jsonInput}
                        onChange={(e) => {
                            setJsonInput(e.target.value);
                            if (e.target.value.trim()) handleRawQr(e.target.value.trim());
                        }}
                        style={{
                            width: "100%",
                            height: "44px",
                            borderRadius: "12px",
                            border: "1.5px solid #cbd5e1",
                            padding: "0 14px",
                            fontSize: "12px",
                            fontFamily: "monospace",
                            backgroundColor: "#f8fafc",
                            color: "#0f172a",
                            boxSizing: "border-box",
                            outline: "none"
                        }}
                    />
                </div>

                <button 
                    onClick={onClose} 
                    style={{
                        width: "100%",
                        height: "44px",
                        borderRadius: "12px",
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#f1f5f9",
                        color: "#334155",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        marginTop: "4px"
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default function SetupPage() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState(0);

    const [isRazorpayPreConfigured, setIsRazorpayPreConfigured] = useState(false);
    const [maskedKeyId, setMaskedKeyId] = useState("");
    const [manualOverride, setManualOverride] = useState(false);
    const [showQrScanModal, setShowQrScanModal] = useState(false);

    // Read query parameter and fetch existing config if update mode
    const searchParams = new URLSearchParams(window.location.search);
    const isUpdateMode = searchParams.get("update") === "true";

    useEffect(() => {
        getSetupStatus()
            .then(data => {
                if (data) {
                    if (data.razorpay_configured) {
                        setIsRazorpayPreConfigured(true);
                        setMaskedKeyId(data.masked_key_id);
                    }
                    if (data.config && isUpdateMode) {
                        const cfg = data.config;
                        setClusterName(cfg.cluster_name || "");
                        setStationName(cfg.station_name || "");
                        setLocation(cfg.location || "");
                        setTimezone(cfg.timezone || "Asia/Kolkata");
                        setLockerPrefix(cfg.locker_prefix || "A");
                        setSelectedCamera(cfg.camera_model || "");
                        setControllersCount(cfg.controllers_count || 1);
                        setLockersCount(cfg.lockers_count || 10);
                        setFreeMinutes(cfg.free_minutes || 0);
                        setHourlyRate(cfg.hourly_rate || 10);
                        setMaxHours(cfg.max_hours || 24);
                        setGracePeriod(cfg.grace_period || 10);
                        setRazorpayKeyId(cfg.razorpay_key_id || "");
                        setRazorpayKeySecret(cfg.razorpay_key_secret || "");
                        setAdminPassword(cfg.admin_password || "admin123");
                        setFaceThreshold(cfg.face_threshold ? Math.round(cfg.face_threshold * 100) : 80);
                        setLivenessEnabled(cfg.liveness_enabled !== false);
                    }
                }
            })
            .catch(err => console.error("Failed to fetch setup status", err));
    }, [isUpdateMode]);

    // Custom Toast states
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType, setToastType] = useState<"error" | "info" | "success">("error");

    const showToast = (message: string, type: "error" | "info" | "success" = "error") => {
        setToastMessage(message);
        setToastType(type);
        setTimeout(() => {
            setToastMessage(null);
        }, 4000);
    };

    // Form states
    const [clusterName, setClusterName] = useState("");
    const [stationName, setStationName] = useState("");
    const [location, setLocation] = useState("");
    const [timezone, setTimezone] = useState("Asia/Kolkata");
    const [lockerPrefix, setLockerPrefix] = useState("A");

    // Camera states
    const [cameras, setCameras] = useState<CameraInfo[]>([]);
    const [selectedCamera, setSelectedCamera] = useState("");
    const [isTestingCamera, setIsTestingCamera] = useState(false);
    const [cameraScanning, setCameraScanning] = useState(false);
    const [faceThreshold, setFaceThreshold] = useState(80); // percentage 80%
    const [livenessEnabled, setLivenessEnabled] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    // Controllers states
    const [controllersCount, setControllersCount] = useState(1);
    const [controllers, setControllers] = useState<ControllerInfo[]>([]);
    const [controllersScanning, setControllersScanning] = useState(false);

    // Lockers states
    const [lockersCount, setLockersCount] = useState(10);

    // Pricing policy states
    const [freeMinutes, setFreeMinutes] = useState(15);
    const [hourlyRate, setHourlyRate] = useState(10);
    const [maxHours, setMaxHours] = useState(24);
    const [gracePeriod, setGracePeriod] = useState(10);

    // Razorpay credentials states
    const [razorpayKeyId, setRazorpayKeyId] = useState("");
    const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
    const [showKeySecret, setShowKeySecret] = useState(false);
    const [adminPassword, setAdminPassword] = useState("admin123");
    const [showAdminPassword, setShowAdminPassword] = useState(false);

    // Start/Stop Webcam
    const startCamera = async () => {
        try {
            if (mediaStreamRef.current) stopCamera();
            
            const constraints = {
                video: { 
                    deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                    width: { ideal: 640 }, 
                    height: { ideal: 480 } 
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(err => console.error("Video play failed", err));
            }
            setIsTestingCamera(true);
        } catch (err) {
            console.error("Error accessing camera:", err);
            showToast("Unable to access camera. Please check camera permissions.", "error");
        }
    };

    const stopCamera = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsTestingCamera(false);
    };

    // Scan cameras directly using the browser's WebRTC engine
    const scanCameras = async () => {
        setCameraScanning(true);
        try {
            // First, trigger a quick permission prompt to unlock labels
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach((track) => track.stop());
            } catch (e) {
                console.warn("Initial permission prompt skipped/failed", e);
            }

            // Enumerate devices directly in browser
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === "videoinput");
            
            if (videoInputs.length > 0) {
                const formatted = videoInputs.map((d, index) => ({
                    id: d.deviceId,
                    name: d.label || `Camera ${index + 1} (Grant permission to see name)`,
                    status: "Ready"
                }));
                setCameras(formatted);
                setSelectedCamera(formatted[0].id); // store deviceId in state
            } else {
                setCameras([]);
                setSelectedCamera("");
            }
        } catch (err) {
            console.error("Failed to scan camera devices in browser:", err);
            showToast("Failed to scan camera devices in browser.", "error");
        } finally {
            setCameraScanning(false);
        }
    };

    // Scan controllers
    const scanControllers = async () => {
        setControllersScanning(true);
        try {
            const list = await getControllers(controllersCount);
            setControllers(list);
            if (list.length > 0) {
                setControllersCount(list.length);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setControllersScanning(false);
        }
    };

    // Handle step change
    const handleNext = async () => {
        stopCamera();
        
        if (currentStep === 1) {
            // Validate Cluster Info
            if (!clusterName || !stationName || !location) {
                showToast("Please fill in all details.", "error");
                return;
            }
        }
        
        if (currentStep === 2) {
            // Validate Camera
            if (!selectedCamera) {
                showToast("Please select a camera to continue.", "error");
                return;
            }
        }

        if (currentStep === 6) {
            // Validate Security & Credentials
            if (!adminPassword || adminPassword.length < 6) {
                showToast("Admin password must be at least 6 characters long.", "error");
                return;
            }
            if (hourlyRate > 0 && (!razorpayKeyId || !razorpayKeySecret)) {
                showToast("Razorpay credentials are required when Hourly Rate is greater than zero.", "error");
                return;
            }
        }

        if (currentStep < TOTAL_STEPS - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Finish Setup - Save Configuration
            setIsSaving(true);
            try {
                const cameraObj = cameras.find(c => c.id === selectedCamera);
                const cameraModelName = cameraObj ? cameraObj.name : selectedCamera;

                const payload: SetupConfigPayload = {
                    cluster_name: clusterName,
                    station_name: stationName,
                    location,
                    timezone,
                    free_minutes: Number(freeMinutes),
                    hourly_rate: Number(hourlyRate),
                    max_hours: Number(maxHours),
                    grace_period: Number(gracePeriod),
                    camera_model: cameraModelName,
                    controllers_count: Number(controllersCount),
                    lockers_count: Number(lockersCount),
                    locker_prefix: lockerPrefix,
                    razorpay_key_id: razorpayKeyId,
                    razorpay_key_secret: razorpayKeySecret,
                    admin_password: adminPassword,
                    face_threshold: faceThreshold / 100,
                    liveness_enabled: livenessEnabled
                };
                
                await initializeCluster(payload, isUpdateMode);
                
                // Show completion progress animation
                let progress = 0;
                const interval = setInterval(() => {
                    progress += 10;
                    setSaveProgress(progress);
                    if (progress >= 100) {
                        clearInterval(interval);
                        setTimeout(() => {
                            navigate("/home");
                        }, 500);
                    }
                }, 200);

            } catch (err: any) {
                showToast(`Error saving configuration: ${err.message || err}`, "error");
                setIsSaving(false);
            }
        }
    };

    const handleBack = () => {
        stopCamera();
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    // Trigger actions on step load
    useEffect(() => {
        if (currentStep === 2) {
            scanCameras();
        } else if (currentStep === 3) {
            scanControllers();
        }
        return () => stopCamera();
    }, [currentStep]);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => stopCamera();
    }, []);

    // ----------------------------------------
    // RENDER SUB-VIEWS PER STEP
    // ----------------------------------------

    const renderWelcome = () => (
        <div className="flex flex-col items-center text-center" style={{ gap: "20px" }}>
            {/* Logo */}
            <div style={{ marginBottom: "4px" }}>
                <img
                    src="/images/branding/simats-logo.png"
                    alt="SIMATS Logo"
                    className="h-24 w-24 object-contain mx-auto"
                />
            </div>
            
            {/* Title */}
            <div>
                <span className="text-lg font-bold text-slate-500 block">Welcome to</span>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight mt-1">Smart Locker</h2>
            </div>
            
            {/* Explanations */}
            <div className="max-w-sm">
                <p className="font-bold text-slate-800 text-base leading-snug">
                    This Smart Locker Cluster has not been configured yet.
                </p>
                <p className="text-sm text-slate-400 font-medium mt-1">
                    This setup will take about 2 minutes.
                </p>
            </div>
            
            {/* Kiosk Render Illustration */}
            <div className="py-1">
                <img
                    src="/images/branding/smart-locker-kiosk.png"
                    alt="Smart Locker Kiosk"
                    className="h-44 w-auto object-contain mx-auto drop-shadow-md rounded-2xl"
                />
            </div>
            
            {/* Button */}
            <div className="w-full max-w-xs pt-2">
                <AppButton onClick={handleNext} className="h-14 font-bold text-lg shadow-lg">
                    Begin Setup
                </AppButton>
            </div>
        </div>
    );

        const renderClusterInfo = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
            <div style={{ display: "flex", flexFlow: "row wrap", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 200px" }}>
                    <label className="text-sm font-semibold text-slate-700">Cluster Name</label>
                    <input 
                        type="text" 
                        value={clusterName} 
                        onChange={(e) => setClusterName(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                        placeholder="e.g. Engineering Block A"
                        style={{ paddingLeft: "16px", paddingRight: "16px" }}
                    />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 200px" }}>
                    <label className="text-sm font-semibold text-slate-700">Station Name</label>
                    <input 
                        type="text" 
                        value={stationName} 
                        onChange={(e) => setStationName(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                        placeholder="e.g. Locker Station 01"
                        style={{ paddingLeft: "16px", paddingRight: "16px" }}
                    />
                </div>
            </div>
            <div style={{ display: "flex", flexFlow: "row wrap", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 200px" }}>
                    <label className="text-sm font-semibold text-slate-700">Location Details</label>
                    <input 
                        type="text" 
                        value={location} 
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                        placeholder="e.g. Chennai, Tamil Nadu"
                        style={{ paddingLeft: "16px", paddingRight: "16px" }}
                    />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 200px" }}>
                    <label className="text-sm font-semibold text-slate-700">Timezone</label>
                    <select 
                        value={timezone} 
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                        style={{ paddingLeft: "16px", paddingRight: "16px" }}
                    >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        <option value="UTC">UTC / Greenwich</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                    </select>
                </div>
            </div>
        </div>
    );

    const renderCameraDetection = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
            <div 
                style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    padding: "24px", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "16px", 
                    backgroundColor: "#f8fafc" 
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#1e293b" }}>
                    <Camera size={24} className="text-blue-500" />
                    <span style={{ fontSize: "18px", fontWeight: 600 }}>USB Cameras Detected</span>
                </div>
                
                {cameraScanning ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px", color: "#64748b" }}>
                        <RefreshCw size={18} className="animate-spin" /> Scanning connected inputs...
                    </div>
                ) : (
                    <div style={{ marginTop: "16px", width: "100%", maxWidth: "400px" }}>
                        <select 
                            value={selectedCamera}
                            onChange={(e) => setSelectedCamera(e.target.value)}
                            className="w-full h-12 rounded-xl border border-slate-300 bg-white"
                            style={{ paddingLeft: "16px", paddingRight: "16px" }}
                        >
                            {cameras.length === 0 ? (
                                <option value="">No Camera Detected</option>
                            ) : (
                                cameras.map((cam) => (
                                    <option key={cam.id} value={cam.name}>
                                        {cam.name} ({cam.status})
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                )}

                {/* Slim settings controls directly inside camera detection card */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "400px", marginTop: "16px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label className="text-sm font-semibold text-slate-700">Face Match Threshold</label>
                        <span className="text-sm font-bold text-blue-600">{faceThreshold}%</span>
                    </div>
                    <input 
                        type="range"
                        min="50"
                        max="95"
                        value={faceThreshold}
                        onChange={(e) => setFaceThreshold(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                        <input 
                            type="checkbox"
                            id="liveness_enabled_setup"
                            checked={livenessEnabled}
                            onChange={(e) => setLivenessEnabled(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="liveness_enabled_setup" className="text-sm font-semibold text-slate-700 cursor-pointer">
                            Enable Anti-Spoofing
                        </label>
                    </div>
                </div>
            </div>

            {/* Webcam video preview */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                <div className="relative w-full max-w-md aspect-video rounded-2xl bg-black overflow-hidden shadow-lg border border-slate-300">
                    <video 
                        ref={videoRef}
                        className="w-full h-full object-cover transform scale-x-[-1]"
                        muted 
                        playsInline
                    />
                    {!isTestingCamera && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-white text-sm text-center px-6">
                            Press "Test Camera" to view live feed
                        </div>
                    )}
                </div>

                <AppButton 
                    onClick={isTestingCamera ? stopCamera : startCamera}
                    className={`px-7 py-2.5 rounded-lg font-bold shadow-md transition-all active:scale-[0.98] ${
                        isTestingCamera 
                        ? "bg-rose-500 text-white hover:bg-rose-600" 
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                >
                    {isTestingCamera ? "Stop Preview" : "Test Camera"}
                </AppButton>
            </div>
        </div>
    );

    const renderControllerDiscovery = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
                <label className="text-sm font-semibold text-slate-700">Relay Controller Discovery</label>
                <p className="text-xs text-slate-400">The system automatically discovers connected serial controllers. No manual count input is required.</p>
            </div>

            <div 
                style={{ 
                    padding: "24px", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "16px", 
                    backgroundColor: "#f8fafc", 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: "16px" 
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#1e293b" }}>
                        <Cpu size={24} className="text-blue-500" />
                        <span style={{ fontSize: "18px", fontWeight: 600 }}>Hardware Controllers Discovered ({controllersCount})</span>
                    </div>
                    <button 
                        onClick={scanControllers}
                        className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                        title="Scan controllers"
                    >
                        <RefreshCw size={18} className={controllersScanning ? "animate-spin" : ""} />
                    </button>
                </div>

                {controllersScanning ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", gap: "8px", color: "#64748b" }}>
                        <RefreshCw size={18} className="animate-spin" /> Scanning communication ports...
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {controllers.length === 0 ? (
                            <div className="text-center p-6 text-slate-400 text-sm">
                                No controllers discovered. Plug in your USB serial controller and click the scan icon above.
                            </div>
                        ) : (
                            controllers.map((ctrl) => (
                                <div 
                                    key={ctrl.id} 
                                    style={{ 
                                        display: "flex", 
                                        alignItems: "center", 
                                        justifyContent: "space-between", 
                                        padding: "16px", 
                                        borderRadius: "12px", 
                                        backgroundColor: "#ffffff", 
                                        border: "1px solid #f1f5f9" 
                                    }}
                                >
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <span className="font-semibold text-slate-800 text-sm">{ctrl.name}</span>
                                        <span className="text-slate-400 text-xs font-mono">{ctrl.port}</span>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                        ctrl.status === 'Online' 
                                            ? 'bg-green-50 text-green-600 border border-green-200/50' 
                                            : 'bg-red-50 text-red-600 border border-red-200/50'
                                    }`}>
                                        {ctrl.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    const renderLockerDiscovery = () => {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <label className="text-sm font-semibold text-slate-700">Lockers to Initialize</label>
                            <p className="text-xs text-slate-400">Total lockers allocation in this cluster station.</p>
                        </div>
                        <input 
                            type="number" 
                            min="2" 
                            max="100"
                            step="2"
                            value={lockersCount} 
                            onChange={(e) => setLockersCount(Math.max(2, Number(e.target.value)))}
                            className="w-24 h-12 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold bg-slate-50"
                            style={{ paddingLeft: "12px", paddingRight: "12px" }}
                        />
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <label className="text-sm font-semibold text-slate-700">Locker ID Prefix Code</label>
                            <p className="text-xs text-slate-400">Custom starting code prefix (e.g. A, ECL, LKR).</p>
                        </div>
                        <input 
                            type="text" 
                            value={lockerPrefix} 
                            onChange={(e) => setLockerPrefix(e.target.value.toUpperCase())}
                            className="w-28 h-12 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold bg-slate-50"
                            style={{ paddingLeft: "12px", paddingRight: "12px" }}
                            placeholder="A"
                        />
                    </div>
                </div>

                <div 
                    style={{ 
                        padding: "24px", 
                        border: "1px solid #e2e8f0", 
                        borderRadius: "16px", 
                        backgroundColor: "#f8fafc", 
                        display: "flex", 
                        flexDirection: "column", 
                        gap: "16px" 
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#1e293b" }}>
                        <Layers size={24} className="text-blue-500" />
                        <span style={{ fontSize: "18px", fontWeight: 600 }}>Virtual Grid Layout Preview</span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {Array.from({ length: lockersCount }).map((_, i) => {
                            const prefixVal = lockerPrefix || "A";
                            const lockerId = prefixVal !== "A" 
                                ? `${prefixVal}-${i + 1}` 
                                : `${String.fromCharCode(64 + Math.floor(i / (lockersCount / controllersCount)) + 1)}-${((i % (lockersCount / controllersCount)) + 1).toString().padStart(2, "0")}`;
                            return (
                                <div 
                                    key={i} 
                                    style={{ 
                                        display: "flex", 
                                        flexDirection: "row", 
                                        alignItems: "center", 
                                        justifyContent: "center", 
                                        padding: "8px 10px", 
                                        borderRadius: "10px", 
                                        backgroundColor: "#ffffff", 
                                        border: "1px solid #e2e8f0",
                                        gap: "6px",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                                    }}
                                >
                                    <span style={{ fontSize: "12px", fontWeight: "bold", color: "#334155", letterSpacing: "-0.02em" }}>{lockerId}</span>
                                    <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#22c55e", flexShrink: 0 }} />
                                </div>
                            );
                        })}
                    </div>
                    
                    <p className="text-xs text-slate-400 text-center mt-2">
                        Lockers will be evenly split across the {controllersCount} controllers ({lockersCount / controllersCount} per module).
                    </p>
                </div>
            </div>
        );
    };

    const renderPricingPolicy = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
            <div style={{ display: "flex", flexFlow: "row wrap", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 200px" }}>
                    <label className="text-sm font-semibold text-slate-700">Free Minutes</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            value={freeMinutes} 
                            onChange={(e) => setFreeMinutes(Math.max(0, Number(e.target.value)))}
                            className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-300 bg-slate-50"
                            style={{ paddingLeft: "16px", paddingRight: "48px" }}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">mins</span>
                    </div>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 200px" }}>
                    <label className="text-sm font-semibold text-slate-700">Hourly Rate</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            value={hourlyRate} 
                            onChange={(e) => setHourlyRate(Math.max(0, Number(e.target.value)))}
                            className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-300 bg-slate-50 font-bold"
                            style={{ paddingLeft: "40px", paddingRight: "16px" }}
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">/ hour</span>
                    </div>
                </div>
            </div>

            <div style={{ display: "flex", flexFlow: "row wrap", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 200px" }}>
                    <label className="text-sm font-semibold text-slate-700">Maximum Duration Limit</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            value={maxHours} 
                            onChange={(e) => setMaxHours(Math.max(1, Number(e.target.value)))}
                            className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-300 bg-slate-50"
                            style={{ paddingLeft: "16px", paddingRight: "48px" }}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">hours</span>
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 200px" }}>
                    <label className="text-sm font-semibold text-slate-700">Payment Grace Period</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            value={gracePeriod} 
                            onChange={(e) => setGracePeriod(Math.max(0, Number(e.target.value)))}
                            className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-300 bg-slate-50"
                            style={{ paddingLeft: "16px", paddingRight: "48px" }}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">mins</span>
                    </div>
                </div>
            </div>
        </div>
    );    const renderSecurityCredentials = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
            {/* Admin Password card */}
            <div style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "16px", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", gap: "12px" }}>
                <span className="text-sm font-bold text-slate-800">Admin Dashboard Authentication</span>
                <p className="text-xs text-slate-500">Configure the password used to access the administrator maintenance dashboard.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label className="text-xs font-bold text-slate-600">Admin Password (min. 6 characters)</label>
                    <div className="relative">
                        <input 
                            type={showAdminPassword ? "text" : "password"}
                            placeholder="admin123"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className="w-full h-11 rounded-xl border border-slate-300 bg-white text-sm font-mono"
                            style={{ paddingLeft: "16px", paddingRight: "48px" }}
                        />
                        <button 
                            type="button"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                            {showAdminPassword ? "Hide" : "Show"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Razorpay credentials card */}
            <div style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "16px", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span className="text-sm font-bold text-slate-800">Razorpay API Credentials {hourlyRate > 0 ? "(Required)" : "(Optional)"}</span>
                        <p className="text-xs text-slate-500">Enable automated UPI QR payments for locker rentals.</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowQrScanModal(true)}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            padding: "8px 16px",
                            borderRadius: "12px",
                            backgroundColor: "#eff6ff",
                            color: "#1d4ed8",
                            border: "1px solid #bfdbfe",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap"
                        }}
                    >
                        <QrCode size={16} />
                        <span>Scan QR Code</span>
                    </button>
                </div>

                {isRazorpayPreConfigured && !manualOverride ? (
                    <div className="p-4 border border-emerald-200/90 bg-emerald-50/80 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0">
                                <ShieldCheck size={22} />
                            </div>
                            <div>
                                <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider block">Pre-Configured by Institution</span>
                                <span className="text-xs font-mono text-emerald-700 font-bold">{maskedKeyId || "Active in Environment"}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setManualOverride(true)}
                            className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                        >
                            Manual Override
                        </button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {manualOverride && (
                            <div className="flex items-center justify-between text-xs font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                                <span>Overriding Pre-Configured Keys</span>
                                <button type="button" onClick={() => setManualOverride(false)} className="text-amber-800 underline cursor-pointer">
                                    Revert to Pre-Configured
                                </button>
                            </div>
                        )}
                        <div style={{ display: "flex", flexFlow: "row wrap", gap: "16px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 220px" }}>
                                <label className="text-xs font-bold text-slate-600">Razorpay Key ID</label>
                                <input 
                                    type="text"
                                    placeholder="rzp_test_xxxxxxxxxx"
                                    value={razorpayKeyId}
                                    onChange={(e) => setRazorpayKeyId(e.target.value)}
                                    className="w-full h-11 rounded-xl border border-slate-300 bg-white text-sm"
                                    style={{ paddingLeft: "16px", paddingRight: "16px" }}
                                />
                            </div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 220px" }}>
                                <label className="text-xs font-bold text-slate-600">Razorpay Key Secret</label>
                                <div className="relative">
                                    <input 
                                        type={showKeySecret ? "text" : "password"}
                                        placeholder="••••••••••••••••"
                                        value={razorpayKeySecret}
                                        onChange={(e) => setRazorpayKeySecret(e.target.value)}
                                        className="w-full h-11 rounded-xl border border-slate-300 bg-white text-sm font-mono"
                                        style={{ paddingLeft: "16px", paddingRight: "48px" }}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowKeySecret(!showKeySecret)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                                    >
                                        {showKeySecret ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderReview = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
            <div 
                style={{ 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "16px", 
                    backgroundColor: "#f8fafc", 
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    padding: "8px"
                }}
            >
                {[
                    { label: "Cluster / Station", value: clusterName && stationName ? `${clusterName} (${stationName})` : "-" },
                    { label: "Location / Timezone", value: `${location || "-"} (${timezone})` },
                    { label: "Camera Hardware", value: selectedCamera || "None" },
                    { label: "Face Threshold", value: `${faceThreshold}%` },
                    { label: "Anti-Spoofing (Liveness)", value: livenessEnabled ? "Enabled" : "Disabled" },
                    { label: "Hardware Controllers", value: `${controllersCount} modules` },
                    { label: "Lockers Installed", value: `${lockersCount} lockers total` },
                    { label: "Free Minutes & Rate", value: `${freeMinutes} mins, ₹${hourlyRate}/hr` },
                    { label: "Razorpay Gateway", value: hourlyRate > 0 ? (razorpayKeyId ? "Configured (DB)" : "Unconfigured ⚠️") : "Not Required (Free)" },
                    { label: "Admin Password", value: adminPassword ? "••••••" : "Default" }
                ].map((item, idx) => (
                    <div 
                        key={idx} 
                        style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            padding: "12px 16px", 
                            borderBottom: idx === 9 ? "none" : "1px solid #e2e8f0" 
                        }}
                    >
                        <span style={{ fontWeight: 600, color: "#64748b", fontSize: "14px" }}>{item.label}</span>
                        <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "14px", textAlign: "right" }}>{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderSavingState = () => (
        <div 
            className="flex flex-col items-center justify-center py-12 text-center"
            style={{ minHeight: "450px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
        >
            {saveProgress < 100 ? (
                <>
                    <div 
                        className="bg-blue-50 text-blue-500" 
                        style={{ 
                            width: "96px", 
                            height: "96px", 
                            borderRadius: "50%", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            margin: "0 auto"
                        }}
                    >
                        <RefreshCw size={44} className="animate-spin" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900" style={{ marginTop: "32px" }}>Saving Configuration</h2>
                    <p className="text-slate-500" style={{ marginTop: "12px" }}>Please wait while the databases and locker states are initialized...</p>
                    <div className="bg-slate-100 border border-slate-200" style={{ width: "256px", height: "8px", borderRadius: "9999px", overflow: "hidden", marginTop: "32px", margin: "32px auto 0 auto" }}>
                        <div 
                            className="h-full bg-blue-600 transition-all duration-200"
                            style={{ width: `${saveProgress}%`, height: "100%" }}
                        />
                    </div>
                </>
            ) : (
                <>
                    <div 
                        className="bg-green-50 text-green-500" 
                        style={{ 
                            width: "96px", 
                            height: "96px", 
                            borderRadius: "50%", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            margin: "0 auto"
                        }}
                    >
                        <CheckCircle2 size={54} className="animate-bounce" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900" style={{ marginTop: "32px" }}>Setup Complete!</h2>
                    <p className="text-slate-500" style={{ marginTop: "12px" }}>Your Smart Locker Cluster is ready to use. Restarting application...</p>
                </>
            )}
        </div>
    );

    // ----------------------------------------
    // RENDER CONTROLLER
    // ----------------------------------------

    const handleStepClick = (stepIndex: number) => {
        if (stepIndex <= currentStep) {
            setCurrentStep(stepIndex);
        } else {
            showToast("Please complete the current setup steps before skipping forward.", "error");
        }
    };

    if (isSaving) {
        return (
            <SetupLayout>
                {renderSavingState()}
            </SetupLayout>
        );
    }


    if (currentStep === 0) {
        return (
            <>
                {toastMessage && (
                    <div 
                        className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center justify-center font-bold text-sm tracking-wide text-center"
                        style={{
                            backgroundColor: toastType === "error" ? "#f43f5e" : toastType === "success" ? "#10b981" : "#3b82f6",
                            color: "#ffffff",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            minWidth: "320px",
                            maxWidth: "90%",
                            padding: "14px 28px",
                            borderRadius: "16px",
                            boxShadow: "0 20px 45px rgba(15, 23, 42, 0.15)",
                            lineHeight: "1.4"
                        }}
                    >
                        {toastMessage}
                    </div>
                )}
                <SetupLayout>
                    {renderWelcome()}
                </SetupLayout>
            </>
        );
    }

    return (
        <>
            {toastMessage && (
                <div 
                    className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center justify-center font-bold text-sm tracking-wide text-center"
                    style={{
                        backgroundColor: toastType === "error" ? "#f43f5e" : toastType === "success" ? "#10b981" : "#3b82f6",
                        color: "#ffffff",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        minWidth: "320px",
                        maxWidth: "90%",
                        padding: "14px 28px",
                        borderRadius: "16px",
                        boxShadow: "0 20px 45px rgba(15, 23, 42, 0.15)",
                        lineHeight: "1.4"
                    }}
                >
                    {toastMessage}
                </div>
            )}
            <SetupLayout>
                <SetupHeader />

                <SetupProgress
                    currentStep={currentStep}
                    totalSteps={TOTAL_STEPS}
                    onStepClick={handleStepClick}
                />

                <div className="h-6" />

                <div className="py-2" style={{ marginBottom: "32px", maxHeight: "410px", overflowY: "auto", paddingRight: "4px" }}>
                    {currentStep === 1 && renderClusterInfo()}
                    {currentStep === 2 && renderCameraDetection()}
                    {currentStep === 3 && renderControllerDiscovery()}
                    {currentStep === 4 && renderLockerDiscovery()}
                    {currentStep === 5 && renderPricingPolicy()}
                    {currentStep === 6 && renderSecurityCredentials()}
                    {currentStep === 7 && renderReview()}
                </div>

                <SetupNavigation
                    isFirstStep={currentStep === 0}
                    isLastStep={currentStep === TOTAL_STEPS - 1}
                    onNext={handleNext}
                    onBack={handleBack}
                />
            </SetupLayout>

            <QrScanModal 
                isOpen={showQrScanModal} 
                onClose={() => setShowQrScanModal(false)} 
                onScanSuccess={(keyId, keySecret) => {
                    setRazorpayKeyId(keyId);
                    setRazorpayKeySecret(keySecret);
                    setIsRazorpayPreConfigured(false);
                    showToast("Credentials imported successfully via QR Code!", "success");
                }} 
            />
        </>
    );
}