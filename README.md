## Export Software Frontend

Built on top of [fe-zen-arch](git@github.com:shivamkj/fe-zen-arch.git) — the core shared architecture for B2B SaaS frontends.

### Libraries

- **React** [Docs](https://react.dev/reference/react)
- **Tailwind CSS** [Docs](https://tailwindcss.com/docs/installation)
- **React Query** [Docs](https://tanstack.com/query/latest/docs/framework/react/overview)
- **React Hook Form** [Docs](https://www.react-hook-form.com/get-started)
- **Zustand** [Docs](https://zustand.docs.pmnd.rs/)

### Setup

```bash
pnpm install   # fe-zen-arch is included as a git submodule, init it first if missing
pnpm dev       # dev server on port 5173
pnpm lint      # prettier + tsc + eslint (fe-zen-arch lint pipeline)
pnpm build     # production build
```

### Domain validation (customs rules)

All Shipping Bill domain validation lives in `src/shipping-bills/validation.ts`, away from the UI
components, in two layers:

1. **Leaf schema (`shippingBillSchema`)** — formats, ranges and code-list membership per field
   (8-digit RITC, Indian loading port, currencies, UQCs, scheme/e-Sanchit codes, date sanity...).
2. **Cross-field validator (`validateShippingBill`)** — a pure function of the form values that
   returns one error per field path. It runs at the final Save boundary; errors are set back onto
   their fields, saving is blocked, and the form shows a "Customs validation" summary that jumps
   to the tab containing each error. Draft saves (Save & Next / Previous) intentionally stay
   unvalidated so incomplete bills can be parked.

Rules covered, by area:

- **Header / route:** job date not in the future; loading port must be an Indian port code,
  destination must be a foreign port different from loading, discharge ≠ loading; valid origin
  state; net weight ≤ gross weight (both > 0); total packages a positive whole number; loose
  packets ≤ total packages; marks & numbers required unless the cargo is bulk; containerized
  cargo (C/CP) needs containers and bulk cargo (LB/DB) cannot have any; HAWB requires a MAWB
  (11-digit format); RBI waiver number and date travel as a pair; NFEI category is required
  exactly when an item uses scheme 99.
- **Invoices:** unique invoice numbers per bill; invoice date not in the future and not after the
  job date; buyer required when "buyer same as consignee" is off; third-party id and branch as a
  pair; per charge, rate (%) XOR amount, rates within 0–100; contract consistency — CIF needs
  freight + insurance, CF freight, CI insurance, and "price includes" (B/F/I/N) must match the
  charges entered; advance payment cannot carry a payment period; a typed invoice total must
  reconcile with the goods lines (small rounding tolerance).
- **Goods items:** 8-digit RITC; whole-number quantity for discrete UQCs (PCS, NOS, ...); item
  total = quantity × unit price; scheme-driven rules — drawback schemes need drawback serial /
  unit / quantity (quantity ≤ item quantity), licence-based schemes (Advance Licence, EPCG,
  DFIA, DEEC, ...) need a matching licence under Others, IGST "against payment" needs taxable
  value + IGST amount (amount ≤ taxable value); item third-party and AR4 details as pairs;
  accessories description/status as a pair.
- **Containers:** ISO 6346 format **including the check digit**, no duplicate container numbers,
  size required, seal number/date as a pair (seal date not after job date), seal device ID
  required for electronic/RFID seals, movement document type/number as a pair.
- **Packing, documents, licences:** packing ranges positive, from ≤ to, non-overlapping, and
  reconciled with total packages (as are per-item package counts); e-Sanchit document type from
  the code list, invoice/item serial references must point at real invoices/items, expiry after
  issue and not already expired at the job date, IRN required with an ICEGATE id; licence
  registration/date sanity, no duplicate licences, export quantity ≤ licence quantity,
  goods source (imported/indigenous) required with a licence quantity.
- **Party / branch masters:** exporter IEC required (10-character DGFT format), business IEC
  optional but well-formed; PAN/TAN/AEO/website formats; a business must be usable as at least
  one of consignee/buyer/notify/third-party; Indian branches need state + 6-digit PIN; exporter
  branches need a GSTIN (15-character, valid state prefix) and a 14-digit bank AD code; email,
  mobile, IFSC and account number formats.

Assumptions (kept conservative — a rule blocks only on internally inconsistent data or a
customs-mandatory detail for an option the user picked): no backend/master-data checks beyond
what the form already loads; dates are compared as ISO calendar dates; "licence-based scheme"
is derived from the scheme label in `src/data/scheme-codes.ts`; RoDTEP/RoSCTL amount fields are
not collected by the UI, so those schemes add no extra required fields.

### API-ready mock services

There is no backend, so all data flows through asynchronous, Promise-based mock services in
`src/shipping-bills/services/`. UI components never import mock data, hardcoded option arrays, or
the store — they only call services (via React Query where data is fetched for rendering):

| Service                              | Simulates                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/reference-data-service.ts` | `GET /api/reference-data/*` — form options (currencies, schemes, UQC/UOM, states, ports...), e-Sanchit document-code search, marks & numbers per exporter |
| `services/party-service.ts`          | `GET/POST /api/parties/*`, `GET /api/ports/*` — party/branch search & lookup, quick-add party/branch saves, port search                                   |
| `services/shipping-bill-service.ts`  | `/api/shipping-bills/*` — list, get by id, submit (with server-style 422 checks), draft save, ICEGATE flat-file generation/download                       |
| `services/mock-transport.ts`         | Simulated latency + HTTP-style `MockApiError` (404 for unknown records, 422 for invalid submissions, 503 for simulated failures)                          |
| `services/mock-database.ts`          | The persistence behind the services (in-memory + localStorage seed data). Only services import it.                                                        |

How the states are handled:

- **Loading:** React Query (`useFormOptions()`, parties list, bill list/detail) — the form shows
  "Loading form data..." and the dashboard shows a loading panel while requests are in flight.
- **Success:** options/parties/bills render from the resolved data; React Query caches the option
  bundle app-wide (`staleTime: Infinity`), so tabs and dialogs share one "request".
- **Empty:** async selects render "No matching results found", searches resolve to `[]`, marks &
  numbers resolve to `[]` for unknown exporters, and the form/dashboard show explicit empty-state
  messages with a create action.
- **Error:** unknown ids reject with 404 (detail page offers Retry / back to list); form and
  dashboard show an error banner/panel with a Retry button. To exercise these states, add
  `?mockFail=options,parties,bills,submit,marks` to the page URL and reload.

Swapping in a real backend means replacing the method bodies in the three service files with
`fetch` calls (`toHttpShippingBillPayload` in the shipping-bill service already produces the wire
format) — no component changes. Form submission deliberately does not use a React Query mutation
(per the project convention); `handleSave` calls `shippingBillService.submitShippingBill`
directly after domain validation passes.

### AI Usage & Approach

- **Tools used:** AI coding assistant (Arena Agent Mode) for research, implementation and review.
- **How:** the assistant audited the existing form/schema/seed data, extracted the assignment
  rules from the brief, and implemented the validation module and wiring described above.
- **Judgment:** no new dependencies (per the brief); validation kept as pure, separately
  reviewable functions instead of scattering checks across components; seed demo data was made
  customs-consistent rather than weakening rules to fit it.
- **Validation of the work:** the pure validator was exercised in Node against valid and
  invalid bills (contract/charge mismatches, drawback and licence schemes, container check
  digits, duplicate numbers, packing overlaps, serial references — all passed), plus
  `pnpm lint` and `pnpm build`.

### Notes

- `core`, `ui`, `auth`, `icons` are fe-zen-arch workspace packages, aliased via tsconfig paths & vite aliases.
- Forms are built directly with `useForm` from `core/form` + `Form` / `SubmitButton` from `core/form/components` — no generic form templates.
- Routing uses fe-zen-arch's zustand router: routes defined in `src/shared/routes.tsx`, paths in `src/shared/route-paths.ts`.
- Auth uses the fe-zen-arch auth module (routes, interceptors, login pages) out of the box.
- API base URL comes from `PUBLIC_API_URL` (`.env`).
- Don't use react-query mutation for react-hook-form submit handler.
- For HMR (hot refresh), the file must export only react component, and not any other constant or object.
- While most input elements use `...register('name')`, custom elements like select require `<Select<T> name="name" />` instead.
