"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  CalendarRange,
  Clock3,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import CtDateInput from "@/components/ui/CtDateInput";
import CtFilterFlyoutSelect from "@/components/ui/CtFilterFlyoutSelect";
import {
  buildFilterOptions,
  countActiveDashboardFilters,
  type DashboardFilters,
} from "@/lib/dashboard/records";
import { useAuthStore } from "@/store/auth-store";
import { useGlobalFiltersStore } from "@/store/global-filters-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useIsSearchFilterPending } from "@/hooks/useEffectiveDashboardFilters";

const REPLY_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "awaitingFirstReply", label: "Awaiting reply" },
  { value: "openNoClose", label: "Open" },
  { value: "complete", label: "Complete" },
] as const;

const filterDateInputStyle = (extra: CSSProperties = {}): CSSProperties => ({
  boxSizing: "border-box",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
  ...extra,
});

function FilterSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Search;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ct-filter-section">
      <header className="ct-filter-section__head">
        <span className="ct-filter-section__icon" aria-hidden>
          <Icon size={14} strokeWidth={2.15} />
        </span>
        <div className="ct-filter-section__copy">
          <h3 className="ct-filter-section__title">{title}</h3>
          {description ? (
            <p className="ct-filter-section__desc">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="ct-filter-section__body">{children}</div>
    </section>
  );
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ct-filter-field">
      <label className="ct-filter-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="ct-filter-field__control">{children}</div>
    </div>
  );
}

export default function GlobalFiltersPanel() {
  const user = useAuthStore((s) => s.user);
  const records = useWorkspaceStore((s) => s.records);
  const users = useWorkspaceStore((s) => s.users);
  const teams = useWorkspaceStore((s) => s.teams);
  const profiles = useWorkspaceStore((s) => s.profiles);
  const filters = useGlobalFiltersStore((s) => s.filters);
  const setFilter = useGlobalFiltersStore((s) => s.setFilter);
  const clearFilters = useGlobalFiltersStore((s) => s.clearFilters);
  const searchPending = useIsSearchFilterPending();

  const role = user?.role ?? "analyst";

  const {
    fStart,
    fEnd,
    fHour,
    fAnalyst,
    fTeam,
    fProfile,
    fReplyStatus,
    searchQuery,
  } = filters;

  const options = useMemo(() => {
    if (!user) return { analysts: [], teams: [], profiles: [] };
    return buildFilterOptions(user, records, users, teams, profiles);
  }, [user, records, users, teams, profiles]);

  const activeCount = useMemo(() => countActiveDashboardFilters(filters), [filters]);

  const replyLabel =
    fReplyStatus === "awaitingFirstReply" || fReplyStatus === "noFirstReply"
      ? "Awaiting reply"
      : fReplyStatus === "openNoClose" || fReplyStatus === "noClose"
        ? "Open"
        : fReplyStatus === "complete"
          ? "Complete"
          : "";

  const activeChips = useMemo(() => {
    const chips: { key: keyof DashboardFilters; label: string; display: string }[] = [];
    if (String(searchQuery ?? "").trim()) {
      chips.push({ key: "searchQuery", label: "Search", display: String(searchQuery).trim() });
    }
    if (fStart) chips.push({ key: "fStart", label: "From", display: fStart });
    if (fEnd) chips.push({ key: "fEnd", label: "To", display: fEnd });
    if (fHour !== "" && fHour != null) {
      chips.push({
        key: "fHour",
        label: "Hour",
        display: `${String(fHour).padStart(2, "0")}:00`,
      });
    }
    if (fAnalyst) chips.push({ key: "fAnalyst", label: "Analyst", display: fAnalyst });
    if (fTeam) chips.push({ key: "fTeam", label: "Team", display: fTeam });
    if (fProfile) chips.push({ key: "fProfile", label: "Profile", display: fProfile });
    if (replyLabel) {
      chips.push({ key: "fReplyStatus", label: "Status", display: replyLabel });
    }
    return chips;
  }, [fStart, fEnd, fHour, fAnalyst, fTeam, fProfile, replyLabel, searchQuery]);

  const hourOptions = useMemo(
    () => [
      { value: "", label: "Any hour" },
      ...Array.from({ length: 24 }, (_, h) => ({
        value: String(h),
        label: `${String(h).padStart(2, "0")}:00`,
      })),
    ],
    [],
  );

  if (!user) return null;

  return (
    <section className="ct-filter-panel" aria-label="Global workspace filters">
      <header className="ct-filter-panel__head">
        <div className="ct-filter-panel__head-main">
          <span className="ct-filter-panel__head-icon" aria-hidden>
            <SlidersHorizontal size={15} strokeWidth={2.25} />
          </span>
          <div className="ct-filter-panel__head-copy">
            <span className="ct-filter-panel__title">Filters</span>
            <span className="ct-filter-panel__subtitle">Refine all workspace views</span>
          </div>
          {activeCount > 0 ? (
            <span className="ct-filter-panel__count" aria-label={`${activeCount} active filters`}>
              {activeCount}
            </span>
          ) : null}
        </div>
        {activeCount > 0 ? (
          <button
            type="button"
            className="ct-filter-panel__head-clear"
            onClick={() => clearFilters()}
          >
            <RotateCcw size={12} strokeWidth={2.35} aria-hidden />
            Reset
          </button>
        ) : null}
      </header>

      <div className="ct-filter-panel__body">
        <div className="ct-filter-panel__search">
          <div className="ct-filter-panel__search-wrap">
            <Search size={14} strokeWidth={2.25} aria-hidden className="ct-filter-panel__search-icon" />
            <input
              id="ct-global-search"
              type="search"
              className="ct-input ct-filter-panel__search-input"
              placeholder="Search records, notes, clients…"
              value={searchQuery}
              onChange={(e) => setFilter("searchQuery", e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {searchPending ? (
            <div className="ct-filter-panel__pending" aria-live="polite">
              Updating results…
            </div>
          ) : null}
        </div>

        <div className="ct-filter-panel__stack">
          <FilterSection
            icon={CalendarRange}
            title="Date & time"
            description="Narrow by chat date or hour received"
          >
            <div className="ct-filter-date-range">
              <FilterField label="From" htmlFor="ct-global-from">
                <CtDateInput
                  id="ct-global-from"
                  compact
                  aria-label="From date"
                  value={fStart}
                  onChange={(v) => setFilter("fStart", v)}
                  inputStyleFn={filterDateInputStyle}
                />
              </FilterField>
              <span className="ct-filter-date-range__sep" aria-hidden>
                →
              </span>
              <FilterField label="To" htmlFor="ct-global-to">
                <CtDateInput
                  id="ct-global-to"
                  compact
                  aria-label="To date"
                  value={fEnd}
                  onChange={(v) => setFilter("fEnd", v)}
                  inputStyleFn={filterDateInputStyle}
                />
              </FilterField>
            </div>
            <FilterField label="Hour of day" htmlFor="ct-global-hour">
              <CtFilterFlyoutSelect
                fieldId="hour"
                title="Hour of day"
                id="ct-global-hour"
                value={String(fHour ?? "")}
                onChange={(v) => setFilter("fHour", v)}
                options={hourOptions}
                placeholder="Any hour"
                aria-label="Hour of day"
              />
            </FilterField>
          </FilterSection>

          <FilterSection
            icon={Users}
            title="Scope"
            description="Filter by people, team, or profile"
          >
            {role !== "analyst" ? (
              <FilterField label="Analyst" htmlFor="ct-global-analyst">
                <CtFilterFlyoutSelect
                  fieldId="analyst"
                  title="Analyst"
                  id="ct-global-analyst"
                  value={fAnalyst}
                  onChange={(v) => setFilter("fAnalyst", v)}
                  options={[
                    { value: "", label: "All analysts" },
                    ...options.analysts.map((a) => ({ value: a, label: a })),
                  ]}
                  placeholder="All analysts"
                  aria-label="Analyst"
                />
              </FilterField>
            ) : null}
            <FilterField label="Team" htmlFor="ct-global-team">
              <CtFilterFlyoutSelect
                fieldId="team"
                title="Team"
                id="ct-global-team"
                value={fTeam}
                onChange={(v) => setFilter("fTeam", v)}
                options={[
                  { value: "", label: "All teams" },
                  ...options.teams.map((t) => ({ value: t, label: t })),
                ]}
                placeholder="All teams"
                aria-label="Team"
              />
            </FilterField>
            <FilterField label="Profile" htmlFor="ct-global-profile">
              <CtFilterFlyoutSelect
                fieldId="profile"
                title="Profile"
                id="ct-global-profile"
                value={fProfile}
                onChange={(v) => setFilter("fProfile", v)}
                options={[
                  { value: "", label: "All profiles" },
                  ...options.profiles.map((p) => ({ value: p, label: p })),
                ]}
                placeholder="All profiles"
                aria-label="Profile"
              />
            </FilterField>
          </FilterSection>

          <FilterSection
            icon={Activity}
            title="Reply status"
            description="Chat tracking state"
          >
            <div className="ct-filter-pills" role="group" aria-label="Reply status">
              {REPLY_STATUS_OPTIONS.map((opt) => {
                const active = (fReplyStatus || "") === opt.value;
                return (
                  <button
                    key={opt.value || "all"}
                    type="button"
                    className={`ct-filter-pill${active ? " ct-filter-pill--active" : ""}`}
                    aria-pressed={active}
                    onClick={() => setFilter("fReplyStatus", opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="ct-filter-status-hint">
              <Clock3 size={12} strokeWidth={2.15} aria-hidden />
              <span>Based on first reply and analyst last reply times</span>
            </div>
          </FilterSection>
        </div>

        {activeChips.length > 0 ? (
          <div className="ct-filter-panel__active">
            <div className="ct-filter-panel__active-head">
              <span className="ct-filter-panel__active-label">Active filters</span>
              <span className="ct-filter-panel__active-count">{activeChips.length}</span>
            </div>
            <div className="ct-filter-panel__chips">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="ct-filter-panel__chip"
                  onClick={() => setFilter(chip.key, "")}
                  title={`Remove ${chip.label}`}
                >
                  <span className="ct-filter-panel__chip-key">{chip.label}</span>
                  <span className="ct-filter-panel__chip-val">{chip.display}</span>
                  <X size={11} strokeWidth={2.5} aria-hidden className="ct-filter-panel__chip-x" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="ct-filter-panel__hint">
            Filters apply to Dashboard, Records, Notes, and Leads.
          </p>
        )}
      </div>
    </section>
  );
}

export function useGlobalFiltersActiveCount(): number {
  const filters = useGlobalFiltersStore((s) => s.filters);
  return useMemo(() => countActiveDashboardFilters(filters), [filters]);
}
