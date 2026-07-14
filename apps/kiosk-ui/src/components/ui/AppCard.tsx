import type { PropsWithChildren } from "react";

type AppCardProps = PropsWithChildren;

export function AppCard({ children }: AppCardProps) {
    return (
        <div className="rounded-[36px] bg-white px-8 py-12 sm:px-10 sm:py-14 md:px-12 md:py-16 shadow-[0_25px_60px_rgba(15,23,42,0.06)] border border-slate-200/80 w-full flex flex-col">
            {children}
        </div>
    );
}