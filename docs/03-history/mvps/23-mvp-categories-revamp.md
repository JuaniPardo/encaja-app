# MVP: Category Normalization Foundation

## Summary
Introduce a system-level category catalog to enable consistent analytics, insights, and internationalization, while preserving user flexibility through workspace-level category instances.

---

## Problem Statement
Current categories are fully user-defined and lack a shared semantic structure. This prevents:

- Reliable analytics across workspaces and users
- Consistent insight generation
- Clean internationalization of category names
- Standardization for advisor-client use cases

Additionally, category behavior (e.g., fixed vs variable spending) is currently embedded at the workspace level without a clear global semantic baseline.

---

## Goal
Establish a dual-layer category model:

- **System Categories**: Global, semantically stable, non-editable definitions
- **Workspace Categories**: Editable instances used in transactions and budgets

This enables structured analytics while maintaining user flexibility.

---

## Scope

### Included
- Creation of `system_categories` table
- Extension of `categories` table with:
    - `source` (`system` | `custom`)
    - `system_category_id` (nullable FK)
- Update workspace creation flow to instantiate system categories
- Backfill existing categories with `source='custom'`
- Optional manual mapping of existing categories to system categories
- Maintain `transactions` and `budget_items` references to `categories.id`
- Preserve and formalize `expense_behavior`

### Not Included
- Advanced analytics engine
- Insight generation logic
- Automated mapping of legacy categories
- Cross-user comparisons for advisors
- Removal of legacy fields (`is_system`, `system_key`) in this phase

---

## Data Model Changes

### New Table: `system_categories`

### Semantic Integrity Rule
All system-level logic (analytics, insights, grouping) MUST rely on `system_category_id` or `system_categories.key`, never on `categories.name`.

### System Category Instantiation
When a workspace is created, each system category is instantiated into `categories` with copied default properties (name, color, expense_behavior). These values can be modified at the workspace level.

### Expense Behavior Definition
Defines how budget consumption is interpreted during a period:

- `fixed`: treated as discrete; once executed, no further projection is applied
- `variable`: treated as progressive; may be extrapolated across the period


### Data Integrity
- A workspace cannot have more than one instance of the same system category
- Custom categories must not reference `system_category_id`

## Future Extensions (Not in Scope)

- Category grouping (e.g., "Essential vs Discretionary")
- Advisor-level analytics across users
- Automatic category mapping suggestions
- Insight engine based on system categories
---

## Execution Plan (PR Breakdown)

### PR 1 – Database Foundation
**Objective:** Introduce system category structure without breaking existing behavior

- Create table `system_categories`
- Add columns to `categories`:
    - `source`
    - `system_category_id`
- Add constraints:
    - source/system_category_id consistency check
- Add indexes:
    - `(workspace_id, system_category_id)` unique where not null
- Backfill:
    - Set all existing categories → `source = 'custom'`
- No application logic changes yet

**Result:** Schema ready, no functional impact

---

### PR 2 – Seed + Workspace Creation Update
**Objective:** Start using system categories for new data

- Seed `system_categories` with base catalog
- Update workspace creation flow:
    - Replace hardcoded categories
    - Instantiate from `system_categories`
- Copy defaults into `categories`:
    - name
    - color
    - expense_behavior
- Keep legacy categories untouched

**Result:** New workspaces use normalized categories

---

### PR 3 – Backend Adaptation
**Objective:** Make backend aware of system categories

- Update category-related endpoints:
    - Support `source` and `system_category_id`
- Ensure queries can join `categories → system_categories`
- Prepare analytics layer to use `system_category_id`
- Maintain backward compatibility:
    - Custom categories still work as before

**Result:** Backend ready for semantic category usage

---

### PR 4 – Frontend Integration
**Objective:** Expose system vs custom categories in UI

- Update category selector:
    - Group system and custom categories
- Update settings UI:
    - Show system categories (toggleable)
    - Allow custom category creation
- Ensure no breaking UX for existing users

**Result:** Users interact with normalized model

---

### PR 5 – Optional Migration & Cleanup
**Objective:** Improve data quality (non-blocking)

- Manual mapping of key categories (optional)
- Validate:
    - No duplicate system categories per workspace
- Begin deprecation plan:
    - `is_system`
    - `system_key`

**Result:** Cleaner data, ready for future features

---

## Rollout Strategy

- Deploy PRs sequentially (1 → 5)
- Ensure PR 1 is fully backward compatible
- Monitor:
    - category creation
    - transaction creation
    - budget assignment
- Avoid user-facing disruption until PR 4

---

## Post-MVP Next Steps

- Introduce analytics based on `system_category_id`
- Build insight rules (spending patterns, trends)
- Add advisor-level aggregated views
- Improve category mapping UX (semi-automatic suggestions)