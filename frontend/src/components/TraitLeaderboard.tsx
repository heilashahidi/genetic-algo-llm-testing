import type { TraitLeaderboardEntry, TraitModelExploit } from "../types";
import { useCountUp } from "../useCountUp";

/** Gene names are snake_case; render them as readable words. */
function humanize(gene: string): string {
  return gene.replace(/_/g, " ");
}

function TraitName({ entry }: { entry: TraitLeaderboardEntry }) {
  return (
    <span className="lb-trait">
      <span className="lb-trait__gene">{humanize(entry.gene)}</span>
      {entry.allele === "true" ? (
        <span className="lb-trait__flag">on</span>
      ) : (
        <span className="lb-trait__allele">{entry.allele}</span>
      )}
    </span>
  );
}

function ModelKills({
  models,
  limit,
}: {
  models: TraitModelExploit[];
  limit?: number;
}) {
  const shown = limit ? models.slice(0, limit) : models;
  const hidden = models.length - shown.length;
  return (
    <div className="lb-kills">
      {shown.map((m) => (
        <span
          key={m.model}
          className="lb-kill"
          title={`Broke ${m.model} ${m.exploits} time(s)`}
        >
          {m.model}
          <b className="lb-kill__n">×{m.exploits}</b>
        </span>
      ))}
      {hidden > 0 && <span className="lb-kill lb-kill--more">+{hidden} more</span>}
    </div>
  );
}

/** A podium card for a top-3 trait. Rank 1 gets the accent "winner" treatment. */
function PodiumCard({
  entry,
  rank,
  max,
}: {
  entry: TraitLeaderboardEntry;
  rank: number;
  max: number;
}) {
  const count = useCountUp(entry.exploits);
  const pct = max > 0 ? Math.max(8, (entry.exploits / max) * 100) : 0;
  return (
    <div
      className={`lb-slot lb-slot--${rank}`}
      style={{ animationDelay: `${rank * 80}ms` }}
    >
      <article className="lb-pcard">
        <div className="lb-pcard__top">
          <span className="lb-pcard__rank">{String(rank).padStart(2, "0")}</span>
          {rank === 1 && <span className="lb-pcard__lead">leader</span>}
        </div>
        <TraitName entry={entry} />
        <div className="lb-pcard__count">
          <span className="lb-pcard__num">
            {Math.round(count).toLocaleString()}
          </span>
          <span className="lb-pcard__unit">exploits</span>
        </div>
        <div className="lb-bar">
          <span className="lb-bar__fill" style={{ width: `${pct}%` }} />
        </div>
        <ModelKills models={entry.models} limit={2} />
      </article>
      <div className="lb-pedestal" aria-hidden />
    </div>
  );
}

function LeaderRow({
  entry,
  rank,
  max,
}: {
  entry: TraitLeaderboardEntry;
  rank: number;
  max: number;
}) {
  const count = useCountUp(entry.exploits);
  const pct = max > 0 ? Math.max(4, (entry.exploits / max) * 100) : 0;
  return (
    <li
      className="lb-row"
      style={{ animationDelay: `${Math.min(rank, 12) * 40}ms` }}
    >
      <span className="lb-row__rank">{String(rank).padStart(2, "0")}</span>
      <div className="lb-row__body">
        <div className="lb-row__top">
          <TraitName entry={entry} />
          <ModelKills models={entry.models} limit={3} />
        </div>
        <div className="lb-bar">
          <span className="lb-bar__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="lb-row__count">
        <span className="lb-row__num">{Math.round(count).toLocaleString()}</span>
        <span className="lb-row__unit">exploits</span>
      </div>
    </li>
  );
}

/**
 * Trait leaderboard: a winner's podium for the top three traits (rank 1 lifted
 * and accented), then a hairline-divided ranked list for the rest. One accent,
 * mono labels, count-up figures — a calm, modern read on a game podium.
 */
export function TraitLeaderboard({
  entries,
}: {
  entries: TraitLeaderboardEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="lb-empty">
        <p className="lb-empty__title">No exploits yet</p>
        <p className="muted">
          Traits climb this board the moment a run breaks a model.
        </p>
      </div>
    );
  }

  const max = entries[0].exploits;
  const top = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="lb">
      <div
        className={`lb-podium${top.length === 3 ? " lb-podium--full" : ""}`}
        style={
          top.length < 3
            ? { gridTemplateColumns: `repeat(${top.length}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {top.map((entry, i) => (
          <PodiumCard
            key={`${entry.gene}:${entry.allele}`}
            entry={entry}
            rank={i + 1}
            max={max}
          />
        ))}
      </div>
      {rest.length > 0 && (
        <ol className="lb-list">
          {rest.map((entry, i) => (
            <LeaderRow
              key={`${entry.gene}:${entry.allele}`}
              entry={entry}
              rank={i + 4}
              max={max}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
