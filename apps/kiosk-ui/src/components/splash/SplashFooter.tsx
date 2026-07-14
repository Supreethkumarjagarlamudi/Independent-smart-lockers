import { APP_CONFIG } from "../../config/app";

export function SplashFooter() {
    return (
        <div
            className="
                text-center
                text-xs
                text-slate-400
            "
        >
            Version {APP_CONFIG.APP_VERSION}
        </div>
    );
}