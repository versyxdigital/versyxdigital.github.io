import { sectionMeta } from '../components/Nav';
import { Section } from '../components/Section';
import { clients } from '../content';
import { ClientGlyph } from './ClientGlyph';
import styles from './Clients.module.css';

/**
 * "Our clients": centred rows of logos, between Projects and Contact.
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
    >
      {/* Same heading as About and Projects: large, top left, second word in the gradient. */}
      <h2 id="clients-title" className={styles.title} data-reveal>
        Who <em>we’ve worked with.</em>
      </h2>
      {/* Centred rows of logos, with no boxes around them. */}
      <div className={styles.band} data-reveal>
        <ul className={styles.wall}>
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
      </div>
    </Section>
  );
}
