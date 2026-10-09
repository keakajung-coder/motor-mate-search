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
