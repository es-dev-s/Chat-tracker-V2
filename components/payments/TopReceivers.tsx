import { Trophy } from "lucide-react";
import { formatAud, type TopReceiver } from "@/lib/payment-records/types";

const RANKS = ["Top 1", "Top 2", "Top 3"] as const;

/** Top 1 / 2 / 3 payment receivers (by total payment amount). Team Lead only. */
export default function TopReceivers({
  receivers,
  periodLabel,
  loading,
}: {
  receivers: TopReceiver[];
  periodLabel: string;
  loading: boolean;
}) {
  return (
    <section className="ct-pay-top" aria-label="Top Payment Receiver">
      <div className="ct-pay-top__head">
        <h3 className="ct-pay-top__title">
          <Trophy size={15} aria-hidden /> Top Payment Receiver
        </h3>
        <span className="ct-pay-top__period">{periodLabel}</span>
      </div>
      <ol className="ct-pay-top__list">
        {RANKS.map((rank, i) => {
          const r = receivers[i];
          return (
            <li key={rank} className={`ct-pay-top__item ct-pay-top__item--${i + 1}${r ? "" : " ct-pay-top__item--empty"}`}>
              <span className="ct-pay-top__rank">{rank}</span>
              {loading ? (
                <span className="ct-wa-skel" aria-hidden />
              ) : r ? (
                <>
                  <span className="ct-pay-top__name" title={r.name}>
                    {r.name}
                  </span>
                  <span className="ct-pay-top__meta">
                    {formatAud(r.total)} · {r.records.toLocaleString()} {r.records === 1 ? "record" : "records"}
                  </span>
                </>
              ) : (
                <>
                  <span className="ct-pay-top__name ct-pay-top__name--none">—</span>
                  <span className="ct-pay-top__meta">No payments yet</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
