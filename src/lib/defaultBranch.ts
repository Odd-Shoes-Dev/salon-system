import { sql } from '@/lib/db';

let migrated = false;

async function ensureMigration() {
  if (migrated) return;
  // Add is_default column if it doesn't exist yet
  await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false`;
  // Seed: for any salon with no default set, mark the oldest branch as the default
  await sql`
    UPDATE branches
    SET    is_default = true
    WHERE  id IN (
      SELECT DISTINCT ON (salon_id) id
      FROM   branches
      WHERE  deleted_at IS NULL
      ORDER  BY salon_id, created_at ASC
    )
    AND NOT EXISTS (
      SELECT 1 FROM branches b2
      WHERE  b2.salon_id   = branches.salon_id
        AND  b2.is_default = true
        AND  b2.deleted_at IS NULL
    )
  `;
  migrated = true;
}

/** Returns the default branch ID for a salon. */
export async function getDefaultBranchId(salonId: string): Promise<string | null> {
  await ensureMigration();
  const [row] = await sql`
    SELECT id FROM branches
    WHERE  salon_id   = ${salonId}
      AND  is_default = true
      AND  deleted_at IS NULL
    LIMIT  1
  `;
  return row?.id ?? null;
}

/**
 * Returns the branch ID to use when writing a record.
 * If the user is scoped to a specific branch, use that.
 * Otherwise fall back to the salon's default branch.
 */
export async function resolveBranchId(user: { branch_id: string | null; salon_id: string }): Promise<string | null> {
  if (user.branch_id) return user.branch_id;
  return getDefaultBranchId(user.salon_id);
}
