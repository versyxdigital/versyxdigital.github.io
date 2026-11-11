import { sectionMeta } from '../components/Nav';
import { Section } from '../components/Section';
import { clients } from '../content';
import { ClientGlyph } from './ClientGlyph';
import styles from './Clients.module.css';

/**
 * "Our clients": a wall of tiles, one per client, straight after About.
 * A client with a logo file shows it in white; otherwise its name is set as a
 * text wordmark beside a mock-up symbol (see content/clients.ts).
 */
export function Clients() {
  return (
    <Section
      id="clients"
      index={sectionMeta.clients.index}
      label="Clients"
      meta={`${clients.length} clients`}
      title={
        <>
          Our <em>clients.</em>
        </>
      }
    >
      <ul className={styles.wall} data-reveal>
        {clients.map((client) => (
          <li key={client.name} className={styles.tile}>
            {client.logo ? (
              <img src={client.logo} alt={client.name} loading="lazy" decoding="async" />
            ) : (
              <>
                {client.glyph && <ClientGlyph id={client.glyph} />}
                <span data-mark={client.mark}>{client.name}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
