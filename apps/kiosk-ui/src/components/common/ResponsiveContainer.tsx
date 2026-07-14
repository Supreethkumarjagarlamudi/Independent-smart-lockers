import type { PropsWithChildren } from "react";

type ResponsiveContainerProps = PropsWithChildren;

export function ResponsiveContainer({
    children,
}: ResponsiveContainerProps) {
    return (
        <div className="w-full max-w-[500px] mx-auto">
            {children}
        </div>
    );
}