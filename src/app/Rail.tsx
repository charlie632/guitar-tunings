import { useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { SECTION_LABELS, SECTIONS, type Section } from "./sections";

interface Props {
  section: Section;
  link: (to: Section) => AnchorHTMLAttributes<HTMLAnchorElement>;
  summary: string;
  children: ReactNode;
}

export function Rail({ section, link, summary, children }: Props) {
  const [setupOpen, setSetupOpen] = useState(false);
  return (
    <aside className="rail" data-open={setupOpen}>
      <nav className="sections" aria-label="Sections">
        <ul>
          {SECTIONS.map((id) => (
            <li key={id}>
              <a aria-current={id === section ? "page" : undefined} {...link(id)}>{SECTION_LABELS[id]}</a>
            </li>
          ))}
        </ul>
      </nav>
      <button className="summary" aria-expanded={setupOpen} aria-controls="setup" onClick={() => setSetupOpen(!setupOpen)}>
        <span className="summary-v">{summary}</span>
        <span className="summary-k">{setupOpen ? "Done" : "Change"}</span>
      </button>
      <div id="setup" className="setup">
        {children}
      </div>
    </aside>
  );
}
