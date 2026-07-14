type HomeHeaderProps = {
    stationName: string;
};

export function HomeHeader({
    stationName,
}: HomeHeaderProps) {
    return (
        <header className="flex flex-col items-center">
            <img
                src="/images/branding/simats-logo.png"
                alt="SIMATS Logo"
                className="
                h-20
                w-20
                sm:h-24
                sm:w-24
                md:h-28
                md:w-28
                object-contain
                "
            />
            <h1
                className="
                mt-6
                text-center
                text-4xl
                sm:text-5xl
                font-bold
                tracking-tight
                text-slate-900
                "
            >
                Smart Locker
            </h1>
            <p
                className="
                mt-3
                text-center
                text-slate-500
                text-base
                sm:text-lg
                md:text-xl
                "
            >
                {stationName}
            </p>
        </header>
    );
}