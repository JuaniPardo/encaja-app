# TASK-2026-04-002 — Payment Methods cleanup, structural refactor, and UX quick actions

**Type:** FEAT / REFACTOR  
**Priority:** High  
**Modules:** Payment Methods / Transactions / Transfers / Shared UI

---

## Objective

This task groups together a set of necessary refactors and UX improvements that already have clear product value:

- **Domain and business rules**
  - rename `PaymentMethod.currentBalance` to `PaymentMethod.startingBalance`
  - allow deletion of payment methods only when they have no associated movements
- **Structural cleanup**
  - refactor oversized components
- **User-facing UX improvements**
  - add a floating quick-action button for the most common user actions:
    - transaction
    - transfer
  - simplify empty state CTA and introduce demo workspace creation

---

## Problem Statement

The field `PaymentMethod.currentBalance` currently communicates the wrong meaning. The value stored there is not a live balance; it is the initial balance used as the starting point for later balance calculation. Keeping that name creates domain confusion and increases the chance of mistakes in future development.

Also, payment methods created for smoke tests or old setup flows cannot currently be removed, even when they have no associated transactions. This leaves dead configuration in real accounts and forces the user to keep disabled records that should be fully removable.

These issues are related from a planning perspective, but they belong to different implementation layers: domain/business rules, internal structural cleanup, and user-facing UX. The task should therefore be treated as a single umbrella initiative, while execution and review should remain separated by responsibility.

In parallel, some UI components have grown too large and now mix rendering, orchestration, conditional flows, and business logic in ways that are harder to maintain.

Finally, after the initial setup, the most frequent user interaction in Encaja is registering a movement. That action should be faster to reach.

---

## Scope

### In scope

- **Domain and business rules**
  - rename `currentBalance` to `startingBalance`
  - update related types, forms, mappings, UI copy, and calculation paths where needed
  - allow deletion of payment methods with no associated movements
  - block deletion of payment methods with history
- **Structural cleanup**
  - identify and refactor oversized components
- **User-facing UX**
  - add bottom-right floating action button with quick actions for:
    - transaction
    - transfer
  - simplify empty state CTAs and add demo workspace creation action (when allowed by business rules)

### Out of scope

- full redesign of the payment methods area
- changes to balance calculation rules beyond the naming cleanup
- deletion of payment methods with historical usage
- major redesign of transaction and transfer flows
- broad refactor of unrelated screens or modules

---

## Functional Changes

The functional work in this task is intentionally grouped by responsibility. This keeps implementation and review aligned with the actual nature of the change instead of grouping items only by size.

### 1. Rename `currentBalance` to `startingBalance`

#### Goal

Align the model with the real domain meaning of the field.

#### Expected result

- `currentBalance` stops existing as an active domain field for `PaymentMethod`
- `startingBalance` becomes the official field name
- current/live balance continues to be derived from:
  - starting balance
  - plus/minus the accumulated effect of movements

#### Likely impact areas

- domain types
- form schemas
- payment method create/edit forms
- repository/service mapping code
- list/detail views
- calculations/selectors/helpers
- seed/demo data
- smoke-test fixtures
- labels or helper texts that currently imply “current” when they actually mean “initial”

#### Notes

This should not be treated as a superficial rename only. The implementation should confirm that the persisted value is truly the starting point and not being reused incorrectly as a mutable live balance.

---

### 2. Allow deletion of payment methods with no associated movements

#### Rule

A payment method can be deleted only if it has no associated historical movements.

#### Expected behavior

- payment method without associated movements → can be deleted
- payment method with associated movements → cannot be deleted
- disabled payment method without usage → can still be deleted

#### UX expectations

- clear delete affordance when deletion is allowed
- blocked delete state or explicit message when deletion is not allowed
- success feedback after deletion
- explanatory feedback when the method has movement history

#### Integrity rule

If any movement references the payment method, it must remain protected from deletion.

This includes reviewing whether the rule should consider:
- transactions
- transfers
- balance adjustments represented as movements

Preferred implementation rule: **if the payment method participates in any historical movement, it cannot be deleted.**

---

### 3. Refactor oversized components

#### Goal

Reduce complexity, improve readability, and separate responsibilities without changing behavior.

#### Detection criteria

Prioritize components that show one or more of the following:

- excessive file size
- too many responsibilities in one place
- heavy conditional rendering
- mixed business logic + UI logic + orchestration
- difficult-to-follow JSX structure
- repeated view fragments suitable for extraction

#### Expected refactor direction

- extract presentational subcomponents
- move reusable logic to hooks/helpers/selectors
- reduce local complexity
- preserve current behavior unless a small safe improvement is needed to support the extraction

#### Deliverable

A concrete list of refactored components should be visible in the PR(s), with behavior preserved and structure improved.

---

### 4. Floating action button for quick creation

#### Description

Add a circular floating action button in the bottom-right corner with a `+` icon.

#### Interaction

- default state: only the main `+` button is visible
- on click/tap: expand two quick actions
  - `Transaction`
  - `Transfer`

#### Goal

Speed up access to the most frequent actions after onboarding.

#### Expected behavior

- visible only in operational contexts where it makes sense
- does not block important controls
- mobile-friendly behavior
- simple and clear expansion pattern
- each quick action routes to or opens the correct flow

#### MVP note

Keep the scope intentionally narrow:
- only two quick actions
- no large action sheet
- no multi-step creation from the FAB itself

---

### 5. Empty state CTA simplification and demo workspace

#### Description

The current empty state shows two CTAs:
- `Crear mi primera cuenta`
- `Ver guía`

Both actions currently lead to the same destination (`Empezar`), which creates redundancy and weakens the decision clarity for the user.

#### Goal

- reduce friction in the empty state
- provide a meaningful shortcut to explore the product
- introduce a fast way to experience the app via a demo workspace

#### New behavior

- replace current CTAs with:
  - `Ver guía` → navigates to onboarding/guide (`Empezar`)
  - `Crear workspace demo` → creates a demo workspace (only if allowed)

#### Business rule

- only one demo workspace can exist per account
- if a demo workspace already exists:
  - hide or disable the CTA
  - optionally guide the user to that workspace

#### UX expectations

- clear differentiation between learning (guide) and action (demo)
- immediate feedback when demo workspace is created
- CTA should not be shown if creation is not allowed (or should explain why)

#### Notes

This should align with existing demo seeding logic (transactions, payment methods, etc.) defined in previous tasks.

---

## Technical Considerations

### Rename risk

This rename may affect more than expected. Review carefully:

- TypeScript types
- DTOs/contracts
- DB or persistence mapping
- selectors and calculations
- demo seeding
- tests
- helper texts
- assumptions in code that currently treat the field as “current”

### Safe delete rule

The delete check should be explicit and reliable. Avoid UI-only protection.

Recommended approach:
- expose or reuse a derived “has history” condition
- prevent deletion at the domain/application layer
- reflect that state in the UI

### FAB placement

The floating action button should be shown only on screens where creation shortcuts are useful. Avoid making it global if it causes visual noise or overlaps context-specific controls.

---

## Suggested Implementation Breakdown

### Responsibility group 1 — Domain and business rules

### Part A — Domain cleanup: `currentBalance` → `startingBalance`

- audit all current usages of `currentBalance`
- rename field to `startingBalance`
- update UI copy where needed
- confirm live balance calculation still works correctly

### Part B — Safe deletion for payment methods

- define what counts as associated movement history
- implement delete eligibility rule
- add delete action for eligible payment methods
- block deletion for payment methods with history
- add clear success/error feedback

### Responsibility group 2 — Structural cleanup

### Part C — Oversized component refactor

- identify large component candidates
- prioritize highest-impact ones
- extract subcomponents/hooks/helpers
- preserve behavior

### Responsibility group 3 — User-facing UX improvements

### Part D — Floating quick action button

- create reusable FAB component or pattern
- implement expand/collapse behavior
- add `Transaction` and `Transfer` actions
- connect each action to the correct destination
- validate responsive/mobile behavior

### Part E — Empty state CTA and demo workspace

- remove duplicated CTA behavior
- keep `Ver guía` pointing to onboarding
- add `Crear workspace demo` CTA
- connect CTA with demo workspace creation logic
- enforce single-demo-per-account rule
- provide user feedback on creation

---

## Definition of Done

- **Domain and business rules**
  - payment methods no longer use the misleading `currentBalance` naming
  - empty/unused payment methods can be deleted safely
  - payment methods with movement history remain protected
- **Structural cleanup**
  - key oversized components have been split into cleaner structures
- **User-facing UX**
  - the quick-action FAB is available and functional for transaction and transfer creation
  - empty state CTAs are simplified and demo workspace creation is integrated

---

## Recommended PR split

This task should remain a single umbrella task, but implementation should be split by responsibility rather than by perceived size.

### PR 1 — Domain and business rules

**Includes:**
- `currentBalance` → `startingBalance`
- delete eligibility rule
- delete action for payment methods without history
- blocked delete state for methods with history

**Why first:**
This is the most domain-sensitive portion of the task. It affects naming, business meaning, and data protection rules, so it should be reviewed in isolation.

---

### PR 2 — Structural cleanup

**Includes:**
- refactor of oversized components
- subcomponent extraction
- hook/helper extraction
- no intentional functional changes

**Why second:**
This keeps internal code cleanup separate from both domain changes and visible product behavior, which makes regressions easier to detect.

---

### PR 3 — User-facing UX improvements

**Includes:**
- FAB UI
- expand/collapse behavior
- quick links to transaction and transfer flows
- empty state CTA simplification
- demo workspace CTA

**Why third:**
This groups visible user-facing improvements into a single reviewable PR that is easy to validate from the product perspective.

---

## PR strategy recommendation

### Recommended option — 3 PRs
1. domain and business rules
2. structural cleanup
3. user-facing UX improvements

This is the cleanest and safest split for implementation, review, and debugging.

### Alternative option — 2 PRs
1. domain and business rules
2. structural cleanup + user-facing UX improvements

Use the 2-PR option only if the structural cleanup is very small. Otherwise, keep visible UX work separated from internal extraction work.

---

## Suggested branch strategy

### Main task branch
```bash
task/2026-04002-payment-methods-refactor-and-quick-actions
```

### Optional PR branches
```bash
feat/starting-balance-and-safe-delete
refactor/oversized-components-extraction
feat/quick-actions-fab-and-demo-empty-state
```

## Suggested PR titles

### PR 1
```text
[REFACTOR] Align payment method balance naming and allow safe delete
```

### PR 2
```text
[REFACTOR] Extract oversized UI components into smaller units
```

### PR 3
```text
[FEAT] Add quick actions FAB and improve empty state with demo workspace CTA
```