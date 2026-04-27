# Plugin Slots — Kind Catalogue

Every place the host renders `<PluginSlot>`, the `kind` value the host
sets on the slot's context, and what extra context fields plugins can
read on that kind.

This file is the **plugin-author reference**. Adding a slot mount in the
host is a one-line code change *plus* one entry here, kept in lock-step
so plugin authors can plan against a stable surface without reading
host source. The widget-registration contract itself lives in
[`README.md`](./README.md); slot context types are in
[`src/extensibility/plugin/slots.ts`](../../src/extensibility/plugin/slots.ts).

---

## How to read this catalogue

For each kind we list:

- **Mounted at** — where in the host UI the slot lives, and the file +
  line that anchors it.
- **Context populated** — which `TextEditSlotContext` fields the host
  actually fills (every slot has `slot`, `kind`, `text`, `onChange`,
  `locale`; this column lists the *additional* fields).
- **`meta` keys** — conventional string keys on `ctx.meta`, when the
  host supplies any.
- **Batch fan-out** — whether the mount carries `batch` (cross-locale
  targets), and on which row.

A widget rendered at a kind it doesn't recognise should `return null`
fast — the same widget instance is shown at every `text.edit` mount.

---

## `text.edit` — editable text fields

The single slot every AI / writing-assist plugin targets. Plugins filter
on `kind` to opt in per field.

### App Info

#### `appInfo.name`

- **Mounted at:** `AppInfoPage` — primary-locale name input *and* every
  per-locale row in the localizations table.
  - `src/app-catalog/app-info/pages/AppInfoPage.tsx:188-200`,
    `:394-410`
- **Context populated:** `appInfo: AppInfo`, `maxLength: 30`.
- **`meta` keys:** none.
- **Batch fan-out:** primary-locale instance carries `batch` whose
  targets are every other locale's name field; sibling rows omit
  `batch`. Used by "Translate to all locales".

#### `appInfo.subtitle`

- **Mounted at:** `AppInfoPage` — primary-locale subtitle and every
  per-locale row.
  - `src/app-catalog/app-info/pages/AppInfoPage.tsx:217-229`,
    `:422-438`
- **Context populated:** `appInfo: AppInfo`, `maxLength: 30`.
- **`meta` keys:** none.
- **Batch fan-out:** same pattern as `appInfo.name`.

#### `appInfo.privacyPolicyUrl`

- **Mounted at:** `AppInfoPage` — privacy URL input.
  - `src/app-catalog/app-info/pages/AppInfoPage.tsx:473-485`
- **Context populated:** `appInfo: AppInfo`.
- **`meta` keys:** none.
- **Batch fan-out:** none — URLs aren't localized.

### Version

All four version-store fields go through one shared mount helper
(`VersionFieldHeader`) so plugins see consistent context across them.

#### `version.description`

- **Mounted at:** `VersionList` Story & Description card.
  - `src/release/version/pages/VersionList.tsx:312`
- **Context populated:** `version: Version`, `maxLength` from the
  field's char limit.
- **`meta` keys:** none.
- **Batch fan-out:** primary-locale instance carries `batch` covering
  every sibling locale's description.

#### `version.whatsNew`

- **Mounted at:** `VersionList` — What's New textarea.
  - `src/release/version/pages/VersionList.tsx:339`
- **Context populated:** `version: Version`, `maxLength`.
- **`meta` keys:** none.
- **Batch fan-out:** same pattern as `version.description`.

#### `version.keywords`

- **Mounted at:** `VersionList` — Keywords (comma-separated, 100 char
  cap).
  - `src/release/version/pages/VersionList.tsx:366`
- **Context populated:** `version: Version`, `maxLength: 100`.
- **`meta` keys:** none.
- **Batch fan-out:** primary-locale instance carries `batch`.

#### `version.promotionalText`

- **Mounted at:** `VersionList` — Promotional Text (170 char cap).
  - `src/release/version/pages/VersionList.tsx:391`
- **Context populated:** `version: Version`, `maxLength: 170`.
- **`meta` keys:** none.
- **Batch fan-out:** primary-locale instance carries `batch`.

### Customer Relations

#### `review.response`

- **Mounted at:** *declared but not yet mounted* — the kind is reserved
  for the upcoming review-response composer; widgets that opt into it
  today simply won't render until the host adds the mount.
- **Context populated:** will include `review: Review`.
- **`meta` keys:** none planned.
- **Batch fan-out:** N/A (review responses are single-locale).

### Monetization — Localizations table

The IAP and Subscription localizations tabs share `LocalizationsTab`,
which mounts two slots per row (name + description). The slice's
wrapper passes `slotKinds` so the same component yields different kinds
depending on whether it renders inside an IAP or a subscription.

#### `iapLocalization.name`

- **Mounted at:** `LocalizationsTab` (used by `IAPLocalizationsTab`) —
  next to each row's display-name input. Also rendered inside
  `AddLanguagesSheet` when adding new locales.
  - `src/monetization/components/LocalizationsTab.tsx:101-112`
  - `src/monetization/components/AddLanguagesSheet.tsx:325-345`
- **Context populated:** `maxLength` from the IAP name limit (30).
- **`meta` keys:** none.
- **Batch fan-out:** primary-locale row carries `batch` covering every
  other locale's name; non-source rows omit it. Inside
  `AddLanguagesSheet` each pending row carries a one-target `batch`
  back to itself, so "Translate" fans the saved source onto that
  locale.

#### `iapLocalization.description`

- **Mounted at:** same files as `iapLocalization.name`, on the
  description input.
  - `src/monetization/components/LocalizationsTab.tsx:135-146`
  - `src/monetization/components/AddLanguagesSheet.tsx:361-381`
- **Context populated:** `maxLength` from the IAP description limit
  (45).
- **`meta` keys:** none.
- **Batch fan-out:** same pattern as `iapLocalization.name`.

#### `subscriptionLocalization.name`

- **Mounted at:** `LocalizationsTab` (used by
  `SubscriptionLocalizationsTab`).
- **Context populated:** `maxLength: 30`.
- **`meta` keys:** none.
- **Batch fan-out:** same pattern as `iapLocalization.name`.

#### `subscriptionLocalization.description`

- **Mounted at:** same as above, on the description input.
- **Context populated:** `maxLength: 45`.
- **`meta` keys:** none.
- **Batch fan-out:** same pattern.

### Monetization — Create modals

These slots live next to the *primary name field* of the IAP /
subscription / subscription-group create sheets. They're the entry
points for "Suggest IAP Name" / "Suggest Name" / "Suggest Group Name"
enhancements. The host carries surrounding context via `meta`.

#### `iapCreate.referenceName`

- **Mounted at:** `CreateIAPModal` — reference-name input header.
  - `src/monetization/iap/components/CreateIAPModal.tsx:140-152`
- **Context populated:** `app: App`, `locale: 'en-US'`.
- **`meta` keys:**
  - `iapType: 'CONSUMABLE' | 'NON_CONSUMABLE' | 'NON_RENEWING_SUBSCRIPTION'`
- **Batch fan-out:** none.
- **Note:** the host's `useEffect` watches `referenceName` and
  auto-derives the product ID via
  `InAppPurchase.suggestedProductId(app.bundleId, name)`. A widget that
  calls `ctx.onChange(suggested)` therefore fills both fields without
  having to know about the product ID at all.

#### `subscriptionCreate.name`

- **Mounted at:** `CreateSubscriptionModal` — display-name input
  header.
  - `src/monetization/subscription/components/CreateSubscriptionModal.tsx:109-122`
- **Context populated:** `app: App`, `locale: 'en-US'`.
- **`meta` keys:**
  - `groupName: string` — the parent group's reference name.
  - `period: 'ONE_WEEK' | 'ONE_MONTH' | … | 'ONE_YEAR'` — pending
    billing period.
- **Batch fan-out:** none.
- **Note:** product ID auto-derives the same way as IAP create.

#### `subscriptionGroupCreate.referenceName`

- **Mounted at:** `CreateSubscriptionGroupModal` — reference-name input
  header.
  - `src/monetization/subscription/components/CreateSubscriptionGroupModal.tsx:82-93`
- **Context populated:** `app: App`, `locale: 'en-US'`.
- **`meta` keys:** none.
- **Batch fan-out:** none.
- **Note:** subscription groups have no product ID, so widgets need
  only fill `referenceName`.

---

## `page.toolbar` — toolbar contributions

A page-level slot for status indicators, alternative actions, or a
plugin's "open this page in my dashboard" link.

| Kind | Status |
|---|---|
| `appInfo` | Declared, not yet mounted. |
| `version` | Declared, not yet mounted. |
| `review` | Declared, not yet mounted. |

Context shape: `{ slot: 'page.toolbar', kind, app: App | null, appInfo?,
version? }`. When the host wires a mount, this section will list the
toolbar location, populated context, and any `meta` keys.

---

## `list.rowAction` — list-row trailing actions

A row-level slot for adding a button or icon to each row of a known
collection.

| Kind | Status |
|---|---|
| `appInfo.localizations` | Declared, not yet mounted. |
| `version.localizations` | Declared, not yet mounted. |
| `review.list` | Declared, not yet mounted. |

Context shape: `{ slot: 'list.rowAction', kind, item: unknown }`. The
host will narrow `item` per kind in the same way `text.edit` populates
`appInfo`/`version`/`app`/`review` today; widgets cast based on `kind`.

---

## Adding a new kind

1. Add the literal to the appropriate union in
   [`src/extensibility/plugin/slots.ts`](../../src/extensibility/plugin/slots.ts).
2. Mirror the addition in
   [`asc-pro/plugin/sdk/pluginApiTypes.ts`](../../../asc-pro/plugin/sdk/pluginApiTypes.ts)
   so the plugin SDK keeps compiling. (See "Open items" in
   [`README.md`](./README.md) — collapsing this duplication is on the
   roadmap.)
3. Mount `<PluginSlot slot="text.edit" ctx={{ slot: 'text.edit',
   kind: '<new>', text, onChange, locale, … }} />` next to the field.
4. Add an entry here describing the mount point, populated context, and
   any conventional `meta` keys.

Adding a kind is **additive** — old plugins keep working (they don't
recognise the new `kind` and skip render); new plugins opt in by adding
the literal to their `kindsHandled` filter or `Enhancement.kinds` list.
