import type { ReactNode } from "react";
import ParticlesBg from "../background/ParticlesBg";

type Props = {
    children: ReactNode;
};

export function AppLayout({ children }: Props) {
    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-50">
            {/* Particle Background */}
            <ParticlesBg />

            <main className="relative z-10 min-h-screen">
                {children}
            </main>
        </div>
    );
}