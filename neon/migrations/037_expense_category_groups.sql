-- Optional grouping for expense categories (e.g. "Fixed Costs" containing
-- Rent/Insurance/Salaries). A category's group_id stays nullable on purpose —
-- salons that don't want grouping just leave categories ungrouped, same as
-- today, and existing expenses/categories are unaffected.

CREATE TABLE expense_category_groups (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id   UUID        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  sort_order INT         DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE expense_categories
  ADD COLUMN group_id UUID REFERENCES expense_category_groups(id) ON DELETE SET NULL;
