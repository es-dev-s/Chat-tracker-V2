"use client";

function SkeletonBar({ w = "100%", h = 14 }: { w?: string | number; h?: number }) {
  return <span className="ct-skeleton-bar" style={{ width: w, height: h }} aria-hidden />;
}

export function DashboardSkeleton() {
  return (
    <div className="ct-dash-stack" aria-busy="true" aria-label="Loading dashboard">
      <div className="ct-kpi-board">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="ct-kpi-stat ct-kpi-stat--blue ct-skeleton-card">
            <div className="ct-kpi-stat__top">
              <span
                className="ct-kpi-stat__icon-wrap ct-skeleton-bar"
                style={{ width: 28, height: 28, borderRadius: 8 }}
              />
              <SkeletonBar w="62%" h={10} />
            </div>
            <SkeletonBar w="40%" h={22} />
            <SkeletonBar w="72%" h={10} />
          </div>
        ))}
      </div>
      <div className="ct-perf-grid">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="ct-card ct-skeleton-card" style={{ padding: "18px 20px" }}>
            <SkeletonBar w="45%" h={12} />
            <div className="ct-skeleton-table" style={{ marginTop: 14 }}>
              {Array.from({ length: 5 }).map((__, r) => (
                <div key={r} className="ct-skeleton-table__row">
                  <SkeletonBar w="22%" />
                  <SkeletonBar w="18%" />
                  <SkeletonBar w="14%" />
                  <SkeletonBar w="12%" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="ct-card ct-chart-skeleton ct-skeleton-card" style={{ padding: "20px 24px", minHeight: 220 }}>
        <SkeletonBar w="30%" h={12} />
        <SkeletonBar w="100%" h={160} />
      </div>
    </div>
  );
}

export function RecordsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <section
      className="ct-records-ledger ct-card ct-skeleton-card"
      aria-busy="true"
      aria-label="Loading records"
    >
      <div className="ct-records-ledger__head">
        <div className="ct-records-ledger__head-main">
          <SkeletonBar w={90} h={14} />
          <SkeletonBar w={72} h={22} />
        </div>
        <SkeletonBar w={180} h={11} />
      </div>
      <div className="ct-skeleton-table" style={{ padding: "12px 16px" }}>
        <div className="ct-skeleton-table__head">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBar key={i} w="100%" h={10} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="ct-skeleton-table__row ct-skeleton-table__row--wide">
            {Array.from({ length: 8 }).map((__, c) => (
              <SkeletonBar key={c} w="100%" h={12} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--ct-border-subtle)" }}>
        <SkeletonBar w="100%" h={34} />
      </div>
    </section>
  );
}

export function NotesPanelSkeleton({ singleView = false }: { singleView?: boolean }) {
  return (
    <div
      className="ct-notes-panel ct-card ct-skeleton-card ct-skeleton-stack"
      style={{ padding: "18px 20px" }}
      aria-busy="true"
      aria-label="Loading notes"
    >
      {singleView ? (
        <SkeletonBar w={160} h={14} />
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <SkeletonBar w={160} h={36} />
          <SkeletonBar w={180} h={36} />
        </div>
      )}
      {!singleView ? <SkeletonBar w="100%" h={42} /> : null}
      <div className="ct-skeleton-table">
        {Array.from({ length: 6 }).map((_, r) => (
          <div key={r} className="ct-skeleton-table__row ct-skeleton-table__row--wide">
            {Array.from({ length: 6 }).map((__, c) => (
              <SkeletonBar key={c} w="100%" h={12} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeadsRosterSkeleton() {
  return (
    <section
      className="ct-card ct-leads-roster-card ct-skeleton-card"
      aria-busy="true"
      aria-label="Loading team leads"
    >
      <div className="ct-leads-roster__head">
        <SkeletonBar w={120} h={14} />
        <SkeletonBar w={36} h={22} />
      </div>
      <div className="ct-skeleton-table" style={{ padding: "12px 16px" }}>
        <div className="ct-skeleton-table__head">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBar key={i} w="100%" h={10} />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, r) => (
          <div key={r} className="ct-skeleton-table__row ct-skeleton-table__row--wide">
            {Array.from({ length: 5 }).map((__, c) => (
              <SkeletonBar key={c} w="100%" h={12} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function LeadNoteFormSkeleton() {
  return (
    <div
      className="ct-card ct-lead-note-form-card ct-skeleton-card ct-skeleton-stack"
      aria-busy="true"
      aria-label="Loading note form"
    >
      <SkeletonBar w={220} h={14} />
      <SkeletonBar w="72%" h={11} />
      <div className="ct-lead-note-form-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBar key={i} w="100%" h={36} />
        ))}
        <SkeletonBar w={100} h={42} />
      </div>
    </div>
  );
}

export function LeadsPageSkeleton() {
  return (
    <div className="ct-skeleton-stack" aria-busy="true" aria-label="Loading leads">
      <LeadsRosterSkeleton />
      <NotesPanelSkeleton />
    </div>
  );
}

export function LeadNotesPageSkeleton() {
  return (
    <div className="ct-skeleton-stack" aria-busy="true" aria-label="Loading lead notes">
      <LeadNoteFormSkeleton />
      <NotesPanelSkeleton singleView />
    </div>
  );
}

export function AdminPanelSkeleton() {
  return (
    <div className="ct-skeleton-stack" aria-busy="true" aria-label="Loading admin">
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <SkeletonBar w={100} h={38} />
        <SkeletonBar w={130} h={38} />
        <SkeletonBar w={120} h={38} />
      </div>
      <div className="ct-card ct-skeleton-card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <SkeletonBar w={150} h={36} />
          <SkeletonBar w={170} h={36} />
        </div>
        <div className="ct-skeleton-table">
          {Array.from({ length: 5 }).map((_, r) => (
            <div key={r} className="ct-skeleton-table__row ct-skeleton-table__row--wide">
              {Array.from({ length: 5 }).map((__, c) => (
                <SkeletonBar key={c} w="100%" h={12} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FiltersBarSkeleton() {
  return (
    <div className="ct-card ct-skeleton-card" style={{ padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBar key={i} w={120} h={36} />
        ))}
        <SkeletonBar w={180} h={36} />
      </div>
    </div>
  );
}
