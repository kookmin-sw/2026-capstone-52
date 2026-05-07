"use client";

import Link from "next/link";

const defaultNavItems = [
  { href: "/dashboard", label: "대시보드", section: "dashboard" }
];

export default function AppShell({
  currentPath = "/dashboard",
  currentSection = "dashboard",
  title,
  subtitle,
  actions = null,
  topbarActions = null,
  showHeader = true,
  brandSubtitle = "AI Learning Workspace",
  children
}) {
  return (
    <main className="app-shell">
      <header className="app-shell-topbar">
        <div className="app-shell-brand">
          <span className="app-shell-brand-mark" />
          <div>
            <p className="app-shell-brand-name">eeum</p>
            {brandSubtitle ? <p className="app-shell-brand-subtitle">{brandSubtitle}</p> : null}
          </div>
        </div>

        <nav className="app-shell-nav" aria-label="주요 메뉴">
          {defaultNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`app-shell-nav-link ${
                (currentSection ? currentSection === item.section : currentPath === item.href)
                  ? "app-shell-nav-link-active"
                  : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {topbarActions ? <div className="app-shell-actions">{topbarActions}</div> : null}
      </header>

      {showHeader ? (
        <section className="app-shell-header">
          <div>
            {subtitle ? <p className="app-shell-eyebrow">{subtitle}</p> : null}
            <h1 className="app-shell-title">{title}</h1>
          </div>
          {actions ? <div className="app-shell-actions">{actions}</div> : null}
        </section>
      ) : null}

      <div className="app-shell-body">{children}</div>
    </main>
  );
}
