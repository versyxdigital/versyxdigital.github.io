import { useState } from 'react';
import { useReveal } from '../components/useReveal';
import { contentConfig, profile } from '../content';
import { field } from '../field/fieldState';
import { pulse, useAnchor, useConnections } from '../schematic/registry';
import { useSystem } from '../state/store';
import { useLiveText } from '../system/liveText';
import styles from './Contact.module.css';

const address = (): string => `${profile.contact.email.user}@${profile.contact.email.domain}`;

export function Contact() {
  const ref = useReveal<HTMLElement>();
  const [copied, setCopied] = useState(false);
  const quality = useSystem((s) => s.quality);
  const webgl = useSystem((s) => s.webgl);
  const head = useAnchor<HTMLSpanElement>('head:contact');
  const node = useAnchor<HTMLSpanElement>('contact:node');
  const left = useAnchor<HTMLSpanElement>('contact:in-a');
  const right = useAnchor<HTMLSpanElement>('contact:in-b');
  const instances = useLiveText<HTMLSpanElement>(() => field.instances.toLocaleString('en-GB'));

  // Every trace in this section converges on the one node that matters here.
  useConnections(() => {
    const here = (s: { activeSection: string }): number => (s.activeSection === 'contact' ? 0.5 : 0);
    return [
      {
        id: 'contact:a',
        from: { kind: 'anchor', id: 'contact:in-a', side: 'c', gap: 0 },
        to: { kind: 'anchor', id: 'contact:node', side: 'l', gap: 4 },
        route: 'hvh',
        bend: 0.35,
        tone: 'cyan',
        level: here,
        ambient: 5,
      },
      {
        id: 'contact:b',
        from: { kind: 'anchor', id: 'contact:in-b', side: 'c', gap: 0 },
        to: { kind: 'anchor', id: 'contact:node', side: 't', gap: 4 },
        route: 'hv',
        tone: 'violet',
        level: here,
        ambient: 7,
      },
      {
        id: 'contact:head',
        from: { kind: 'anchor', id: 'head:contact', side: 'b', gap: 5 },
        to: { kind: 'anchor', id: 'contact:node', side: 'l', gap: 4 },
        route: 'vh',
        tone: 'blue',
        level: here,
        ambient: 6,
      },
      {
        id: 'contact:field',
        from: { kind: 'anchor', id: 'contact:node', side: 'b', gap: 4 },
        to: { kind: 'via', dx: 0, dy: 64 },
        route: 'vh',
        tone: 'cyan',
        level: here,
        ambient: 4.5,
        ripple: 0.6,
      },
    ];
  }, []);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(address());
      setCopied(true);
      pulse('contact:field', { ripple: 1 });
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="contact" ref={ref} className={styles.contact} aria-labelledby="contact-title">
      <div className={styles.inner}>
        <div className={styles.rule} data-reveal>
          <span className={`mono ${styles.index}`}>
            <span ref={head} className={styles.headNode} aria-hidden="true" />
            04
          </span>
          <span className="mono">Contact</span>
          <span className={styles.ticks} aria-hidden="true" />
          <span ref={right} className={`mono ${styles.terminal}`}>
            End of line
          </span>
        </div>

        <div className={styles.body}>
          <div>
            <h2 id="contact-title" className={styles.title} data-reveal style={{ '--i': 1 } as React.CSSProperties}>
              Get in touch.
            </h2>
            <p className={styles.lede} data-reveal style={{ '--i': 2 } as React.CSSProperties}>
              {profile.availability} {profile.contact.note}
            </p>
          </div>

          <div className={styles.channels} data-reveal style={{ '--i': 3 } as React.CSSProperties}>
            <span ref={left} className={styles.inlet} aria-hidden="true" />
            <div className={styles.primary}>
              <p className={`mono ${styles.channelLabel}`}>
                <span ref={node} className={styles.node} aria-hidden="true" />
                Email
              </p>
              {/* The address is assembled at runtime so it is not sitting in the markup for harvesters. */}
              <a
                className={styles.email}
                href="#contact"
                onClick={(event) => {
                  event.preventDefault();
                  window.location.href = `mailto:${address()}`;
                }}
                onPointerEnter={() => pulse('contact:field', { ripple: 0.7 })}
              >
                <span>{profile.contact.email.user}</span>
                <span className={styles.atSign}>@</span>
                <span>{profile.contact.email.domain}</span>
              </a>
              <button type="button" className={`mono ${styles.copy}`} onClick={copy} aria-live="polite">
                {copied ? 'Copied to clipboard' : 'Copy address'}
              </button>
            </div>

            <ul className={styles.links}>
              {profile.contact.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer noopener me">
                    <span className={`mono ${styles.channelLabel}`}>{link.label}</span>
                    <span className={styles.linkValue}>{link.display}</span>
                    <span className={styles.arrow} aria-hidden="true">
                      ↗
                    </span>
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <p className="mono">
          © {new Date().getFullYear()} {profile.name} · {profile.location.label}
        </p>
        <p className="mono">
          {webgl === 'ok' ? (
            <>
              Field: <span ref={instances} /> cubes · {quality} tier
            </>
          ) : (
            'Field: static rendering'
          )}
        </p>
        <p className="mono">Content verified {contentConfig.verifiedOn}</p>
      </footer>
    </section>
  );
}
