import type { ButtonHTMLAttributes, ReactNode } from "react";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    variant?: "primary" | "secondary";
};

export function AppButton({
    children,
    variant = "primary",
    className = "",
    ...props
}: AppButtonProps) {
    const baseStyle =
        "w-full h-14 rounded-2xl font-semibold text-base transition-all duration-200 active:scale-[0.98]";

    const variants = {
        primary:
            "bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl",
        secondary:
            "bg-white text-slate-800 border border-slate-300 hover:bg-slate-100",
    };

    return (
        <button
            className={`${baseStyle} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}