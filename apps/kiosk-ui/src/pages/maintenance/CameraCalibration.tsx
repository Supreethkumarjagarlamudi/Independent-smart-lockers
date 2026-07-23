import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
    ArrowLeft, Camera, Sliders, AlertTriangle, 
    Save, RotateCcw, FileText, CheckCircle2, XCircle, RefreshCw
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
    const [validationResults, setValidationResults] = useState<any>(null);
    
    // Saving/Actions state
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
        
        if (video.videoWidth === 0 || video.videoHeight === 0) return;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        // Downscale frame to 320x320 for RPi optimization (multiples of 32 for YuNet compatibility)
        canvas.width = 320;
        canvas.height = 320;
        ctx.drawImage(video, 0, 0, 320, 320);
        
        const base64Image = canvas.toDataURL("image/jpeg", 0.85);
        
        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64Image })
            });
            
            if (res.ok) {
                const data = await res.json();
                setValidationResults(data);
                if (data.face_metrics?.annotated_image) {
                    setAnnotatedFrame(`data:image/jpeg;base64,${data.face_metrics.annotated_image}`);
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

    // Save Configuration
    const handleSaveCalibration = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/save`, { method: "POST" });
            if (res.ok) {
                showFeedbackToast("Camera configuration saved successfully!");
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
                showFeedbackToast("Parameters reset to defaults.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    // Reload Saved Config
    const handleReloadConfig = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/reload`, { method: "POST" });
            if (res.ok) {
                await fetchCameraMetadata();
                showFeedbackToast("Saved configuration reloaded successfully!");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    // Generate and Download Deployment Report
    const handleDownloadReport = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            showFeedbackToast("Camera feed not ready to capture report frame.");
            return;
        }
        
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        canvas.width = 320;
        canvas.height = 320;
        ctx.drawImage(video, 0, 0, 320, 320);
        const base64Image = canvas.toDataURL("image/jpeg", 0.85);

        try {
            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/calibration/report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64Image })
            });

            if (res.ok) {
                const reportData = await res.json();
                
                // Formatted deployment report string
                const txt = `==================================================
DEPLOYMENT VALIDATION REPORT
==================================================
Timestamp: ${reportData.report_timestamp}
Status: ${reportData.deployment_status}

CAMERA INFORMATION:
------------------
Name: ${reportData.camera_information.name}
Driver: ${reportData.camera_information.driver}
Device Path: ${reportData.camera_information.device_path}
Resolution: ${reportData.camera_information.resolution}
FPS: ${reportData.camera_information.fps}
Pixel Format: ${reportData.camera_information.pixel_format}

CURRENT CAMERA PARAMETERS:
--------------------------
${Object.entries(reportData.camera_configuration).map(([k, v]) => `${k}: ${v}`).join("\n")}

VALIDATION RESULTS:
------------------
Face Detected: ${reportData.face_quality.face_detected ? "Yes" : "No"}
Face Quality Score: ${reportData.face_quality.score} / 100 (${reportData.face_quality.classification})
Scene Brightness: ${reportData.validation_results.overall_brightness}
Scene Sharpness: ${reportData.validation_results.overall_sharpness}
Measured FPS: ${reportData.validation_results.measured_fps}

CHECKLIST:
----------
${Object.entries(reportData.validation_results.checklist).map(([k, v]) => `[${v ? "X" : " "}] ${k.replace(/_/g, " ").toUpperCase()}`).join("\n")}

ACTIONABLE FEEDBACK:
--------------------
${reportData.validation_results.reasons.length > 0 ? reportData.validation_results.reasons.map((r: string) => `- ${r}`).join("\n") : "None. Camera is ready for production deployment."}
==================================================`;

                const blob = new Blob([txt], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `camera_deployment_report_${Date.now()}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                showFeedbackToast("Deployment report downloaded successfully!");
            }
        } catch (e) {
            console.error("Failed to generate deployment report", e);
            showFeedbackToast("Failed to generate report.");
        }
    };

    const showFeedbackToast = (msg: string) => {
        setActionMessage(msg);
        setTimeout(() => setActionMessage(""), 4000);
    };

    const getScoreColor = (score: number) => {
        if (score >= 85) return "#22c55e"; // Green
        if (score >= 70) return "#eab308"; // Yellow
        if (score >= 50) return "#f97316"; // Orange
        return "#ef4444"; // Red
    };

    const isCameraReady = validationResults?.camera_status === "Ready";
    const checklist = validationResults?.checklist || {};
    const faceMetrics = validationResults?.face_metrics || {};
    const envMetrics = validationResults?.env_metrics || {};

    return (
        <div style={{ padding: "24px", maxWidth: "1440px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px", fontFamily: "system-ui, sans-serif" }}>
            <style>{`
                .deployment-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.3fr);
                    gap: 24px;
                }
                .dashboard-panel {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 24px;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
                }
                .video-container {
                    position: relative;
                    width: 100%;
                    height: 480px;
                    background: #090d16;
                    border-radius: 16px;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #1e293b;
                }
                .dashboard-bottom-panel {
                    grid-column: span 2;
                }
                .face-metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 16px;
                }
                .checklist-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    background: #f8fafc;
                }
                @media (max-width: 1024px) {
                    .deployment-grid {
                        grid-template-columns: 1fr;
                    }
                    .dashboard-bottom-panel {
                        grid-column: span 1;
                    }
                    .face-metrics-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `}</style>
            
            {/* Action Feedback Notification */}
            {actionMessage && (
                <div style={{ position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 10000, background: "#0f172a", color: "#fff", padding: "14px 28px", borderRadius: "16px", fontWeight: 700, fontSize: "14px", boxShadow: "0 20px 45px rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {actionMessage}
                </div>
            )}

            {/* Header */}
            <div style={{ display: "flex", flexFlow: "row wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button onClick={onClose || (() => navigate("/admin"))} style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#fff", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#334155" }}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 style={{ fontSize: "24px", fontWeight: 850, color: "#0f172a", margin: 0 }}>Camera Validation & Deployment Check</h1>
                        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Verify kiosk hardware suitability and environment conditions for reliable face recognition.</p>
                    </div>
                </div>
                
                <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={handleReloadConfig} disabled={saving} style={{ height: "42px", padding: "0 16px", borderRadius: "11px", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                        <RefreshCw size={14} /> Reload configuration
                    </button>
                    <button onClick={handleResetDefaults} disabled={saving} style={{ height: "42px", padding: "0 16px", borderRadius: "11px", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                        <RotateCcw size={14} /> Reset Defaults
                    </button>
                    <button onClick={handleSaveCalibration} disabled={saving} style={{ height: "42px", padding: "0 20px", borderRadius: "11px", border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(37,99,235,0.2)" }}>
                        <Save size={14} /> Save Config
                    </button>
                </div>
            </div>

            {/* Layout Grid */}
            <div className="deployment-grid">
                
                {/* LEFT PANEL: Live Camera Preview */}
                <div className="dashboard-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: isCameraActive ? "#22c55e" : "#ef4444" }} />
                            <span style={{ fontWeight: 800, fontSize: "13px", color: "#475569", textTransform: "uppercase" }}>Live Camera Preview</span>
                        </div>
                        <button onClick={handleDownloadReport} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#10b981", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                            <FileText size={14} /> Generate Report
                        </button>
                    </div>

                    <div className="video-container">
                        <video ref={videoRef} style={{ display: "none" }} muted playsInline />
                        <canvas ref={canvasRef} style={{ display: "none" }} />
                        
                        {isCameraActive && annotatedFrame ? (
                            <img src={annotatedFrame} alt="Live Validation Stream" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
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
                                        <p style={{ fontSize: "13px", color: "#94a3b8" }}>Activating Camera...</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Camera Info, Camera Status, Validation Results */}
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    
                    {/* Camera Status (Header component inside Right Panel) */}
                    <div className="dashboard-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderLeft: `6px solid ${isCameraReady ? "#22c55e" : "#ef4444"}` }}>
                        <div>
                            <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Camera Status</span>
                            <div style={{ fontSize: "20px", fontWeight: 900, color: "#0f172a" }}>
                                {isCameraReady ? "🟢 Camera Ready" : "🔴 Camera Not Ready"}
                            </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "11px", color: "#94a3b8", display: "block" }}>Validation Mode</span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569", background: "#f1f5f9", padding: "2px 8px", borderRadius: "12px" }}>Installer Mode</span>
                        </div>
                    </div>

                    {/* Camera Info & Controls */}
                    <div className="dashboard-panel" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <h2 style={{ fontSize: "16px", fontWeight: 900, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                            <Sliders size={18} color="#2563eb" /> Camera Information & Controls
                        </h2>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "#f8fafc", padding: "14px", borderRadius: "12px", fontSize: "12px" }}>
                            <div><strong>Name:</strong> {deviceInfo?.name || "Generic Webcam"}</div>
                            <div><strong>Driver:</strong> {deviceInfo?.driver || "Unknown"}</div>
                            <div><strong>Device Path:</strong> {deviceInfo?.device_path || "/dev/video0"}</div>
                            <div><strong>Resolution:</strong> {deviceInfo?.resolution || "640x480"}</div>
                            <div><strong>FPS:</strong> {deviceInfo?.fps || "30 FPS"}</div>
                            <div><strong>Format:</strong> {deviceInfo?.pixel_format || "MJPG"}</div>
                        </div>

                        {loadingControls ? (
                            <p style={{ fontSize: "12px", color: "#64748b" }}>Loading controls...</p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "250px", overflowY: "auto", paddingRight: "6px" }}>
                                {controls.map((ctrl) => {
                                    const cleanName = ctrl.name.replace(/_/g, " ");
                                    return (
                                        <div key={ctrl.name} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
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
                                                    style={{ height: "36px", borderRadius: "8px", border: "1.5px solid #cbd5e1", padding: "0 10px", fontSize: "12px", background: "#f8fafc", color: "#334155" }}
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
                                                    style={{ width: "100%", height: "5px", cursor: "pointer" }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Validation Checklist & Feedback */}
                    <div className="dashboard-panel" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <h2 style={{ fontSize: "16px", fontWeight: 900, color: "#0f172a", margin: 0 }}>Deployment Check & Validation</h2>
                        
                        {/* Ready Checklist */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div className="checklist-item">
                                {checklist.face_detected ? <CheckCircle2 size={16} color="#22c55e" /> : <XCircle size={16} color="#ef4444" />}
                                <span>Face Detected</span>
                            </div>
                            <div className="checklist-item">
                                {checklist.lighting_good ? <CheckCircle2 size={16} color="#22c55e" /> : <XCircle size={16} color="#ef4444" />}
                                <span>Lighting Good</span>
                            </div>
                            <div className="checklist-item">
                                {checklist.sharpness_good ? <CheckCircle2 size={16} color="#22c55e" /> : <XCircle size={16} color="#ef4444" />}
                                <span>Sharpness Good</span>
                            </div>
                            <div className="checklist-item">
                                {checklist.exposure_acceptable ? <CheckCircle2 size={16} color="#22c55e" /> : <XCircle size={16} color="#ef4444" />}
                                <span>Exposure Acceptable</span>
                            </div>
                            <div className="checklist-item">
                                {checklist.face_size_acceptable ? <CheckCircle2 size={16} color="#22c55e" /> : <XCircle size={16} color="#ef4444" />}
                                <span>Face Size Acceptable</span>
                            </div>
                            <div className="checklist-item">
                                {checklist.pose_acceptable ? <CheckCircle2 size={16} color="#22c55e" /> : <XCircle size={16} color="#ef4444" />}
                                <span>Pose Acceptable</span>
                            </div>
                            <div className="checklist-item">
                                {checklist.fps_stable ? <CheckCircle2 size={16} color="#22c55e" /> : <XCircle size={16} color="#ef4444" />}
                                <span>Camera FPS Stable</span>
                            </div>
                            <div className="checklist-item">
                                {checklist.resolution_supported ? <CheckCircle2 size={16} color="#22c55e" /> : <XCircle size={16} color="#ef4444" />}
                                <span>Resolution Supported</span>
                            </div>
                        </div>

                        {/* Explain Why section */}
                        {validationResults?.reasons && validationResults.reasons.length > 0 && (
                            <div style={{ marginTop: "10px", padding: "16px", background: "#fff5f5", border: "1px solid #fee2e2", borderRadius: "12px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 800, color: "#dc2626", textTransform: "uppercase" }}>Issues Detected</span>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                                    {validationResults.reasons.map((reason: string, i: number) => (
                                        <div key={i} style={{ fontSize: "12px", color: "#991b1b", fontWeight: 600, display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                            <span style={{ color: "#ef4444", fontSize: "14px" }}>•</span>
                                            <span>{reason}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* BOTTOM PANEL: Face Quality Dashboard */}
                <div className="dashboard-panel dashboard-bottom-panel" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                        <h2 style={{ fontSize: "16px", fontWeight: 900, color: "#0f172a", margin: 0 }}>Face Quality Dashboard</h2>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 800, color: getScoreColor(faceMetrics.face_quality_score ?? 0), background: `${getScoreColor(faceMetrics.face_quality_score ?? 0)}15`, padding: "4px 12px", borderRadius: "20px" }}>
                                {faceMetrics.classification || "No Face"}
                            </span>
                            <span style={{ fontSize: "22px", fontWeight: 900, color: getScoreColor(faceMetrics.face_quality_score ?? 0) }}>
                                {faceMetrics.face_quality_score ?? 0} <span style={{ fontSize: "13px", color: "#94a3b8" }}>/100</span>
                            </span>
                        </div>
                    </div>

                    <div className="face-metrics-grid">
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Face Detected</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                                {faceMetrics.face_detected ? "✓ Detected" : "✗ Not Detected"}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Confidence</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                                {faceMetrics.confidence ? `${faceMetrics.confidence}%` : "0%"}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Face Size</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                                {faceMetrics.face_size ? `${faceMetrics.face_size}%` : "0%"}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Face Centered</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                                {faceMetrics.face_centered ? "✓ Centered" : "✗ Off Center"}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Distance Estimate</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                                {faceMetrics.distance_estimate ? `${faceMetrics.distance_estimate} m` : "0.00 m"}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Face Brightness</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                                {faceMetrics.face_brightness ?? 0}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Face Sharpness</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                                {faceMetrics.face_sharpness ?? 0}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Head Pose (Y, P, R)</div>
                            <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", marginTop: "4px", fontFamily: "monospace" }}>
                                {faceMetrics.pose ? `Y:${faceMetrics.pose.yaw}° P:${faceMetrics.pose.pitch}° R:${faceMetrics.pose.roll}°` : "N/A"}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Eyes Visible</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                                {faceMetrics.eyes_visible ? "✓ Yes" : "✗ No"}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Face Occluded</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#ef4444", marginTop: "4px" }}>
                                {faceMetrics.face_occluded ? "⚠ Occluded" : "✓ Clear"}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Multiple Faces</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#ef4444", marginTop: "4px" }}>
                                {faceMetrics.multiple_faces ? "⚠ Multiple" : "✓ Single"}
                            </div>
                        </div>
                        <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div style={{ color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Measured FPS</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                                {envMetrics.fps ? `${envMetrics.fps} FPS` : "0 FPS"}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
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
