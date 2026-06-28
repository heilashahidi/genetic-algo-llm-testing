import type { TraitLeaderboardEntry, TraitModelExploit } from "../types";
import { useCountUp } from "../useCountUp";

/** Gene names are snake_case; render them as readable words. */
function humanize(gene: string): string {
  return gene.replace(/_/g, " ");
}

type Tier = "S" | "A" | "B" | "C";

/** Threat tier from a trait's exploit share of the current leader. */
function tierFor(exploits: number, max: number): Tier {
  const share = max > 0 ? exploits / max : 0;
  if (share >= 0.8) return "S";
  if (share >= 0.5) return "A";
  if (share >= 0.25) return "B";
  return "C";
}

/** "🥇/🥈/🥉"-style icon, with a crown for the reigning champion. */
const RANK_ICON: Record<number, string> = { 1: "👑", 2: "🥈", 3: "🥉" };

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
          <span className="lb-kill__dot" aria-hidden>
            🎯
          </span>
          {m.model}
          <b className="lb-kill__n">×{m.exploits}</b>
        </span>
      ))}
      {hidden > 0 && <span className="lb-kill lb-kill--more">+{hidden}</span>}
    </div>
  );
}

function PodiumCard({ entry, rank }: { entry: TraitLeaderboardEntry; rank: number }) {
  const count = useCountUp(entry.exploits);
  return (
    <div className={`lb-slot lb-slot--${rank}`} style={{ animationDelay: `${rank * 90}ms` }}>
      <div className="lb-pcard">
        <div className="lb-pcard__medal" aria-hidden>
          {RANK_ICON[rank]}
        </div>
        <TraitName entry={entry} />
        <div className="lb-pcard__count">
          <span className="lb-pcard__num">{Math.round(count).toLocaleString()}</span>
          <span className="lb-pcard__unit">exploits</span>
        </div>
        <ModelKills models={entry.models} limit={2} />
      </div>
      <div className="lb-pedestal">
        <span className="lb-pedestal__rank">#{rank}</span>
      </div>
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
  const pct = max > 0 ? Math.max(5, (entry.exploits / max) * 100) : 0;
  const tier = tierFor(entry.exploits, max);
  return (
    <li className="lb-row" style={{ animationDelay: `${rank * 40}ms` }}>
      <span className="lb-row__rank">{rank}</span>
      <div className="lb-row__body">
        <div className="lb-row__top">
          <TraitName entry={entry} />
          <span className={`lb-tier lb-tier--${tier}`} title={`Tier ${tier}`}>
            {tier}
          </span>
        </div>
        <div className="lb-bar">
          <span className="lb-bar__fill" style={{ width: `${pct}%` }} />
        </div>
        <ModelKills models={entry.models} />
      </div>
      <div className="lb-row__count">
        <span className="lb-row__num">{Math.round(count).toLocaleString()}</span>
        <span className="lb-row__unit">exploits</span>
      </div>
    </li>
  );
}

/**
 * Gamified trait leaderboard: a medal podium for the top three traits, a ranked
 * list below with dominance bars and threat tiers, and "defeated target" chips
 * for the models each trait has broken.
 */
export function TraitLeaderboard({
  entries,
}: {
  entries: TraitLeaderboardEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="lb-empty">
        <span className="lb-empty__icon" aria-hidden>
          🏆
        </span>
        <p className="lb-empty__title">No champions yet</p>
        <p className="muted">
          Winning traits climb the ranks here the moment a run breaks a model.
        </p>
      </div>
    );
  }

  const max = entries[0].exploits;
  const top = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="lb">
      <div className="lb-podium">
        {top.map((entry, i) => (
          <PodiumCard
            key={`${entry.gene}:${entry.allele}`}
            entry={entry}
            rank={i + 1}
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
