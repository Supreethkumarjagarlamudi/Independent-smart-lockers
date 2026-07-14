import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";

export default function ParticlesBg() {
    return (
        <ParticlesProvider init={async (engine: Engine) => {
            await loadSlim(engine);
        }}>
            <Particles
                id="tsparticles"
                className="absolute inset-0 -z-10"
                options={{
                    background: {
                        color: {
                            value: "transparent",
                        },
                    },
                    fpsLimit: 60,
                    interactivity: {
                        events: {
                            onHover: {
                                enable: true,
                                mode: "grab",
                            },
                        },
                        modes: {
                            grab: {
                                distance: 160,
                                links: {
                                    opacity: 0.2,
                                },
                            },
                        },
                    },
                    particles: {
                        color: {
                            value: "#3b82f6", // blue-500
                        },
                        links: {
                            color: "#3b82f6",
                            distance: 140,
                            enable: true,
                            opacity: 0.1,
                            width: 1,
                        },
                        move: {
                            direction: "none",
                            enable: true,
                            outModes: {
                                default: "bounce",
                            },
                            random: false,
                            speed: 0.6,
                            straight: false,
                        },
                        number: {
                            density: {
                                enable: true,
                            },
                            value: 40,
                        },
                        opacity: {
                            value: 0.15,
                        },
                        shape: {
                            type: "circle",
                        },
                        size: {
                            value: { min: 2, max: 4 },
                        },
                    },
                    detectRetina: true,
                }}
            />
        </ParticlesProvider>
    );
}
