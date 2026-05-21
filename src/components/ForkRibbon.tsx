import { REPO_URL } from '../data/site';

export function ForkRibbon() {
  return (
    <a
      href={REPO_URL}
      className="github-fork-ribbon hidden md:block"
      data-ribbon="Fork me on GitHub"
    >
      Fork me on GitHub
    </a>
  );
}
