# Smart Categories (MVP)

## Problem

Encaja currently treats categories too uniformly for the product direction the app is taking.

This creates four risks:

1. System categories can drift visually from their semantic meaning if the visible name is editable.
2. Not all system categories fulfill the same product role, but the model does not currently express those differences clearly.
3. The model currently mixes different kinds of category behavior without clearly separating semantic meaning from user-managed planning patterns.
4. The UI has no native way to guide the user when a category should be used with caution.

This becomes especially relevant before implementing the demo dataset, because the demo should be seeded on top of a stable category contract.

---

## Objective

Strengthen the category model so system categories become stable product language, while allowing certain categories to carry special UX behavior.

At the same time, preserve the existing fixed vs variable planning behavior used for monthly projection, while clarifying that this user-managed planning pattern is not the same thing as immutable system semantics.

This MVP should support a healthier product balance:

- reduce semantic inconsistency
- protect future insights and analytics
- allow controlled exceptions such as manual adjustment flows
- support user adherence by lowering perfection pressure
- avoid encouraging overuse of exceptional categories

Core principle:

> Consistency is more important than flexibility for system categories.
> Continuity is more important than perfection for user behavior.

---

## Product Intent

This refinement is not only a data-model improvement.
It is also a retention and adherence mechanism.

The app should help the user keep going even when their records are incomplete, without normalizing low-quality tracking as the default behavior.

Desired balance:

- do not penalize the user for missing data
- do not frame manual adjustment as failure
- do not encourage manual adjustment as the standard workflow
- preserve the idea that better detail produces better results

This means Encaja should allow exceptions, but make them visible and intentionally secondary.

---

## Scope

This MVP includes:

1. Hardening system categories
2. Introducing enriched category behavior metadata
3. Preserving user-managed fixed vs variable planning behavior for monthly projection
4. Supporting at least one exceptional system category
5. Enabling contextual warnings in UI for exceptional categories
6. Blocking editing of immutable system category properties

This MVP does **not** include:

- subcategories
- user-defined aliases for system categories
- category scoring systems
- analytics based on exceptional usage
- demo dataset implementation
- full behavioral taxonomy beyond the initial MVP fields

---

## Proposed Category Contract

### Base fields

- `id`
- `kind`
- `semanticKey`
- `displayName`
- `isSystem`
- `isEditable`

### MVP enriched fields

- `isExceptional`
- `warningMessage`

### Existing planning field to preserve

- `expenseBehavior`

### MVP interpretation

- `isSystem = true` means the category is official product language
- `isEditable = false` means the category cannot be renamed or modified by the user
- `isExceptional = true` means the category should be available but treated as non-standard usage
- `warningMessage` allows the UI to explain the intended use of the category
- `expenseBehavior` remains available for monthly projection behavior such as fixed vs variable planning, and should be treated as user-managed planning metadata rather than immutable system semantics

---

## Behavioral Rules

### Behavior must be separated by responsibility

This MVP should explicitly distinguish between two different layers that currently risk being conflated:

- system semantic behavior
- user-managed planning behavior

System semantic behavior answers:

- what the category means in Encaja
- whether it is standard or exceptional
- how the product should interpret it

User-managed planning behavior answers:

- how the user expects that category to behave in monthly planning
- whether it is treated as fixed or variable for projection purposes

This distinction is important because a category can remain semantically stable while still being planned differently by different users.

### 1. System categories are immutable

If a category is system-defined, the following should be treated as stable at the semantic layer:

- semantic key
- visible name
- core behavior

This does not mean every planning-related attribute must be immutable.
User-managed planning behavior can remain configurable where needed, as long as it does not alter the semantic contract of the category.

System categories are not suggestions or templates.
They are part of Encaja's official language.

### 2. Exceptional categories are valid but non-ideal

Exceptional categories should exist to help the user recover continuity when perfect reconstruction is unrealistic.

They must:

- remain available
- remain understandable
- avoid shame or punitive tone
- avoid looking like the preferred default path

### 3. Better data quality should remain the ideal

The UX should communicate that exceptional categories are useful fallback tools, but that detailed records produce more accurate balances, reporting, and insights.

### 4. Fixed vs variable planning behavior remains configurable

Encaja should preserve the existing ability to classify a category according to monthly planning behavior such as fixed vs variable.

This behavior is still useful because it supports projection use cases like:

- salary expected once per month
- variable income depending on work performed
- a large monthly grocery purchase
- multiple smaller weekly grocery purchases

This planning dimension should remain available to the user.
However, it should be documented and treated as a projection aid, not as the canonical semantic meaning of the category.

---

## Initial Use Case

### Manual Adjustment

The first explicit exceptional category should cover a “manual adjustment” style use case.

Intent:

- help the user continue after missing records
- avoid forcing reconstruction of an entire period
- preserve continuity of use

Important constraint:

Manual adjustment should be positioned as an exception resource, not as a normal replacement for transaction logging.

Possible guidance tone:

> Use this when you need to realign your balance and keep moving.
> For better results, reserve it for exceptional cases.

---

## UX Direction

Warnings for exceptional categories should:

- reduce anxiety
- explain purpose clearly
- remind the user that this is not the preferred default

The UX should aim for this balance:

- enable without promoting
- educate without scolding
- reduce friction without making the shortcut invisible

This MVP only requires support for the warning content and display condition.
It does not require a full UX flow redesign.

---

## Why This Comes Before Demo Data

The demo dataset should teach the product correctly.
If category semantics are still unstable, the demo will reinforce the wrong mental model.

This refinement should land first so demo data is built on top of:

- stable system naming
- stable semantics
- explicit exceptional behavior
- future-safe UX hooks

---

## Technical Notes

Recommended MVP simplicity:

- keep the model small
- avoid over-generalizing category configuration too early
- implement only the fields needed for the first meaningful exceptional case

Suggested MVP fields:

```ts
isSystem: boolean
isEditable: boolean
isExceptional: boolean
warningMessage: string | null
```

In addition, the existing planning-oriented `expenseBehavior` field should be preserved for this MVP where it is already supporting monthly projection logic. Its meaning should be narrowed and documented as user-managed planning metadata, not as the core semantic behavior of the category.

This is intentionally modest.
It should solve the immediate product need without prematurely building a fully generic category behavior engine.

---

## Risks Avoided

This MVP helps avoid:

- semantic drift between UI and system behavior
- misleading analytics caused by treating all categories equally
- confusion caused by mixing semantic category meaning with projection-oriented planning patterns
- user confusion about what certain categories are meant for
- future copy inconsistency across the product
- demo data built on unstable category assumptions

---

## Acceptance Criteria

### Data Model

- System categories support immutable behavior through explicit fields.
- The category model supports at least one exceptional category.
- Categories can optionally store a warning message.
- Existing fixed vs variable planning behavior remains available for user-managed monthly projection.

### System Rules

- A system category cannot have its visible name edited.
- A system category cannot have its semantic meaning altered by the user.
- Exceptional categories remain selectable.

### UI Behavior

- When the user interacts with an exceptional category, the UI can display a contextual warning.
- The warning explains intended usage without punitive language.
- The UI does not present exceptional categories as preferred over normal categories.

### Product Behavior

- The model supports continuity-first usage for incomplete periods.
- The design preserves the principle that detailed tracking is still the ideal.
- The system preserves projection flexibility by keeping fixed vs variable planning behavior available without redefining category semantics.

---

## Out of Scope Follow-ups

Possible future evolutions after this MVP:

- category behavior enum instead of boolean exceptional flag
- renaming or redesigning `expenseBehavior` into a clearer planning-specific field
- subcategories under system categories
- user aliases layered over system language
- adjustment usage indicators in summaries and insights
- insight logic that accounts for exceptional category usage
- more advanced UX metadata such as warning title, badge label, or usage guidance

---

## Current Status

Status: Defined for implementation

This MVP should be executed before demo dataset work.
