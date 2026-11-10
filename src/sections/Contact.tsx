import { useState } from 'react';
import { useReveal } from '../components/useReveal';
import { sectionMeta } from '../components/Nav';
import { clients, profile } from '../content';
import { pulse, useAnchor, useConnections } from '../schematic/registry';
import { isWide } from '../system/viewport';
import styles from './Contact.module.css';

const address = (): string => `${profile.contact.email.user}@${profile.contact.email.domain}`;

export function Contact() {
  const ref = useReveal<HTMLElement>();
  const [copied, setCopied] = useState(false);
  const head = useAnchor<HTMLSpanElement>('head:contact');
  const node = useAnchor<HTMLSpanElement>('contact:node');
  const title = useAnchor<HTMLSpanElement>('contact:title');
  const terminal = useAnchor<HTMLSpanElement>('contact:terminal');
  const end = useAnchor<HTMLSpanElement>('contact:end');

  // Every trace in this section converges on the one node that matters here,
  // then leaves it down a single bus that drops into the field.
  useConnections(() => {
    const here = (s: { activeSection: string }): number => (s.activeSection === 'contact' ? 0.5 : 0);
    // The converging traces need the two-column layout; stacked, only the bus remains.
    const whenWide = (s: { activeSection: string }): number => (isWide() ? here(s) : 0);
    return [
      {
        id: 'contact:head',
        from: { kind: 'anchor', id: 'head:contact', side: 'b', gap: 5 },
        to: { kind: 'anchor', id: 'contact:node', side: 't', gap: 5 },
        route: 'vhv',
        jog: 30,
        tone: 'blue',
        level: whenWide,
        ambient: 6,
      },
      {
        id: 'contact:terminal',
        from: { kind: 'anchor', id: 'contact:terminal', side: 'b', gap: 6 },
        to: { kind: 'anchor', id: 'contact:node', side: 't', gap: 5 },
        route: 'vhv',
        jog: 24,
        tone: 'violet',
        level: whenWide,
        ambient: 7.5,
      },
      {
        id: 'contact:title',
        from: { kind: 'anchor', id: 'contact:title', side: 'r', at: 0.3, gap: 14 },
        to: { kind: 'anchor', id: 'contact:node', side: 'l', gap: 5 },
        route: 'hvh',
        bend: 0.6,
        tone: 'cyan',
        level: whenWide,
        ambient: 5,
      },
      {
        id: 'contact:bus',
        from: { kind: 'anchor', id: 'contact:node', side: 'b', gap: 5 },
        to: { kind: 'anchor', id: 'contact:end', side: 'c', gap: 0, via: true },
        route: 'vh',
        tone: 'cyan',
        level: (s) => (s.activeSection === 'contact' ? 0.62 : 0),
        ambient: 4.5,
        ripple: 0.6,
      },
    ];
  }, []);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(address());
      setCopied(true);
      pulse('contact:bus', { ripple: 1 });
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
            {sectionMeta.contact.index}
          </span>
          <span className="mono">Contact</span>
          <span className={styles.ticks} aria-hidden="true" />
          <span ref={terminal} className={`mono ${styles.terminal}`}>
            Email or call
          </span>
        </div>

        <div className={styles.body}>
          <div>
            <h2 id="contact-title" className={styles.title} data-reveal style={{ '--i': 1 } as React.CSSProperties}>
              <span ref={title}>Get in touch.</span>
            </h2>
            <p className={styles.lede} data-reveal style={{ '--i': 2 } as React.CSSProperties}>
              {profile.availability} {profile.contact.note}
            </p>
          </div>

          <div className={styles.channels} data-reveal style={{ '--i': 3 } as React.CSSProperties}>
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
                onPointerEnter={() => pulse('contact:bus', { ripple: 0.7 })}
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
              {profile.contact.links.map((link) => {
                // A telephone number dials; it does not open a page in a new tab.
                const external = /^https?:/.test(link.href);
                return (
                  <li key={link.href}>
                    <a href={link.href} {...(external ? { target: '_blank', rel: 'noreferrer noopener me' } : {})}>
                      <span className={`mono ${styles.channelLabel}`}>{link.label}</span>
                      <span className={styles.linkValue}>{link.display}</span>
                      <span className={styles.arrow} aria-hidden="true">
                        {external ? '↗' : '→'}
                      </span>
                      {external && <span className="visually-hidden"> (opens in a new tab)</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
            <span ref={end} className={styles.busEnd} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Shown only once there are real clients to name (see content/clients.ts). */}
      {clients.length > 0 && (
        <div className={styles.clients} data-reveal>
          <p className={styles.clientsLabel}>Our clients</p>
          <ul>
            {clients.map((client) => (
              <li key={client.name}>{client.logo ? <img src={client.logo} alt={client.name} loading="lazy" decoding="async" /> : client.name}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className={styles.footer}>
        <p className="mono">
          © {new Date().getFullYear()} {profile.name} · {profile.location}
        </p>
        <p className="mono">{profile.descriptor}</p>
      </footer>
    </section>
  );
}
