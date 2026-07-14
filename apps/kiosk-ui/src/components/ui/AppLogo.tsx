export function AppLogo() {
    return (
        <div className="flex flex-col items-center gap-6">
            <img
                src="/images/branding/simats-logo.png"
                alt="SIMATS Logo"
                className="h-24 w-24 object-contain"
            />

            <div className="space-y-2 text-center">
                <h1 className="text-4xl font-bold text-slate-900">
                    Smart Lockers
                </h1>

                <p className="text-slate-500">
                    Saveetha Institute of Medical and Technical Sciences
                </p>
            </div>
        </div>
    );
}