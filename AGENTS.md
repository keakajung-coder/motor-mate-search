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

- Keep the shared dialogs, sheets, and page shell width-unrestricted; responsive content grids handle their own columns so wide screens use available space without mobile overflow.
- Check backend reachability on wake and interval in a browser-only keeper, refresh near-expiry sessions, and refresh visible data when connectivity returns so idle tabs recover without reload.
- Route PDF helper calls through a shared lazy-loaded settings preview, with pure pagination geometry; this keeps orientation/page limits consistent across export entry points without server-side browser imports.
- Use the shared DateInput with a portalled Shadcn Calendar and controlled Popover for all editable dates; native hidden showPicker controls are unreliable in mobile browsers and nested dialogs.
- Store employee leave separately from appointments, one entry per staff/date; verify existing passcodes server-side for reads and admin-only writes so leave never alters job history or relies on client permissions.
- Admin deletes snapshot rows into deleted_items (service-role only) so the admin Trash tab can restore them with original ids.
- Build planner spreadsheets from a shared pure view-layout module and write styled cells through the lazy-loaded spreadsheet writer; this preserves calendar/time-slot geometry and isolates browser color sampling from data layout.
- Generate schedule and queue export date labels through the shared pure filename module; downloads and sharing reuse the same filename to prevent format drift and timezone shifts.
- Dismiss shared notifications with browser-persisted IDs and a clear-before timestamp; notifications lack user ownership, so deletion must not erase other users' alerts or server deduplication keys.
- Gate every business query and storage request through the allowlisted session-aware server gateway; public Data API grants stay revoked so client UI cannot bypass permissions.
- Shared passcodes are exchanged for encrypted HttpOnly expiring sessions; every privileged action revalidates the server role and credential version, never browser storage.
- Persist rate limits in the database and escape spreadsheet formula-leading text at export boundaries to resist automated abuse and unsafe spreadsheet execution.
- Resolve equipment checklists dynamically through the model pump type and template pump_type, with legacy machine_types fallback; shared pump-type options include stored custom entries, models, and templates so changes remain synchronized without stale equipment snapshots.
- Yearly service contracts live in service_contracts + service_contract_visits (service-role only, RLS on, no public policies) and are managed through src/lib/contracts.functions.ts with the same passcode-session pattern as staff leave; saving a contract syncs appointments and due visits generate work orders via generateDueWorkOrders on planner load, keeping contract edits and job history decoupled.
- Draw scrollbars for list boxes with the global OverlayScrollbarLayer (targets .force-scrollbar/.dropdown-scroll, hides native scrollbars there) because iOS/iPadOS ignores CSS scrollbar styling on touch screens.
- Floating list contents (Popover, Select, DropdownMenu, CommandList) spread swipeUnlockHandlers/swipeTouchStyle from src/lib/touch-swipe.ts and cmdk-list is the only scroller (sizer auto height), because Radix's react-remove-scroll document listener otherwise preventDefaults iOS touchmove in portalled lists.
- Google Maps place search/details go through src/lib/maps.functions.ts (session-checked server functions via connector gateway) and Thai address parsing lives in pure src/lib/place-address.ts; browser never calls Places directly.
- Review same-day vehicle province conflicts through the shared vehicle-zone modules; the session gateway revalidates appointment/work-order writes and derives stored approvals server-side, while the shared dialog handles approval or vehicle replacement.
- Bind customer address and Maps snapshots through the shared customer-location module and persist customer_location on work orders and appointments; navigation and vehicle-zone checks use the same snapshot so historical jobs remain independent of later customer edits.
- Bound access RPC waits with the shared request-timeout helper and keep read retries at the data gateway only, so stalled requests cannot indefinitely block access or multiply query attempts.
- Weekly summaries share a pure aggregation module and prebuilt client Excel with trusted formulas; use appointment outcomes to deduplicate linked work orders, Bangkok record dates for undated jobs, and current inventory status for machine totals. Browser-only suspense queries use the existing session gateway after AccessGate, never SSR business reads.
- Weekly report drill-down carries an explicit record source and ID to the planner; reuse its existing appointment and work-order editors rather than the create/copy dialog, so navigation cannot duplicate jobs or bypass existing save checks.
- PDF capture goes through preparePdfElement (Base64-inline images, data-pdf-caption modes, large text) and repeats the first header/table thead per page; iOS Safari drops blob URLs and taints cross-origin images during capture.
- Voice-to-text on text fields + AI polish on textareas (VoiceInputLayer); default AUTO language listens in th-TH and runs transcripts through the pure normalizeVoiceTranscript (src/lib/voice-transcript.ts), which converts Thai digit words/letter names/Thai numerals to Latin only inside code-like runs so serial numbers survive while Thai prose is never mangled; iOS uses continuous=false
- Department gate/switcher share a voice/calendar-free view. Server sessions control employee creation/editing/deletion and private employee-photos uploads; browser roles never authorize writes. Shared add/edit forms preserve record identity and existing department/history. Staff/contacts store profile fields; engineer settings preserve them. Optimistic deletes roll back; inactive seller markers suppress legacy/autofill resurrection. Events/refetch sync rosters. Logout clears sessions before role/cache cleanup.
