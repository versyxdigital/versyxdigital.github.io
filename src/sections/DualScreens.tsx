import { ZoomableImg } from '../components/ImageModal';

export function DualScreens() {
  return (
    <section className="relative z-10 pb-32">
      <h2 className="sr-only">Screenshots of MKEditor</h2>
      <div className="mx-auto grid max-w-[var(--container-default)] grid-cols-1 gap-4 px-6 md:grid-cols-2">
        <ZoomableImg
          src="/assets/img/demo-dark.webp"
          alt="MKEditor screenshot in dark mode"
          className="mx-auto block h-auto max-w-full rounded-md border border-[var(--color-border-2)] transition-[transform,border-color] duration-250 hover:-translate-y-0.5 hover:border-[var(--color-border-3)]"
        />
        <ZoomableImg
          src="/assets/img/demo-light.webp"
          alt="MKEditor screenshot in light mode"
          className="mx-auto block h-auto max-w-full rounded-md border border-[var(--color-border-2)] transition-[transform,border-color] duration-250 hover:-translate-y-0.5 hover:border-[var(--color-border-3)]"
        />
      </div>
    </section>
  );
}
