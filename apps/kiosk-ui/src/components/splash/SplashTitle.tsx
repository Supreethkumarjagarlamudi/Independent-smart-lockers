export function SplashTitle() {
    return (
        <div
            className="
                mt-10
                flex
                flex-col
                items-center
            "
        >
            <h1
                className="
                    text-center
                    text-4xl
                    sm:text-5xl
                    md:text-6xl
                    font-bold
                    tracking-tight
                    text-slate-900
                "
            >
                SMART LOCKER
            </h1>

            <p
                className="
                    mt-6
                    text-base
                    sm:text-lg
                    text-slate-500
                "
            >
                Initializing System...
            </p>
        </div>
    );
}