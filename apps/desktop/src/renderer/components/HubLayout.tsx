import type { ReactNode } from "react";

export type HubPage = "home" | "history" | "dictionary" | "settings";

const pages: Array<{ id: HubPage; label: string }> = [
  { id: "home", label: "Home" },
  { id: "history", label: "History" },
  { id: "dictionary", label: "Dictionary" },
  { id: "settings", label: "Settings" }
];

export function HubLayout({
  activePage,
  onNavigate,
  children
}: {
  activePage: HubPage;
  onNavigate: (page: HubPage) => void;
  children: ReactNode;
}) {
  return (
    <div className="hub-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">E</div>
          <div>
            <strong>Echo</strong>
            <span>Dictation</span>
          </div>
        </div>
        <nav className="nav-tabs" aria-label="Primary">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={page.id === activePage ? "active" : ""}
              onClick={() => onNavigate(page.id)}
            >
              {page.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="content-shell">{children}</main>
    </div>
  );
}
