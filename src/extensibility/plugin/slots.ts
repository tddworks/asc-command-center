/**
 * Plugin slot types — the OCP-clean surface for widget contributions.
 *
 * Three capability-typed slot names cover every extensible surface in the
 * host. The real per-field variation rides on a `kind` discriminator on
 * the slot's context. Adding a new editable field anywhere in the app is
 * just another `<PluginSlot slot="text.edit" ctx={{ kind, … }} />` — no
 * new slot, no catalog update, no doc churn.
 *
 * Plugin widgets consume the slot's typed `SlotContext` as props and
 * filter on `kind` to decide whether to render. A widget registered for
 * `text.edit` receives every text-edit slot's context; it opts in per
 * field by matching `kind` (e.g. AI button only renders for kinds like
 * `appInfo.name`, not `appInfo.bundleId`).
 */

import type { App } from '../../app-catalog/app/App.ts';
import type { AppInfo } from '../../app-catalog/app-info/AppInfo.ts';
import type { Version } from '../../release/version/Version.ts';
import type { Review } from '../../customer-relations/review/Review.ts';

// ── Slot names ────────────────────────────────────────────────────

export type SlotName = 'text.edit' | 'page.toolbar' | 'list.rowAction';

// ── Per-kind sub-discriminators ──────────────────────────────────

/** Every editable text field in the host that's meaningful to plugins.
 *  Additive — growing the union is a minor host change that old plugins
 *  tolerate (they just don't match the new kind in their filter). */
export type TextEditKind =
  | 'appInfo.name'
  | 'appInfo.subtitle'
  | 'appInfo.privacyPolicyUrl'
  | 'version.description'
  | 'version.whatsNew'
  | 'version.keywords'
  | 'version.promotionalText'
  | 'review.response'
  | 'iapLocalization.name'
  | 'iapLocalization.description'
  | 'subscriptionLocalization.name'
  | 'subscriptionLocalization.description'
  | 'subscriptionGroupLocalization.name'
  | 'subscriptionGroupLocalization.customAppName'
  | 'iapCreate.referenceName'
  | 'subscriptionCreate.name'
  | 'subscriptionGroupCreate.referenceName';

/** Page-level areas where plugins can contribute buttons or status. */
export type PageToolbarKind =
  | 'appInfo'
  | 'version'
  | 'review';

/** List-row trailing actions; plugins can add an extra button to each
 *  row of a known collection. */
export type ListRowKind =
  | 'appInfo.localizations'
  | 'version.localizations'
  | 'review.list';

// ── Slot context (discriminated union) ────────────────────────────

/** Common shape every slot context satisfies: a `slot` tag (literal) and
 *  a `kind` tag (union). Plugin widgets pattern-match on these. */
export type SlotContext =
  | TextEditSlotContext
  | PageToolbarSlotContext
  | ListRowSlotContext;

export interface TextEditSlotContext {
  slot: 'text.edit';
  kind: TextEditKind;
  /** Current text in the field. */
  text: string;
  /** Setter the widget calls to apply its transformation. */
  onChange: (next: string) => void;
  /** Locale tag for the field (e.g. 'en-US'). */
  locale: string;
  /** Maximum allowed length — helps plugins shape prompts / warn users. */
  maxLength?: number;
  /** Optional domain context, narrowly typed per kind group. */
  appInfo?: AppInfo;
  version?: Version;
  review?: Review;
  app?: App;
  /** Populated when the same logical field exists on sibling locales —
   *  the batch-translate button iterates this list to fan out a single
   *  enhancement across every locale. Only the primary-locale instance
   *  of a field should carry `batch`; others omit it so their slot
   *  doesn't also show the button. */
  batch?: BatchTargets;
  /** Free-form contextual hints plugins can read to shape prompts.
   *  Used for create-time slots where the slot doesn't have a backing
   *  domain entity (e.g. `iapCreate.referenceName` carries the pending
   *  IAP type via `meta.iapType`). Keys are by convention; unknown keys
   *  are ignored by older plugins.
   *
   *  Reserved key: `mode = 'panel'` signals the plugin to render a
   *  panel-style widget (prominent card) rather than the default inline
   *  button. Used by AddLanguagesSheet's "Auto Generate" / "Translate
   *  All" cards. */
  meta?: Record<string, string>;
  /** Sibling fields the host wants the widget to optionally fill in the
   *  same operation. The primary row's name slot in `AddLanguagesSheet`
   *  carries `relatedFields.description` so an "Auto Generate" widget
   *  can produce both name and description from one click. Plugins that
   *  ignore this keep working — they just operate on `text` / `onChange`
   *  alone. */
  relatedFields?: Record<string, RelatedFieldHandle>;
}

/** Handle on a sibling editable field. The widget can read its current
 *  value via `text`, write via `onChange`, and shape its prompt against
 *  the same `kind` discriminator the slot system uses. */
export interface RelatedFieldHandle {
  kind: TextEditKind;
  text: string;
  onChange(next: string): void;
  maxLength?: number;
}

/** Cross-locale targets for a single field. The source is the primary
 *  locale's text; each target is another locale's sibling field plus a
 *  setter the widget calls with the translation result. */
export interface BatchTargets {
  sourceLocale: string;
  sourceText: string;
  /** Source-side values for sibling fields, keyed by the same string the
   *  per-target `relatedFields` uses. Lets a panel-mode widget run a
   *  multi-field batch (e.g. fan name *and* description across locales)
   *  without the host having to drive the orchestration. */
  sourceRelated?: Record<string, string>;
  targets: readonly BatchTarget[];
}

export interface BatchTarget {
  locale: string;
  current: string;
  setText: (v: string) => void;
  /** Sibling field setters for this target row — typically
   *  `relatedFields.description`. Pair with `BatchTargets.sourceRelated`
   *  so the widget can fill multiple fields per target in one pass. */
  relatedFields?: Record<string, RelatedFieldHandle>;
}

export interface PageToolbarSlotContext {
  slot: 'page.toolbar';
  kind: PageToolbarKind;
  app: App | null;
  appInfo?: AppInfo;
  version?: Version;
}

export interface ListRowSlotContext {
  slot: 'list.rowAction';
  kind: ListRowKind;
  /** The row's primary entity; widgets cast per kind. */
  item: unknown;
}

// ── Context narrowing helper ──────────────────────────────────────

/** Pick the context type for a given slot — used by widget props. */
export type ContextFor<S extends SlotName> = Extract<SlotContext, { slot: S }>;
