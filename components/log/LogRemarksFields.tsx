"use client";

import { SANS } from "@/lib/design/tokens";
import { REMARK_OPTIONS } from "@/lib/records/remarks";
import { inputStyle } from "@/lib/styles/controls";
import CtSelect from "@/components/ui/CtSelect";

type Props = {
  idPrefix: string;
  category: string;
  details: string;
  onCategoryChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
};

export default function LogRemarksFields({
  idPrefix,
  category,
  details,
  onCategoryChange,
  onDetailsChange,
}: Props) {
  return (
    <section className="ct-log-outcomes" aria-labelledby={`${idPrefix}-heading`}>
      <h3 id={`${idPrefix}-heading`} className="ct-log-outcomes__title">
        Remarks
      </h3>
      <p className="ct-log-outcomes__hint">
        Choose a remark type, then add any extra detail. Both are optional.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="ct-log-outcome-field">
          <label className="ct-log-outcome-field__label" htmlFor={`${idPrefix}-type`}>
            Remark type
          </label>
          <CtSelect
            id={`${idPrefix}-type`}
            aria-label="Remark type"
            openListHighlight="none"
            searchable
            showScrollbar
            searchPlaceholder="Search remarks…"
            value={category}
            onChange={onCategoryChange}
            options={[
              { value: "", label: "— Select remark —" },
              ...REMARK_OPTIONS.map((name) => ({ value: name, label: name })),
            ]}
            placeholder="— Select remark —"
            triggerStyle={inputStyle({ cursor: "pointer", minHeight: 42 })}
          />
        </div>
        <div className="ct-log-outcome-field">
          <label className="ct-log-outcome-field__label" htmlFor={`${idPrefix}-details`}>
            Additional remarks
          </label>
          <textarea
            id={`${idPrefix}-details`}
            style={inputStyle({ minHeight: 70, resize: "vertical", fontFamily: SANS })}
            value={details}
            onChange={(e) => onDetailsChange(e.target.value)}
            placeholder="Add any extra detail about this chat"
          />
        </div>
      </div>
    </section>
  );
}
