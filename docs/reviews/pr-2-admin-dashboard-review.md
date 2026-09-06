# Review: PR #2 — Admin frontend (dashboard, add participant, access code)

- **PR:** https://github.com/HRI-Sim-DJGCV/IT-Project/pull/2
- **Branch:** `feature/admin-dashboard` → `main` (commit `4276e9c`, author kwondennis)
- **Reviewed:** 2026-09-06
- **Checks run on the branch:** `npm ci`, `tsc -b` (clean), `oxlint` (2 pre-existing warnings, none from this PR), `vite build` (succeeds)

## Verdict

The PR builds and type-checks, and the screens follow the Screen/Button component style of the participant app. It is **not ready to merge as-is**: one stray file must be deleted, there is a real logic bug in the participant feed, added participants and conditions are not persisted anywhere (not even in the mock layer), and the modal/settings UI hard-codes things it was handed as data. Several design choices also diverge from `docs/frontend-domain-model.md` and `docs/backend-api-spec.md` and need a decision before the backend team builds against them.

Recommendation: request changes for the **Must fix** items, and pick an answer for each item under **Decisions needed** before the next iteration.

---

## Must fix (blocking)

### 1. Stray duplicate file `frontend/src/mock/data.ts.txt`
Byte-for-byte identical to `frontend/src/mock/data.ts` (213 lines). Almost certainly an editor artefact. Delete it.

### 2. Participant feed reads the *oldest* walk, not the latest
`frontend/src/api/index.ts`, `getAdminParticipantsFeed()`:

```ts
const participantWalks = walks.filter(w => w.participantId === MOCK_PARTICIPANT.id)
const latestWalk = participantWalks[0]
```

`walks` is seeded from `MOCK_WALK_HISTORY` in chronological order (w1 = 30 Aug, w2 = 2 Sep) and `saveWalk` appends, so index 0 is the **first** walk. `getWalkHistory` in the same file already sorts newest-first; the feed should do the same. Right now the dashboard shows the 30 Aug stress values, and a walk saved by the participant during a demo will never appear.

**Fix:** sort by `date` descending (or reuse the same sort as `getWalkHistory`) before taking `[0]`.

### 3. Condition picker ignores the `conditions` prop and invents condition "C"
`frontend/src/pages/admin/AdminAddParticipantModal.tsx:58` renders `['A', 'B', 'C']` even though the component receives `conditions: ConditionSetting[]` (used only for the default). `MOCK_CONDITIONS` has only A and B, `Participant.condition` is typed `'A' | 'B'`, and a condition added on the Settings screen would not show up here.

**Fix:** map over `conditions` (`cond.id` / `cond.name`). Widen `Participant.condition` to `string` if admin-defined conditions are the direction (the domain model already flags this as likely).

### 4. Added participants and conditions are lost on navigation
- `AdminAddParticipantModal` calls `onAdd`, which only updates `AdminDashboard` component state. Going to Settings and back, or refreshing, drops the participant. It never touches the mock API layer, unlike `saveWalk`, which keeps an in-memory `walks` store.
- `AdminSettings.handleAddCondition` only updates local state. **Save changes** and **Cancel** both just `navigate('/admin')`. **Edit** does nothing.

**Fix:** add `createAdminParticipant()` and `saveAdminConditions()` (or similar) to `frontend/src/api/index.ts`, backed by in-memory arrays, mirroring the spec's `POST /admin/participants` and `PUT /admin/conditions/{id}`. The whole point of the API module is that the UI never changes when the backend arrives; these screens currently bypass it. If Save/Edit are intentionally stubs for this PR, disable them or label them so a demo does not look broken.

### 5. Duplicate participant IDs are accepted
No check that the typed ID already exists. Adding `AAA001` twice produces duplicate React keys (`key={p.id}`) and two rows. Validate against the current list (and, later, let the backend assign IDs; see D1).

---

## Should fix

### 6. "Loading..." is conflated with "no participants"
`AdminDashboard.tsx:116` shows *Loading...* whenever `participants.length === 0`. An empty feed, or a rejected `Promise.all` (there is no `catch`), leaves the screen on *Loading...* forever. Track a `loading` boolean and an `error` string; render an empty state separately.

### 7. Tab bar is duplicated and its state is partly dead
- `AdminDashboard` and `AdminSettings` each hand-roll the same three-button tab bar (about 30 lines each).
- In `AdminDashboard`, `activeTab` has a `'settings'` value that can never be set (that button navigates instead), and switching to `'participants'` changes no rendered content.
- `AdminSettings` title is "Admin Dashboard"; it should say "Settings" or have a back button.

**Fix:** extract an `AdminTabs` component driven by the current route (`useLocation`) and drop the `activeTab` state. Either give the Participants tab its own content (full list, health notes, access code) or remove it until it does.

### 8. CSV export does not escape values
`AdminDashboard.tsx:40-42` joins fields with commas and passes the whole string through `encodeURI` on a `data:` URI. A comma or quote in a user-typed participant ID (or in health notes, if they are ever exported) corrupts the row, and a `#` truncates the file. Use a small `quote()` helper (wrap in double quotes, double any inner quotes) and a `Blob` with `URL.createObjectURL`. Note the spec puts export on the backend (`GET /admin/export.csv`, one row per *walk*); this client-side export should be understood as a placeholder.

### 9. Modal accessibility and reuse
- No `role="dialog"`, `aria-modal`, Escape-to-close, focus trap, or backdrop click.
- `<label>` elements are not associated with their inputs. `ui.tsx` already has `Field`, which wraps the input in the label; use it instead of re-implementing.
- Buttons show only the condition letter; consider `cond.name`.

### 10. Dead and stale code left behind
- `AdminStub` in `frontend/src/pages/Stubs.tsx` is no longer imported. Remove it.
- `AccessCodeStub` text says access codes will work "once the admin flow exists"; that is now stale.
- `api/index.ts:49-52` keeps the old admin branch commented out; delete it.
- `api/index.ts` lost its trailing newline.
- `AdminDashboard.tsx:107` does `c.voice.replace(' Voice', '')` for display; store the voice name without the suffix instead.

### 11. Weak typing on new mock data
- `MOCK_CONDITIONS` is not annotated as `ConditionSetting[]`; `MOCK_ADMIN_CREDENTIALS[].role` is `string`, not `Role`. Annotate both so a typo fails at compile time.
- `AdminParticipantItem.stressStart` / `stressEnd` are optional but always set; the dashboard renders them unguarded. Make them required or render a fallback.
- `getAdminConditions()` has no explicit return type (every other API function does).

### 12. `setup` field semantics are unclear
`setup: participantWalks.length || 1` reports 1 for a participant with zero walks. If "Setup" means walk count, name it `walkCount` and let it be 0. If it means something else (the study "setup" a participant is in), it should not be derived from walk count.

### 13. Unreachable status and client-side scoring
- Per the 2026-09-05 decision, abandoned walks are never saved, so `latestWalk.completed` is always true and `'In progress'` is unreachable. Fine to keep the type, but the derivation should not pretend otherwise.
- `stressText()` maps the single `tense` survey item to a "stress" label. The domain model says scoring rules live on the backend and the frontend only displays. As a mock this is acceptable, but it should be written as an obvious placeholder (comment plus TODO referencing `GET /admin/stats`) so it is deleted rather than copied when the API exists.

---

## Decisions needed (spec divergence)

These are not bugs; the PR makes product choices the docs do not cover. Decide, then update `docs/frontend-domain-model.md` and `docs/backend-api-spec.md` (or the PR) so they agree.

| # | PR behaviour | Spec / docs | Decision to make |
|---|---|---|---|
| D1 | Admin **types** the participant ID | `POST /admin/participants` "assigns next `AAA###` id" | Who assigns IDs? Backend-assigned avoids typos and duplicates (issue 5). |
| D2 | Conditions have `voice` and `age` | `conditions` collection has `name`, `description`, `script`; decision log says a condition changes **the meditation script** | Are voice/age new attributes of a condition (a TTS persona for the script), or a different concept? Add to the spec or remove from the UI. |
| D3 | Free-text **Health notes** ("clinical notes or contraindications") stored on the participant | No such field in `users`; participants are deliberately anonymous `AAA###` IDs | Storing clinical notes is health data and changes the ethics and data-protection posture of an anonymised trial. Confirm with the research lead before this field exists anywhere. If kept, it needs a home in the spec and access rules. |
| D4 | Access code generated client-side with `Math.random` | Backend generates, returns once, unique sparse index | Mock only, fine, but the modal should call the API layer so the swap is one file. |
| D5 | CSV is one row per **participant** | `GET /admin/export.csv` is one row per **walk** with all raw survey answers | Which shape does the researcher need? The per-walk export is what analysis needs. |
| D6 | Admin credentials `admin/admin`, `doctor/doctor` baked into the bundle | Not documented | Fine for mock, but list them in `README.md` next to the participant demo login and show a hint on the login screen like the participant one. |

---

## Nice to have

- PR description is empty. Ask for a short summary plus screenshots of the three screens.
- `README.md` and `docs/frontend-domain-model.md` (Roles section) still say admins land on a placeholder. Update both, and add the new mock functions to the "Mock function → endpoint" table.
- `useEffect` data loads have no cancellation; harmless now, but a `let cancelled = false` guard is cheap.
- Consider a `useAdminData()` hook so Dashboard and Settings share one load of conditions.

---

## Suggested change list (if we take the PR over)

1. Delete `frontend/src/mock/data.ts.txt`.
2. Sort walks newest-first in `getAdminParticipantsFeed`.
3. Add in-memory `createAdminParticipant` / `saveAdminConditions` to `api/index.ts`; wire modal and settings to them; reject duplicate IDs.
4. Drive the condition picker from `conditions`; widen `Participant.condition` to `string`.
5. Extract `AdminTabs`; remove dead `activeTab`; fix Settings title.
6. Add loading/error state to the dashboard.
7. Escape CSV fields; switch to Blob download.
8. Use `Field` in the modal; add `role="dialog"`, Escape and backdrop close.
9. Remove `AdminStub`, commented code, and the `.replace(' Voice','')` hack; annotate mock types.
10. Resolve D1 to D6 and update the two docs plus README.

---

## Resolution (2026-09-06)

All Must fix and Should fix items were applied on `feature/admin-dashboard` (uncommitted, staged). Decisions taken: D1 backend-style auto-assigned ids (mock assigns next `AAA###`); D2 voice/age kept on conditions and added to the spec; D3 health-notes field removed, logged as an open point in the API spec pending research-lead sign-off; D4 access code generated in the API layer; D5 CSV is one row per walk with raw survey answers; D6 admin demo logins documented in README and hinted on the login screen.

Verified: `tsc -b` clean, `oxlint` only the two pre-existing warnings, `vite build` succeeds, and a browser smoke test of login → dashboard → add participant → settings (add condition C, save) → participants tab → Escape closes the modal.
