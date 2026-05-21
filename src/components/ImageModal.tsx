import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ImageModalCtx = {
  open: (src: string, alt?: string) => void;
};

const Ctx = createContext<ImageModalCtx | null>(null);

export function useImageModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useImageModal must be used inside <ImageModalProvider>');
  return ctx;
}

export function ImageModalProvider({ children }: { children: ReactNode }) {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState('');

  const close = useCallback(() => setSrc(null), []);
  const open = useCallback((s: string, a = '') => {
    setSrc(s);
    setAlt(a);
  }, []);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [src, close]);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {src && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close image"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-2)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
          >
            <i className="fa-solid fa-xmark" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded-md shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Ctx.Provider>
  );
}

type ZoomableImgProps = {
  src: string;
  alt: string;
  className?: string;
  full?: string;
};

export function ZoomableImg({ src, alt, className, full }: ZoomableImgProps) {
  const { open } = useImageModal();
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ cursor: 'zoom-in' }}
      onClick={() => open(full ?? src, alt)}
    />
  );
}
