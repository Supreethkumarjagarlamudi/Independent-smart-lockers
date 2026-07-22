import { CheckCircle2 } from "lucide-react";
import { APP_CONFIG } from "../../config/app";


export function HomeFooter() {
    const currentTime = new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date());

    return (
        <footer
    className="
        flex
        items-center
        justify-between
        mt-2
    "
>
    <div className="flex items-center gap-2">

        <CheckCircle2
            size={18}
            className="text-green-500"
        />

        <span className="text-sm font-medium text-slate-700">
            Ready ({APP_CONFIG.APP_VERSION})
        </span>

    </div>

    <span className="text-sm text-slate-500">
        {currentTime}
    </span>
</footer>
    );
}