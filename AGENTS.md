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
- Fetch transactions with stable id ordering and pagination; extend fixed groups through the requested horizon under a per-user database lock to prevent duplicate generation.
