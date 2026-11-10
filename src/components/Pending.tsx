import { contentConfig, type Pending as PendingValue } from '../content';
import styles from './Pending.module.css';

/**
 * A clearly marked slot for content the source material does not cover.
 * Hidden entirely when contentConfig.showPendingFields is false.
 */
export function Pending({ value, label }: { value: PendingValue; label: string }) {
  if (!contentConfig.showPendingFields) return null;
  return (
    <div className={styles.pending}>
      <span className={`mono ${styles.tag}`}>Pending · {label}</span>
      <p className={styles.note}>{value.note}</p>
    </div>
  );
}
