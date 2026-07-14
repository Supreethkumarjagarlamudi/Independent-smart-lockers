type SplashLogoProps = {
    size?: number;
};

export function SplashLogo({
    size = 140,
}: SplashLogoProps) {
    return (
        <img
            src="/images/branding/simats-logo.png"
            alt="SIMATS Logo"
            style={{
                width: size,
                height: size,
            }}
            className="
                object-contain
                select-none
                pointer-events-none
                animate-fade-in
            "
        />
    );
}