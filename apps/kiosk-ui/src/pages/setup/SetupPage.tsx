import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
    Cpu, 
    Camera, 
    Layers, 
    CheckCircle2, 
    RefreshCw,
    Activity
} from "lucide-react";

import { SetupLayout } from "../../components/setup/SetupLayout";
import { SetupHeader } from "../../components/setup/SetupHeader";
import { SetupProgress } from "../../components/setup/SetupProgress";
import { SetupNavigation } from "../../components/setup/SetupNavigation";
import { AppButton } from "../../components/ui/AppButton";
import { 
    getCameras, 
    getControllers, 
    initializeCluster
} from "../../api/setup";
import type {
    CameraInfo,
    ControllerInfo,
    SetupConfigPayload 
} from "../../api/setup";

const TOTAL_STEPS = 7;

export default function SetupPage() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState(0);

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

    // Start/Stop Webcam
    const startCamera = async () => {
        try {
            if (mediaStreamRef.current) stopCamera();
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 } 
            });
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

    // Scan cameras
    const scanCameras = async () => {
        setCameraScanning(true);
        try {
            const list = await getCameras();
            setCameras(list);
            if (list.length > 0) {
                setSelectedCamera(list[0].name);
            }
        } catch (err) {
            console.error(err);
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

        if (currentStep < TOTAL_STEPS - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Finish Setup - Save Configuration
            setIsSaving(true);
            try {
                const payload: SetupConfigPayload = {
                    cluster_name: clusterName,
                    station_name: stationName,
                    location,
                    timezone,
                    free_minutes: Number(freeMinutes),
                    hourly_rate: Number(hourlyRate),
                    max_hours: Number(maxHours),
                    grace_period: Number(gracePeriod),
                    camera_model: selectedCamera,
                    controllers_count: Number(controllersCount),
                    lockers_count: Number(lockersCount),
                    locker_prefix: lockerPrefix,
                    razorpay_key_id: razorpayKeyId,
                    razorpay_key_secret: razorpayKeySecret
                };
                
                await initializeCluster(payload);
                
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "between", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label className="text-sm font-semibold text-slate-700">Target Controller Boards Count</label>
                    <p className="text-xs text-slate-400">Total physical relay controller modules connected.</p>
                </div>
                <input 
                    type="number" 
                    min="1" 
                    max="10"
                    value={controllersCount} 
                    onChange={(e) => setControllersCount(Math.max(1, Number(e.target.value)))}
                    className="w-24 h-12 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold bg-slate-50"
                    style={{ paddingLeft: "12px", paddingRight: "12px" }}
                />
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#1e293b" }}>
                        <Cpu size={24} className="text-blue-500" />
                        <span style={{ fontSize: "18px", fontWeight: 600 }}>Hardware Controllers Discovered</span>
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
                        {controllers.map((ctrl) => (
                            <div 
                                key={ctrl.id} 
                                style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    justifyContent: "between", 
                                    padding: "16px", 
                                    borderRadius: "12px", 
                                    backgroundColor: "#ffffff", 
                                    border: "1px solid #f1f5f9" 
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                    <Activity size={18} className="text-green-500" />
                                    <span className="font-semibold text-slate-800">{ctrl.id}</span>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600 border border-green-200/50">
                                    {ctrl.status}
                                </span>
                            </div>
                        ))}
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

            <div style={{ marginTop: "8px", padding: "20px", border: "1.5px solid #fed7aa", borderRadius: "16px", backgroundColor: "#fff7ed", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="text-sm font-bold text-orange-850">💳 Razorpay API Credentials {hourlyRate > 0 ? "(Required)" : "(Optional)"}</span>
                </div>
                
                <div style={{ display: "flex", flexFlow: "row wrap", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 220px" }}>
                        <label className="text-xs font-bold text-slate-600">Razorpay Key ID</label>
                        <input 
                            type="text"
                            placeholder="rzp_test_xxxxxxxxxx"
                            value={razorpayKeyId}
                            onChange={(e) => setRazorpayKeyId(e.target.value)}
                            className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-sm"
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
                                className="w-full h-11 pl-4 pr-12 rounded-xl border border-slate-300 bg-white text-sm font-mono"
                                style={{ paddingRight: "48px" }}
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
                    { label: "Hardware Controllers", value: `${controllersCount} modules` },
                    { label: "Lockers Installed", value: `${lockersCount} lockers total` },
                    { label: "Free Minutes & Rate", value: `${freeMinutes} mins, ₹${hourlyRate}/hr` },
                    { label: "Razorpay Gateway", value: hourlyRate > 0 ? (razorpayKeyId ? "Configured (DB)" : "Unconfigured ⚠️") : "Not Required (Free)" }
                ].map((item, idx) => (
                    <div 
                        key={idx} 
                        style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            padding: "12px 16px", 
                            borderBottom: idx === 6 ? "none" : "1px solid #e2e8f0" 
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
        <div className="flex flex-col items-center py-10 text-center">
            {saveProgress < 100 ? (
                <>
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                        <RefreshCw size={44} className="animate-spin" />
                    </div>
                    <h2 className="mt-8 text-3xl font-bold text-slate-900">Saving Configuration</h2>
                    <p className="mt-3 text-slate-500">Please wait while the databases and locker states are initialized...</p>
                    <div className="mt-8 w-64 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                        <div 
                            className="h-full bg-blue-600 transition-all duration-200"
                            style={{ width: `${saveProgress}%` }}
                        />
                    </div>
                </>
            ) : (
                <>
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-green-50 text-green-500">
                        <CheckCircle2 size={54} className="animate-bounce" />
                    </div>
                    <h2 className="mt-8 text-3xl font-bold text-slate-900">Setup Complete!</h2>
                    <p className="mt-3 text-slate-500">Your Smart Locker Cluster is ready to use. Restarting application...</p>
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

                <div className="py-2" style={{ marginBottom: "32px" }}>
                    {currentStep === 1 && renderClusterInfo()}
                    {currentStep === 2 && renderCameraDetection()}
                    {currentStep === 3 && renderControllerDiscovery()}
                    {currentStep === 4 && renderLockerDiscovery()}
                    {currentStep === 5 && renderPricingPolicy()}
                    {currentStep === 6 && renderReview()}
                </div>

                <SetupNavigation
                    isFirstStep={currentStep === 0}
                    isLastStep={currentStep === TOTAL_STEPS - 1}
                    onNext={handleNext}
                    onBack={handleBack}
                />
            </SetupLayout>
        </>
    );
}