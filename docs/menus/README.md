# Footer legal-links menu

`brickline-footer.liquid`'s "Legal links menu" setting has always been fully
wired in code — the render loop and schema field both exist. What was missing
is the Shopify navigation menu itself, since that can only be created in
admin or via the Admin API.

```bash
export SHOPIFY_ADMIN_TOKEN=shpat_...   # write_online_store_navigation
node docs/menus/create-footer-legal-menu.mjs legoph-gnobvfvh.myshopify.com --dry-run
node docs/menus/create-footer-legal-menu.mjs legoph-gnobvfvh.myshopify.com
```

Two of the eight links use Shopify's native shop policies
(`shop.privacyPolicy`, `shop.termsOfService` — set under **Settings >
Policies**), which are always safe if the store has those policies filled in.
The other six point at page **handles** (`cookies`,
`terms-and-conditions`, `accessibility-statement`, `privacy-policy`) — the
script checks each one exists before linking to it, and reports any it
skipped rather than creating a broken link. Create the missing page (or fix
the handle if it's named differently on this store) and re-run; it's safe to
re-run, it just reports "menu already exists" if one's already been created.

**After running:** Theme editor → Footer section → set "Legal links menu" to
"Legal". That last step is a section setting, not scriptable.
