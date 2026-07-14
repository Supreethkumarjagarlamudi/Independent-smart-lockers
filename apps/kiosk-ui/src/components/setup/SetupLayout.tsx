import type { ReactNode } from "react";

import { AppLayout } from "../layout/AppLayout";
import { ResponsiveContainer } from "../common/ResponsiveContainer";

type SetupLayoutProps = {
    children: ReactNode;
};

export function SetupLayout({
    children,
}: SetupLayoutProps) {
    return (
        <AppLayout>
            <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8">
                <ResponsiveContainer>

                    <div 
                        className="rounded-[36px] bg-white shadow-[0_25px_60px_rgba(15,23,42,0.06)] border border-slate-200/80 w-full flex flex-col"
                        style={{ padding: "60px 44px" }}
                    >
                        <div className="space-y-8">
                            {children}
                        </div>
                    </div>

                </ResponsiveContainer>
            </div>
        </AppLayout>
    );
}