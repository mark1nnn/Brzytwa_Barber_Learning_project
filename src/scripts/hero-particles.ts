interface Particle {
  originX: number;
  originY: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
  driftX: number;
  driftY: number;
}

export interface HeroParticleController {
  destroy: () => void;
}

const getParticleCount = (width: number): number => {
  if (width >= 1024) return 30;
  if (width >= 640) return 20;
  return 12;
};

const createParticle = (width: number, height: number): Particle => {
  const isMobile = width < 640;
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random());
  const spreadX = width * (isMobile ? 0.42 : 0.25);
  const spreadY = height * (isMobile ? 0.2 : 0.33);
  const centerX = width * (isMobile ? 0.58 : 0.72);
  const centerY = height * (isMobile ? 0.76 : 0.53);

  return {
    originX: centerX + Math.cos(angle) * spreadX * distance,
    originY: centerY + Math.sin(angle) * spreadY * distance,
    radius: 0.5 + Math.random() * 1.5,
    alpha: 0.1 + Math.random() * 0.32,
    phase: Math.random() * Math.PI * 2,
    speed: 0.00018 + Math.random() * 0.00025,
    driftX: 3 + Math.random() * 9,
    driftY: 4 + Math.random() * 12,
  };
};

export const initHeroParticles = (canvas: HTMLCanvasElement): HeroParticleController => {
  const context = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let particles: Particle[] = [];
  let frameId = 0;
  let width = 0;
  let height = 0;
  let destroyed = false;

  const resize = (): void => {
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles = Array.from({ length: getParticleCount(width) }, () =>
      createParticle(width, height),
    );
  };

  const draw = (time: number): void => {
    if (!context || destroyed || reducedMotion.matches || document.hidden) {
      frameId = 0;
      return;
    }

    context.clearRect(0, 0, width, height);

    for (const particle of particles) {
      const progress = time * particle.speed + particle.phase;
      const x = particle.originX + Math.sin(progress) * particle.driftX;
      const y = particle.originY + Math.cos(progress * 0.78) * particle.driftY;
      const opacity = particle.alpha * (0.55 + Math.sin(progress * 1.35) * 0.35);

      context.beginPath();
      context.arc(x, y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = `rgb(218 165 91 / ${Math.max(0.03, opacity)})`;
      context.fill();
    }

    frameId = window.requestAnimationFrame(draw);
  };

  const start = (): void => {
    if (!frameId && !destroyed && !reducedMotion.matches && !document.hidden) {
      frameId = window.requestAnimationFrame(draw);
    }
  };

  const stop = (): void => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
    context?.clearRect(0, 0, width, height);
  };

  const syncAnimation = (): void => {
    if (reducedMotion.matches || document.hidden) {
      stop();
    } else {
      start();
    }
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  reducedMotion.addEventListener('change', syncAnimation);
  document.addEventListener('visibilitychange', syncAnimation);
  resize();
  start();

  return {
    destroy: () => {
      destroyed = true;
      stop();
      resizeObserver.disconnect();
      reducedMotion.removeEventListener('change', syncAnimation);
      document.removeEventListener('visibilitychange', syncAnimation);
    },
  };
};
