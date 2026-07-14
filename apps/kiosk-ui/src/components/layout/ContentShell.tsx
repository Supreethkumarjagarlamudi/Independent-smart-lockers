import type { ReactNode } from "react";

type ContentShellProps = {
    children: ReactNode;
};

export function ContentShell({
    children,
}: ContentShellProps) {
    return (
        <section
            className="
                w-full
                max-w-[900px]
                rounded-[32px]
                border
                border-slate-200/80
                bg-white/90
                backdrop-blur-xl
                shadow-[0_20px_60px_rgba(15,23,42,0.08)]
                px-6
                py-6
                sm:px-8
                sm:py-8
                md:px-12
                md:py-10
                flex
                flex-col
            "
        >
            {children}
        </section>
    );
}