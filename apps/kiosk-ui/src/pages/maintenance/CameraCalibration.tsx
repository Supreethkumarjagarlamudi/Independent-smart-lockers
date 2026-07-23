import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
    ArrowLeft, Camera, Sliders, AlertTriangle, 
    Save, RotateCcw, Sparkles, Play, Loader2 
} from "lucide-react";
import { AppLayout } from "../../components/layout/AppLayout";
import { APP_CONFIG } from "../../config/app";

interface CameraControl {
    name: string;
    type: string;
    min: number;
    max: number;
    step: number;
    default: number;
    value: number;
    options?: Record<string, string>;
}

interface DeviceInfo {
    name: string;
    device_path: string;
    driver: string;
    status: string;
    resolution: string;
    fps: string;
    pixel_format: string;
}

interface Suggestion {
    name: string;
    current: number;
    suggested: number;
    difference: number;
}

export function CameraCalibrationDashboard({ onClose }: { onClose?: () => void }) {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    
    // State
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [controls, setControls] = useState<CameraControl[]>([]);
    const [loadingControls, setLoadingControls] = useState(true);
    
    // Live stream state
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState("");
    
    // Analysis results state
    const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
    const [imageQuality, setImageQuality] = useState<any>(null);
    const [evaluation, setEvaluation] = useState<any>(null);
    
    // Auto-tune modal state
    const [showAutoTune, setShowAutoTune] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [tuningLoading, setTuningLoading] = useState(false);
    
    // Test recognition state
    const [testResults, setTestResults] = useState<any>(null);
    const [testingRecognition, setTestingRecognition] = useState(false);
    
    // Saving state
    const [saving, setSaving] = useState(false);
    const [actionMessage, setActionMessage] = useState("");

    // Load Device Info and Controls
    const fetchCameraMetadata = async () => {
        try {
            const devRes = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/device-info`);
            if (devRes.ok) setDeviceInfo(await devRes.json());
            
            const ctrlRes = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/controls`);
            if (ctrlRes.ok) {
                setControls(await ctrlRes.json());
            }
        } catch (e) {
            console.error("Failed to load camera metadata", e);
        } finally {
            setLoadingControls(false);
        }
    };

    useEffect(() => {
        fetchCameraMetadata();
        startCamera();
        
        return () => {
            stopCamera();
        };
    }, []);

    // Start Webcam
    const startCamera = async () => {
        setCameraError("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(console.error);
            }
            setIsCameraActive(true);
        } catch (err: any) {
            setCameraError("Could not access the local camera hardware: " + (err.message || err));
        }
    };

    // Stop Webcam
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
    };

    // Analysis Loop at 4 FPS (every 250ms)
    useEffect(() => {
        if (!isCameraActive) return;
        
        const interval = setInterval(() => {
            captureAndAnalyzeFrame();
        }, 250);
        
        return () => clearInterval(interval);
    }, [isCameraActive, controls]);

    const captureAndAnalyzeFrame = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Ensure video has loaded details
        if (video.videoWidth === 0 || video.videoHeight === 0) return;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        // Downscale frame to 320x240 for RPi optimization
        canvas.width = 320;
        canvas.height = 240;
        ctx.drawImage(video, 0, 0, 320, 240);
        
        const base64Image = canvas.toDataURL("image/jpeg", 0.85);
        
        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64Image })
            });
            
            if (res.ok) {
                const data = await res.json();
                setImageQuality(data.image_quality);
                setEvaluation(data.evaluation);
                if (data.face_quality?.annotated_image) {
                    setAnnotatedFrame(`data:image/jpeg;base64,${data.face_quality.annotated_image}`);
                }
            }
        } catch (err) {
            console.error("Frame analysis failed", err);
        }
    };

    // Handle Control Change (instantly updates V4L2 value)
    const handleControlChange = async (name: string, value: number) => {
        // Optimistically update state
        setControls(prev => 
            prev.map(c => c.name === name ? { ...c, value } : c)
        );
        
        try {
            await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/set-control`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, value })
            });
        } catch (e) {
            console.error("Failed to update control", e);
        }
    };

    // Suggest Settings
    const triggerAutoTune = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        setTuningLoading(true);
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            
            canvas.width = 320;
            canvas.height = 240;
            ctx.drawImage(video, 0, 0, 320, 240);
            const base64Image = canvas.toDataURL("image/jpeg", 0.85);

            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/autotune`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64Image })
            });
            
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data.suggestions);
                setShowAutoTune(true);
            }
        } catch (e) {
            console.error("Auto tune request failed", e);
        } finally {
            setTuningLoading(false);
        }
    };

    const applySuggestions = async () => {
        setTuningLoading(true);
        try {
            for (const s of suggestions) {
                await handleControlChange(s.name, s.suggested);
            }
            setShowAutoTune(false);
            showFeedbackToast("Tuned settings applied successfully.");
        } catch (e) {
            console.error(e);
        } finally {
            setTuningLoading(false);
        }
    };

    // Test Recognition Pipeline
    const triggerTestRecognition = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        setTestingRecognition(true);
        setTestResults(null);
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            
            canvas.width = 320;
            canvas.height = 240;
            ctx.drawImage(video, 0, 0, 320, 240);
            const base64Image = canvas.toDataURL("image/jpeg", 0.85);

            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/test-recognition`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64Image })
            });
            
            if (res.ok) {
                setTestResults(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setTestingRecognition(false);
        }
    };

    // Save configuration profile
    const handleSaveCalibration = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/save`, { method: "POST" });
            if (res.ok) {
                showFeedbackToast("Calibration successfully saved to system profile!");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    // Reset Defaults
    const handleResetDefaults = async () => {
        if (!window.confirm("Are you sure you want to restore default factory calibration parameters?")) return;
        setSaving(true);
        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/reset`, { method: "POST" });
            if (res.ok) {
                await fetchCameraMetadata();
                showFeedbackToast("Parameters successfully reset to default.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const showFeedbackToast = (msg: string) => {
        setActionMessage(msg);
        setTimeout(() => setActionMessage(""), 4000);
    };

    // Helper color mapping
    const getStatusColor = (status: string) => {
        switch (status) {
            case "EXCELLENT": return "#22c55e";
            case "WARNING": return "#eab308";
            case "PROBLEM": return "#ef4444";
            default: return "#64748b";
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 85) return "#22c55e";
        if (score >= 60) return "#eab308";
        return "#ef4444";
    };

    return (
        <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* Notification toast */}
                {actionMessage && (
                    <div style={{ position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 10000, background: "#0f172a", color: "#fff", padding: "14px 28px", borderRadius: "16px", fontWeight: 700, fontSize: "14px", boxShadow: "0 20px 45px rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {actionMessage}
                    </div>
                )}

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button onClick={onClose || (() => navigate("/admin"))} style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#fff", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#334155" }}>
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: "22px", fontWeight: 900, color: "#0f172a", margin: 0 }}>Camera Diagnostics & Calibration</h1>
                            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Optimize sensor calibration parameters to maximize facial biometrics accuracy.</p>
                        </div>
                    </div>
                    
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={handleResetDefaults} disabled={saving} style={{ height: "42px", padding: "0 16px", borderRadius: "11px", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                            <RotateCcw size={14} /> Reset defaults
                        </button>
                        <button onClick={handleSaveCalibration} disabled={saving} style={{ height: "42px", padding: "0 20px", borderRadius: "11px", border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(37,99,235,0.2)" }}>
                            <Save size={14} /> Save configuration
                        </button>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: "24px" }}>
                    
                    {/* Left Panel: Camera Feed & Diagnostics */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        
                        {/* Live Feed Screen */}
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "20px", position: "relative" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: isCameraActive ? "#22c55e" : "#ef4444", animation: isCameraActive ? "pulse 2s infinite" : "none" }} />
                                    <span style={{ fontWeight: 800, fontSize: "13px", color: "#334155" }}>LIVE SCAN FEED</span>
                                </div>
                                <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace", fontWeight: 600 }}>
                                    {deviceInfo?.resolution} @ {deviceInfo?.fps} ({deviceInfo?.pixel_format})
                                </div>
                            </div>

                            <div style={{ position: "relative", width: "100%", height: "420px", background: "#090d16", borderRadius: "18px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {/* Hidden source video */}
                                <video ref={videoRef} style={{ display: "none" }} muted playsInline />
                                {/* Hidden downscale canvas */}
                                <canvas ref={canvasRef} style={{ display: "none" }} />
                                
                                {isCameraActive && annotatedFrame ? (
                                    <img src={annotatedFrame} alt="Annotated Frame" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                ) : (
                                    <div style={{ color: "#475569", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                                        {cameraError ? (
                                            <>
                                                <AlertTriangle size={38} color="#ef4444" />
                                                <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>{cameraError}</p>
                                            </>
                                        ) : (
                                            <>
                                                <Camera size={38} />
                                                <p style={{ fontSize: "13px", color: "#94a3b8" }}>Starting stream...</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Analysis Diagnostics */}
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Image & Biometric Metrics</h3>
                            
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                                
                                {/* Overall Score */}
                                <div style={{ background: "#f8fafc", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #f1f5f9", textAlign: "center" }}>
                                    <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Biometric Quality</span>
                                    <div style={{ fontSize: "28px", fontWeight: 900, color: getScoreColor(evaluation?.score ?? 0), margin: "8px 0" }}>
                                        {evaluation?.score ?? 0} <span style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8" }}>/100</span>
                                    </div>
                                    <span style={{ fontSize: "12px", fontWeight: 800, color: getScoreColor(evaluation?.score ?? 0), background: `${getScoreColor(evaluation?.score ?? 0)}15`, padding: "2px 8px", borderRadius: "20px" }}>
                                        {evaluation?.rating ?? "Calculating..."}
                                    </span>
                                </div>

                                {/* Sharpness Score */}
                                <div style={{ background: "#f8fafc", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #f1f5f9", textAlign: "center" }}>
                                    <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Sharpness Index</span>
                                    <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f172a", margin: "10px 0" }}>
                                        {imageQuality?.sharpness ?? 0}
                                    </div>
                                    <span style={{ fontSize: "11px", fontWeight: 600, color: (imageQuality?.sharpness ?? 0) > 100 ? "#16a34a" : "#ca8a04" }}>
                                        {(imageQuality?.sharpness ?? 0) > 100 ? "Focused" : "Soft Focus"}
                                    </span>
                                </div>

                                {/* Brightness Score */}
                                <div style={{ background: "#f8fafc", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #f1f5f9", textAlign: "center" }}>
                                    <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Brightness Mean</span>
                                    <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f172a", margin: "10px 0" }}>
                                        {imageQuality?.avg_brightness ?? 0}
                                    </div>
                                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                                        {imageQuality?.exposure_status ?? "Unexposed"}
                                    </span>
                                </div>

                            </div>
                        </div>

                    </div>

                    {/* Right Panel: V4L2 Dynamic Controls & Recommendations */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        
                        {/* Dynamic Camera Controls */}
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "26px", display: "flex", flexDirection: "column", gap: "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <Sliders size={18} color="#2563eb" />
                                    <h2 style={{ fontSize: "15px", fontWeight: 900, color: "#0f172a", margin: 0 }}>V4L2 Camera Control Parameters</h2>
                                </div>
                                <button onClick={triggerAutoTune} disabled={tuningLoading} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "10px", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "11px", cursor: "pointer" }}>
                                    {tuningLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Suggest Settings
                                </button>
                            </div>

                            {loadingControls ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: "10px" }}>
                                    <Loader2 className="animate-spin" size={24} color="#64748b" />
                                    <span style={{ fontSize: "12px", color: "#64748b" }}>Querying supported hardware controls...</span>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "420px", overflowY: "auto", paddingRight: "6px" }}>
                                    {controls.map((ctrl) => {
                                        const cleanName = ctrl.name.replace(/_/g, " ");
                                        return (
                                            <div key={ctrl.name} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "capitalize" }}>{cleanName}</label>
                                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>{ctrl.value}</span>
                                                </div>
                                                
                                                {ctrl.type === "bool" ? (
                                                    <input 
                                                        type="checkbox" 
                                                        checked={ctrl.value === 1}
                                                        onChange={(e) => handleControlChange(ctrl.name, e.target.checked ? 1 : 0)}
                                                        style={{ width: "38px", height: "20px", cursor: "pointer" }}
                                                    />
                                                ) : ctrl.type === "menu" && ctrl.options ? (
                                                    <select 
                                                        value={ctrl.value}
                                                        onChange={(e) => handleControlChange(ctrl.name, Number(e.target.value))}
                                                        style={{ height: "36px", borderRadius: "8px", border: "1.5px solid #cbd5e1", padding: "0 10px", fontSize: "12px", background: "#f8fafc", color: "#334155", width: "100%" }}
                                                    >
                                                        {Object.entries(ctrl.options).map(([k, v]) => (
                                                            <option key={k} value={k}>{v}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input 
                                                        type="range"
                                                        min={ctrl.min}
                                                        max={ctrl.max}
                                                        step={ctrl.step}
                                                        value={ctrl.value}
                                                        onChange={(e) => handleControlChange(ctrl.name, Number(e.target.value))}
                                                        style={{ width: "100%", height: "6px", borderRadius: "4px", outline: "none", cursor: "pointer" }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Live Guidelines & Recommendations */}
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "26px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Diagnostics Engine Feedback</h3>
                            
                            {/* Real-time Checks */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {evaluation?.checks && evaluation.checks.length > 0 ? (
                                    evaluation.checks.map((c: any, i: number) => (
                                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                                            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: getStatusColor(c.status), marginTop: "5px", flexShrink: 0 }} />
                                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>{c.message}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ fontSize: "12px", color: "#94a3b8" }}>No real-time diagnostic checks received yet.</p>
                                )}
                            </div>

                            {/* Recommendations list */}
                            {evaluation?.recommendations && evaluation.recommendations.length > 0 && (
                                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#ef4444", textTransform: "uppercase" }}>Recommended Tweaks</span>
                                    {evaluation.recommendations.map((r: any, idx: number) => (
                                        <div key={idx} style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "12px", padding: "10px 14px" }}>
                                            <div style={{ fontSize: "12px", fontWeight: 800, color: "#991b1b" }}>{r.action}</div>
                                            <div style={{ fontSize: "11px", color: "#b91c1c", marginTop: "2px" }}>{r.why}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Test Recognition Block */}
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "26px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Enrollment & Matching Benchmark</h3>
                                <button onClick={triggerTestRecognition} disabled={testingRecognition} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "10px", border: "none", background: "#10b981", color: "#fff", fontWeight: 700, fontSize: "12px", cursor: "pointer", boxShadow: "0 4px 10px rgba(16,185,129,0.2)" }}>
                                    {testingRecognition ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Test Recognition
                                </button>
                            </div>

                            {testResults ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "16px", padding: "16px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                                        <span style={{ color: "#166534", fontWeight: 600 }}>Face Detection Speed:</span>
                                        <span style={{ color: "#14532d", fontWeight: 800, fontFamily: "monospace" }}>{testResults.detection_time_ms} ms</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                                        <span style={{ color: "#166534", fontWeight: 600 }}>Feature Extraction Speed:</span>
                                        <span style={{ color: "#14532d", fontWeight: 800, fontFamily: "monospace" }}>{testResults.recognition_time_ms} ms</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                                        <span style={{ color: "#166534", fontWeight: 600 }}>Landmark Matching Quality:</span>
                                        <span style={{ color: "#14532d", fontWeight: 800 }}>{testResults.embedding_quality}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                                        <span style={{ color: "#166534", fontWeight: 600 }}>Pipeline Validation Status:</span>
                                        <span style={{ color: "#14532d", fontWeight: 800 }}>{testResults.overall_success ? "🟢 PASSED" : "🔴 FAILED"}</span>
                                    </div>
                                </div>
                            ) : (
                                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Click test to run a benchmark simulation of SFace validation algorithm on the current frame.</p>
                            )}
                        </div>

                    </div>
                </div>

                {/* Auto Tune suggestions Modal */}
                {showAutoTune && (
                    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                        <div style={{ background: "#fff", borderRadius: "24px", width: "100%", maxWidth: "520px", padding: "30px", border: "1px solid #f1f5f9", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #f1f5f9", paddingBottom: "14px", marginBottom: "20px" }}>
                                <Sparkles size={20} color="#1d4ed8" />
                                <h3 style={{ fontSize: "16px", fontWeight: 900, color: "#0f172a", margin: 0 }}>Auto-Tune Assistant Recommendations</h3>
                            </div>
                            
                            <p style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5, marginBottom: "16px" }}>The assistant analyzed your current lighting, contrast thresholds, and face positioning metrics. It suggests the following calibration adjustments:</p>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                                {suggestions.length > 0 ? (
                                    suggestions.map((s) => (
                                        <div key={s.name} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "8px", fontSize: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px", alignItems: "center" }}>
                                            <span style={{ fontWeight: 800, color: "#334155", textTransform: "capitalize" }}>{s.name.replace(/_/g, " ")}</span>
                                            <span style={{ color: "#64748b", textAlign: "center" }}>Old: {s.current}</span>
                                            <span style={{ color: "#1e3a8a", fontWeight: 700, textAlign: "center" }}>New: {s.suggested}</span>
                                            <span style={{ color: s.difference > 0 ? "#16a34a" : "#dc2626", fontWeight: 700, textAlign: "right" }}>
                                                {s.difference > 0 ? `+${s.difference}` : s.difference}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#16a34a", textAlign: "center", padding: "12px 0" }}>✓ Camera is already optimally calibrated for this environment!</p>
                                )}
                            </div>

                            <div style={{ display: "flex", gap: "12px" }}>
                                <button onClick={() => setShowAutoTune(false)} style={{ flex: 1, height: "42px", borderRadius: "11px", border: "1.5px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                                    Dismiss suggestions
                                </button>
                                {suggestions.length > 0 && (
                                    <button onClick={applySuggestions} style={{ flex: 1, height: "42px", borderRadius: "11px", border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                                        Apply parameters
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

        </div>
    );
}

export default function CameraCalibration() {
    return (
        <AppLayout>
            <CameraCalibrationDashboard />
        </AppLayout>
    );
}
