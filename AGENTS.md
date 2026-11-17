<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep transaction form state explicitly typed and narrow optional spreadsheet values before use so strict TypeScript checks remain enabled without weakening validation.
- Use conta_id for application account relationships; retain legacy payment text only for historical compatibility.
- Centralize personal accounting exclusion and projections in pure finance helpers so all personal totals share the same reimbursement rules.
- Use isPersonalTransaction for all browser personal-accounting eligibility, and its SQL equivalent for provision guards; copy responsible through every series and import to prevent ownership leakage into personal totals.
- Load additional household spreadsheet charges through a privileged, idempotent per-user SQL loader called by the canonical signup loader; preserve existing transactions and notes.
- Fetch transactions with stable id ordering and pagination; extend fixed groups through the requested horizon under a per-user database lock to prevent duplicate generation.
- Keep investment simulation in pure helpers, independent of transactions; investment routes use authenticated server functions and query loaders for owner-scoped data.
- Share CDI refresh logic in a server-only helper; the daily authenticated callback and signed-in app opening use the same validated, reference-keyed upsert.
- Keep spreadsheet loading in a privileged reusable SQL function called by signup seed and explicit reset operations; it refuses nonempty finance data to prevent accidental duplicate imports, while fixture tests compare numeric source rows with the migration.
- Keep contribution simulation and date validation in pure helpers with injectable today; authenticated contribution mutations and database ownership/date triggers protect history independently of finance transactions.
- Keep transaction summation selection local to the keyed monthly list and sum decimal values in a pure helper before rounding to cents, so filters retain selection without writing financial data.
- Keep provision payments atomic in owner-scoped SQL RPCs and synchronize status from transaction updates through database triggers, so every payment path stays consistent and recurring edits preserve IDs.
- Share exact decimal selection summation with provisioning totals, and render continuous transactions through a responsive table while retaining the original day view.
- Cycle projections call the dashboard's cycleSummaries with shared exact unrounded decimal summation; assumptions and fixed-row extension stay pure and read-only so projection visits never change finance records.
