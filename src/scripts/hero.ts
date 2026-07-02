import { gsap } from 'gsap';

import { initHeroParticles } from './hero-particles';

const setupHero = (): void => {
  const hero = document.querySelector<HTMLElement>('[data-premium-hero]');

  if (!hero || hero.dataset.heroReady === 'true') return;

  const reveal = hero.querySelector<HTMLElement>('[data-hero-reveal]');
  const floatLayer = hero.querySelector<HTMLElement>('[data-hero-float]');
  const parallaxLayer = hero.querySelector<HTMLElement>('[data-hero-parallax]');
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-hero-particles]');

  if (!reveal || !floatLayer || !parallaxLayer || !canvas) return;

  hero.dataset.heroReady = 'true';
  const particles = initHeroParticles(canvas);
  const media = gsap.matchMedia();

  media.add(
    {
      animate: '(prefers-reduced-motion: no-preference)',
      reduce: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      if (context.conditions?.reduce) {
        gsap.set(reveal, { autoAlpha: 1, clearProps: 'transform' });
        return;
      }

      const intro = gsap.fromTo(
        reveal,
        { autoAlpha: 0, scale: 0.92, y: 26 },
        {
          autoAlpha: 1,
          scale: 1,
          y: 0,
          duration: 1.45,
          ease: 'power3.out',
          clearProps: 'transform',
        },
      );
      const float = gsap.to(floatLayer, {
        y: -10,
        rotation: 0.65,
        duration: 5.2,
        delay: 1.35,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      const syncGsap = (): void => {
        const action = document.hidden ? 'pause' : 'resume';
        intro[action]();
        float[action]();
      };

      document.addEventListener('visibilitychange', syncGsap);
      return () => document.removeEventListener('visibilitychange', syncGsap);
    },
  );

  media.add(
    '(prefers-reduced-motion: no-preference) and (min-width: 64rem) and (hover: hover) and (pointer: fine)',
    () => {
      gsap.set(parallaxLayer, {
        transformPerspective: 1100,
        transformOrigin: '68% 50%',
      });

      const moveX = gsap.quickTo(parallaxLayer, 'x', { duration: 0.85, ease: 'power3.out' });
      const moveY = gsap.quickTo(parallaxLayer, 'y', { duration: 0.85, ease: 'power3.out' });
      const rotateX = gsap.quickTo(parallaxLayer, 'rotationX', {
        duration: 1,
        ease: 'power3.out',
      });
      const rotateY = gsap.quickTo(parallaxLayer, 'rotationY', {
        duration: 1,
        ease: 'power3.out',
      });

      const onPointerMove = (event: PointerEvent): void => {
        const bounds = hero.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

        moveX(x * 16);
        moveY(y * 11);
        rotateX(y * -0.7);
        rotateY(x * 0.9);
      };

      const resetParallax = (): void => {
        moveX(0);
        moveY(0);
        rotateX(0);
        rotateY(0);
      };

      hero.addEventListener('pointermove', onPointerMove);
      hero.addEventListener('pointerleave', resetParallax);

      return () => {
        hero.removeEventListener('pointermove', onPointerMove);
        hero.removeEventListener('pointerleave', resetParallax);
        gsap.set(parallaxLayer, { clearProps: 'transform' });
      };
    },
  );

  const destroy = (): void => {
    media.revert();
    particles.destroy();
    delete hero.dataset.heroReady;
    window.removeEventListener('pagehide', destroy);
    document.removeEventListener('astro:before-swap', destroy);
  };

  window.addEventListener('pagehide', destroy, { once: true });
  document.addEventListener('astro:before-swap', destroy, { once: true });
};

setupHero();
document.addEventListener('astro:page-load', setupHero);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) setupHero();
});
