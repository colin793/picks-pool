import { leagueContext } from '../../../../lib/league';
import { playerSteps } from '../../../../lib/tour';
import { money } from '../../../../lib/stats';
import { markTour } from '../../../../lib/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'How to play' };

// The walkthrough as a page, for the person who skipped it and the
// person who wants the rules in writing. Same script as the tour.
export default async function Help({ params }) {
  const { league, sport, isCommish } = await leagueContext(params.id);
  const steps = playerSteps(league, sport, { fee: league.entry_fee_cents > 0 ? money(league.entry_fee_cents) : null });
  return (
    <>
      <div className="mb-5">
        <p className="eyebrow">{sport.name} · {league.name}</p>
        <h1 className="h1 mt-1">How to play</h1>
      </div>
      <section className="card">
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="num mt-0.5 w-6 shrink-0 text-right text-muted">{i + 1}</span>
              <span className="min-w-0"><h2 className="h2 mb-0.5">{s.title}</h2><p className="text-sm text-ink2">{s.body}</p></span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted">Every rule is enforced by the database, not the app, so nobody edits a pick after kickoff. Money never touches the app: entry fees and winnings move on Venmo between you and the commissioner.</p>
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        <form action={markTour.bind(null, 'player', true)}><button className="btn btn-ghost btn-sm">Show me around again</button></form>
        {isCommish && <form action={markTour.bind(null, 'commish', true)}><button className="btn btn-ghost btn-sm">Bring back the Admin checklist</button></form>}
      </div>
    </>
  );
}
