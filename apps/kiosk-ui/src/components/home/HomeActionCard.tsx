import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type HomeActionCardProps = {
    icon: ReactNode;
    title: string;
    description: string;
    onClick: () => void;
};

export function HomeActionCard({
    icon,
    title,
    description,
    onClick,
}: HomeActionCardProps) {
    return (
        <button
            onClick={onClick}
            className="
                group
                w-full
                min-h-[104px]
                sm:min-h-[112px]
                md:min-h-[120px]
                rounded-3xl
                border
                border-slate-200
                bg-white
                p-5
                sm:p-6
                md:p-7
                text-left
                shadow-sm
                transition-all
                duration-300
                hover:-translate-y-1
                hover:shadow-xl
                active:scale-[0.98]
            "
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <div
                        className="
                            flex
                            h-14
                            w-14
                            sm:h-16
                            sm:w-16
                            md:h-20
                            md:w-20
                            items-center
                            justify-center
                            rounded-2xl
                            bg-blue-50
                            text-blue-600
                        "
                    >
                        {icon}
                    </div>
                    <div>

                        <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900">
                            {title}
                        </h2>
                        <p className="text-sm sm:text-base mt-1 text-slate-500">
                            {description}
                        </p>
                    </div>
                </div>

                <ChevronRight
                    className="
                        h-7
                        w-7
                        text-slate-400
                        transition-transform
                        duration-300
                        group-hover:translate-x-1
                    "
                />
            </div>
        </button>
    );
}