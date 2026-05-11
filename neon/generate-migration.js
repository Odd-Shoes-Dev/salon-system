/**
 * generate-migration.js
 * Converts Supabase JSON exports → Neon-compatible INSERT SQL
 * Run: node neon/generate-migration.js
 */

const fs   = require('fs');
const path = require('path');

const DIR    = __dirname;
const OUTPUT = path.join(DIR, 'data-migration.sql');

// ── Helpers ──────────────────────────────────────────────────

function readTable(name) {
  const file = path.join(DIR, `${name}_rows.json`);
  if (!fs.existsSync(file)) { console.warn(`  ⚠  ${name}_rows.json not found, skipping`); return []; }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function escape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

function block(table, rows, note = '') {
  if (!rows.length) return `-- ${table}: 0 rows\n`;
  const header = `-- ── ${table} (${rows.length} row${rows.length !== 1 ? 's' : ''})${note}\n`;
  const stmts = rows.map(row => {
    const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
    const vals = Object.values(row).map(escape).join(', ');
    return `INSERT INTO "${table}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;`;
  });
  return header + stmts.join('\n') + '\n';
}

// ── Load all tables ───────────────────────────────────────────

const salons          = readTable('salons');
const staff           = readTable('staff');
const workers         = readTable('workers');
const referralSources = readTable('referral_sources');
const clients         = readTable('clients');
const svcCategories   = readTable('service_categories');
const services        = readTable('services');
const svcAddons       = readTable('service_addons');
const loyaltyTiers    = readTable('loyalty_tiers');
const stockGroups     = readTable('stock_groups');
const stockItems      = readTable('stock_items');
const accounts        = readTable('accounts');
const visits          = readTable('visits');
const visitServices   = readTable('visit_services');
const visitAddons     = readTable('visit_addons');
const acctTxns        = readTable('account_transactions');
const staffRatings    = readTable('staff_ratings');
const expenses        = readTable('expenses');
const stockMovements  = readTable('stock_movements');
const birthdayMsgs    = readTable('birthday_messages');
const msgTemplates    = readTable('message_templates');

// ── Build valid ID sets for FK validation ─────────────────────

const validSalonIds   = new Set(salons.map(r => r.id));
const validStaffIds   = new Set(staff.map(r => r.id));
const validClientIds  = new Set(clients.map(r => r.id));
const validWorkerIds  = new Set(workers.map(r => r.id));
const validVisitIds   = new Set(visits.map(r => r.id));
const validAccountIds = new Set(accounts.map(r => r.id));
const validSvcIds     = new Set(services.map(r => r.id));
const validAddonIds   = new Set(svcAddons.map(r => r.id));
const validStockIds   = new Set(stockItems.map(r => r.id));

// ── Filter out orphaned records ───────────────────────────────

function filterSalon(rows) {
  const ok = rows.filter(r => validSalonIds.has(r.salon_id));
  const skip = rows.length - ok.length;
  if (skip) console.warn(`  ⚠  Skipped ${skip} orphaned row(s) (salon_id not in salons table)`);
  return ok;
}

const staffClean        = filterSalon(staff);
const workersClean      = filterSalon(workers);
const refSourcesClean   = filterSalon(referralSources);
const clientsClean      = filterSalon(clients);
const svcCatClean       = filterSalon(svcCategories)
  .map(({ description, icon, deleted_at, ...r }) => r); // columns not in Neon schema
const servicesClean     = filterSalon(services);
const svcAddonsClean    = filterSalon(svcAddons);
const loyaltyClean      = filterSalon(loyaltyTiers);
const stockGroupsClean  = filterSalon(stockGroups);
const stockItemsClean   = filterSalon(stockItems);
const accountsClean     = filterSalon(accounts);
// Null out nullable FKs that might reference filtered-out rows
function nullIfInvalid(val, validSet) { return (val && validSet.has(val)) ? val : null; }

const visitsClean = filterSalon(visits)
  .filter(r => validClientIds.has(r.client_id))
  .map(({ voided_at, voided_by, ...r }) => ({ // columns not in Neon schema
    ...r,
    staff_id:   nullIfInvalid(r.staff_id,   validStaffIds),
    worker_id:  nullIfInvalid(r.worker_id,  validWorkerIds),
    served_by:  nullIfInvalid(r.served_by,  validStaffIds),
    deleted_by: nullIfInvalid(r.deleted_by, validStaffIds),
  }));

const visitSvcsClean = visitServices
  .filter(r => validVisitIds.has(r.visit_id) && validSvcIds.has(r.service_id))
  .map(r => ({ ...r, discounted_by: nullIfInvalid(r.discounted_by, validStaffIds) }));

const visitAddonsClean  = visitAddons.filter(r => validVisitIds.has(r.visit_id) && validAddonIds.has(r.addon_id) && validSalonIds.has(r.salon_id));
const acctTxnsClean     = filterSalon(acctTxns)
  .filter(r => validAccountIds.has(r.account_id))
  .map(r => ({ ...r, recorded_by: nullIfInvalid(r.recorded_by, validStaffIds) }));
const ratingsClean      = filterSalon(staffRatings)
  .filter(r => validVisitIds.has(r.visit_id) && validClientIds.has(r.client_id))
  .map(r => ({
    ...r,
    staff_id:  nullIfInvalid(r.staff_id,  validStaffIds),
    worker_id: nullIfInvalid(r.worker_id, validWorkerIds),
  }));
const expensesClean     = filterSalon(expenses)
  .map(r => ({ ...r, created_by: nullIfInvalid(r.created_by, validStaffIds) }));
const stockMovsClean    = stockMovements
  .filter(r => validSalonIds.has(r.salon_id) && validStockIds.has(r.item_id))
  .map(r => ({ ...r, created_by: nullIfInvalid(r.created_by, validStaffIds) }));
const bDayMsgsClean     = filterSalon(birthdayMsgs).filter(r => validClientIds.has(r.client_id));
const msgTplsClean      = filterSalon(msgTemplates);

// ── Clients: handle self-referencing FK ──────────────────────
// Insert all clients first with referred_by_client_id = NULL,
// then UPDATE the ones that have a valid reference.

const clientsWithoutSelfRef = clientsClean.map(r => ({ ...r, referred_by_client_id: null }));
const clientSelfRefs = clientsClean.filter(r => r.referred_by_client_id && validClientIds.has(r.referred_by_client_id));

// ── Assemble SQL ──────────────────────────────────────────────

let sql = `-- ==============================================================
-- NEON DATA MIGRATION
-- Generated: ${new Date().toISOString()}
-- Source: Supabase JSON exports
-- Run this AFTER 001_schema.sql in the Neon SQL Editor
-- Each INSERT uses ON CONFLICT DO NOTHING (safe to re-run)
-- ==============================================================

`;

// 1. salons
sql += block('salons', salons);
sql += '\n';

// 2. staff (filtered)
sql += block('staff', staffClean);
sql += '\n';

// 3. workers
sql += block('workers', workersClean);
sql += '\n';

// 4. referral_sources (before clients, clients.referral_source_id → here)
sql += block('referral_sources', refSourcesClean);
sql += '\n';

// 5. clients (self-ref stripped; updated after)
sql += block('clients', clientsWithoutSelfRef, ' — referred_by_client_id inserted as NULL, updated below');
sql += '\n';

if (clientSelfRefs.length) {
  sql += `-- Update client self-references (referred_by_client_id)\n`;
  for (const r of clientSelfRefs) {
    sql += `UPDATE "clients" SET "referred_by_client_id" = ${escape(r.referred_by_client_id)} WHERE "id" = ${escape(r.id)};\n`;
  }
  sql += '\n';
}

// 6. service_categories
sql += block('service_categories', svcCatClean);
sql += '\n';

// 7. services
sql += block('services', servicesClean);
sql += '\n';

// 8. service_addons
sql += block('service_addons', svcAddonsClean);
sql += '\n';

// 9. loyalty_tiers
sql += block('loyalty_tiers', loyaltyClean);
sql += '\n';

// 10. stock_groups
sql += block('stock_groups', stockGroupsClean);
sql += '\n';

// 11. stock_items
sql += block('stock_items', stockItemsClean);
sql += '\n';

// 12. accounts
sql += block('accounts', accountsClean);
sql += '\n';

// 13. sessions — SKIPPED (all expired; users will log in fresh on Neon)
sql += `-- sessions: SKIPPED — all tokens are expired; users will log in fresh\n\n`;

// 14. visits
sql += block('visits', visitsClean);
sql += '\n';

// 15. visit_services
sql += block('visit_services', visitSvcsClean);
sql += '\n';

// 16. visit_addons
sql += block('visit_addons', visitAddonsClean);
sql += '\n';

// 17. account_transactions
sql += block('account_transactions', acctTxnsClean);
sql += '\n';

// 18. staff_ratings
sql += block('staff_ratings', ratingsClean);
sql += '\n';

// 19. expenses
sql += block('expenses', expensesClean);
sql += '\n';

// 20. stock_movements
sql += block('stock_movements', stockMovsClean);
sql += '\n';

// 21. birthday_messages
sql += block('birthday_messages', bDayMsgsClean);
sql += '\n';

// 22. message_templates
sql += block('message_templates', msgTplsClean);
sql += '\n';

sql += `-- ==============================================================
-- DONE
-- ==============================================================
-- NOTE: account_balances is a VIEW — it auto-calculates from
--       account_transactions, no insert needed.
--
-- ⚠️  POST-MIGRATION: Fix Supabase logo URL
-- One salon (LX SALOON / demo, id: ae431b22-...) has a logo
-- hosted on Supabase Storage. Re-upload to ImageKit then run:
--
--   UPDATE salons
--   SET logo_url = 'https://ik.imagekit.io/my6rv0pqv/salon-system/ae431b22-d8bf-4fa9-97bd-c44329089741/logos/logo.jpg'
--   WHERE id = 'ae431b22-d8bf-4fa9-97bd-c44329089741';
-- ==============================================================
`;

fs.writeFileSync(OUTPUT, sql);

console.log(`\n✅  data-migration.sql written to ${OUTPUT}`);
console.log(`\nRow counts:`);
console.log(`  salons             : ${salons.length}`);
console.log(`  staff              : ${staffClean.length}`);
console.log(`  workers            : ${workersClean.length}`);
console.log(`  referral_sources   : ${refSourcesClean.length}`);
console.log(`  clients            : ${clientsClean.length}`);
console.log(`  service_categories : ${svcCatClean.length}`);
console.log(`  services           : ${servicesClean.length}`);
console.log(`  service_addons     : ${svcAddonsClean.length}`);
console.log(`  loyalty_tiers      : ${loyaltyClean.length}`);
console.log(`  stock_groups       : ${stockGroupsClean.length}`);
console.log(`  stock_items        : ${stockItemsClean.length}`);
console.log(`  accounts           : ${accountsClean.length}`);
console.log(`  sessions           : SKIPPED (all expired)`);
console.log(`  visits             : ${visitsClean.length}`);
console.log(`  visit_services     : ${visitSvcsClean.length}`);
console.log(`  visit_addons       : ${visitAddonsClean.length}`);
console.log(`  account_transactions: ${acctTxnsClean.length}`);
console.log(`  staff_ratings      : ${ratingsClean.length}`);
console.log(`  expenses           : ${expensesClean.length}`);
console.log(`  stock_movements    : ${stockMovsClean.length}`);
console.log(`  birthday_messages  : ${bDayMsgsClean.length}`);
console.log(`  message_templates  : ${msgTplsClean.length}`);
console.log(`\nNext step: paste neon/data-migration.sql into the Neon SQL Editor and run it.\n`);
