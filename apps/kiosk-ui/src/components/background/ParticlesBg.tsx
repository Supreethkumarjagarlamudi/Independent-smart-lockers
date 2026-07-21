import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";

// Define the initialization function OUTSIDE the component.
// This ensures the reference is stable and avoids the React 19 strict-mode crash:
// "ParticlesProvider init callback must be stable across the app lifecycle."
const initParticles = async (engine: Engine) => {
    await loadSlim(engine);
};

export default function ParticlesBg() {
    return (
        <ParticlesProvider init={initParticles}>
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
                              value: "#2563eb", // deeper blue-600
                          },
                          links: {
                              color: "#3b82f6",
                              distance: 140,
                              enable: true,
                              opacity: 0.35, // increased from 0.1
                              width: 1.2,
                          },
                          move: {
                              direction: "none",
                              enable: true,
                              outModes: {
                                  default: "bounce",
                              },
                              random: false,
                              speed: 0.8,
                              straight: false,
                          },
                          number: {
                              density: {
                                  enable: true,
                              },
                              value: 55, // increased from 40
                          },
                          opacity: {
                              value: 0.45, // increased from 0.15
                          },
                          shape: {
                              type: "circle",
                          },
                          size: {
                              value: { min: 2, max: 4.5 },
                          },
                      },
                      detectRetina: true,
                  }}
              />
          </ParticlesProvider>
      );
  }
