interface SetupProgressProps {
    currentStep: number;
    totalSteps: number;
    onStepClick?: (stepIndex: number) => void;
}

const STEP_LABELS = [
    "Welcome",
    "Cluster",
    "Camera",
    "Controllers",
    "Lockers",
    "Pricing",
    "Review"
];

export function SetupProgress({
    currentStep,
    totalSteps,
    onStepClick,
}: SetupProgressProps) {
    return (
        <div className="w-full py-4">
            {/* Stepper Node Row */}
            <div className="relative flex items-center justify-between w-full">
                
                {/* Horizontal progress bar line behind circles */}
                <div 
                    className="absolute left-4 right-4 h-0.5 bg-slate-100 -z-10" 
                    style={{ top: "16px" }}
                >
                    <div 
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${(currentStep / (totalSteps - 1)) * 100}%` }}
                    />
                </div>

                {/* Steps circular nodes */}
                {Array.from({ length: totalSteps }).map((_, i) => {
                    const stepNum = i + 1;
                    const isActive = i === currentStep;
                    const isCompleted = i < currentStep;
                    
                    let bgClass = "bg-slate-100 text-slate-400 border border-slate-200";
                    if (isActive) {
                        bgClass = "bg-blue-600 text-white font-bold border-2 border-blue-600 shadow-md ring-4 ring-blue-50";
                    } else if (isCompleted) {
                        bgClass = "bg-blue-600 text-white font-bold border border-blue-600";
                    }

                    return (
                        <button 
                            key={i} 
                            onClick={() => onStepClick?.(i)}
                            className="flex flex-col items-center flex-1 relative cursor-pointer focus:outline-none hover:scale-105 active:scale-95 transition-transform"
                        >
                            {/* Circle Node */}
                            <div 
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 z-10 ${bgClass}`}
                            >
                                {stepNum}
                            </div>
                            
                            {/* Label */}
                            <span 
                                className={`text-[10px] sm:text-xs font-semibold mt-2 text-center transition-colors duration-300 ${
                                    isActive ? "text-blue-600 font-bold" : isCompleted ? "text-slate-700" : "text-slate-400"
                                }`}
                            >
                                {STEP_LABELS[i]}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}