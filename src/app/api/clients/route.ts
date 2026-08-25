import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { normalizePhoneNumber } from '@/lib/esms';
import { smsProvider } from '@/lib/sms';

// GET /api/clients - List clients for the salon
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const referredBy = searchParams.get('referred_by_client_id');
    const paginated = searchParams.get('paginated') === 'true';
    const sort = searchParams.get('sort');
    const minPointsParam = searchParams.get('minPoints');
    const minPoints = minPointsParam ? Math.max(0, parseInt(minPointsParam, 10)) : null;
    const incompleteOnly = searchParams.get('incompleteOnly') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const lastVisitAfter  = searchParams.get('last_visit_after')  || null;
    const lastVisitBefore = searchParams.get('last_visit_before') || null;
    const neverVisited    = searchParams.get('never_visited') === 'true';
    const hasPhone        = searchParams.get('has_phone') === 'true';

    // Nullable params for conditional WHERE clauses
    const searchPattern = search ? `%${search}%` : null;
    const minPts = (minPoints !== null && !Number.isNaN(minPoints)) ? minPoints : null;

    // Advanced filter params
    const genderFilter    = searchParams.get('gender')          || null;
    const locationSearch  = searchParams.get('location')        || null;
    const locationPattern = locationSearch ? `%${locationSearch}%` : null;
    const maxPointsParam  = searchParams.get('maxPoints');
    const maxPts          = maxPointsParam && !isNaN(parseInt(maxPointsParam, 10)) ? parseInt(maxPointsParam, 10) : null;
    const minSpendParam   = searchParams.get('minSpend');
    const minSpend        = minSpendParam && !isNaN(parseFloat(minSpendParam)) ? parseFloat(minSpendParam) : null;
    const maxSpendParam   = searchParams.get('maxSpend');
    const maxSpend        = maxSpendParam && !isNaN(parseFloat(maxSpendParam)) ? parseFloat(maxSpendParam) : null;
    const minVisitsParam  = searchParams.get('minVisits');
    const minVisits       = minVisitsParam && !isNaN(parseInt(minVisitsParam, 10)) ? parseInt(minVisitsParam, 10) : null;
    const maxVisitsParam  = searchParams.get('maxVisits');
    const maxVisits       = maxVisitsParam && !isNaN(parseInt(maxVisitsParam, 10)) ? parseInt(maxVisitsParam, 10) : null;
    const lvAfter         = searchParams.get('lastVisitAfter')  || null;
    const lvBefore        = searchParams.get('lastVisitBefore') || null;
    const neverVisitedF   = searchParams.get('neverVisited') === 'true';
    const bdMonthParam    = searchParams.get('birthdayMonth');
    const bdMonth         = bdMonthParam && !isNaN(parseInt(bdMonthParam, 10)) ? parseInt(bdMonthParam, 10) : null;
    const regAfter        = searchParams.get('registeredAfter') || null;
    const regBefore       = searchParams.get('registeredBefore') || null;
    const hasPhoneVal     = searchParams.get('hasPhone') || null;
    const hasPhoneYes     = hasPhoneVal === 'yes';
    const hasPhoneNo      = hasPhoneVal === 'no';

    if (paginated) {
      const offset = (page - 1) * pageSize;

      const [countRow] = await sql`
        SELECT COUNT(*) AS count
        FROM clients
        WHERE salon_id = ${user.salon_id}
          AND is_active = true
          AND deleted_at IS NULL
          AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text OR phone ILIKE ${searchPattern}::text)
          AND (${minPts}::integer IS NULL OR loyalty_points >= ${minPts}::integer)
          AND (${incompleteOnly} = false OR (phone IS NULL OR phone = '' OR email IS NULL OR birthday IS NULL OR gender IS NULL OR location IS NULL OR location = ''))
          AND (${genderFilter}::text IS NULL OR gender = ${genderFilter}::text)
          AND (${locationPattern}::text IS NULL OR location ILIKE ${locationPattern}::text)
          AND (${maxPts}::integer IS NULL OR loyalty_points <= ${maxPts}::integer)
          AND (${minSpend}::numeric IS NULL OR total_spent >= ${minSpend}::numeric)
          AND (${maxSpend}::numeric IS NULL OR total_spent <= ${maxSpend}::numeric)
          AND (${minVisits}::integer IS NULL OR total_visits >= ${minVisits}::integer)
          AND (${maxVisits}::integer IS NULL OR total_visits <= ${maxVisits}::integer)
          AND (${lvAfter}::date IS NULL OR last_visit::date >= ${lvAfter}::date)
          AND (${lvBefore}::date IS NULL OR last_visit::date <= ${lvBefore}::date)
          AND (${neverVisitedF} = false OR last_visit IS NULL)
          AND (${bdMonth}::integer IS NULL OR EXTRACT(MONTH FROM birthday::date) = ${bdMonth}::integer)
          AND (${regAfter}::date IS NULL OR created_at::date >= ${regAfter}::date)
          AND (${regBefore}::date IS NULL OR created_at::date <= ${regBefore}::date)
          AND (${hasPhoneYes} = false OR (phone IS NOT NULL AND phone <> ''))
          AND (${hasPhoneNo} = false OR (phone IS NULL OR phone = ''))
      `;
      const total = Number(countRow?.count ?? 0);

      const data = await sql`
        SELECT * FROM clients
        WHERE salon_id = ${user.salon_id}
          AND is_active = true
          AND deleted_at IS NULL
          AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text OR phone ILIKE ${searchPattern}::text)
          AND (${minPts}::integer IS NULL OR loyalty_points >= ${minPts}::integer)
          AND (${incompleteOnly} = false OR (phone IS NULL OR phone = '' OR email IS NULL OR birthday IS NULL OR gender IS NULL OR location IS NULL OR location = ''))
          AND (${genderFilter}::text IS NULL OR gender = ${genderFilter}::text)
          AND (${locationPattern}::text IS NULL OR location ILIKE ${locationPattern}::text)
          AND (${maxPts}::integer IS NULL OR loyalty_points <= ${maxPts}::integer)
          AND (${minSpend}::numeric IS NULL OR total_spent >= ${minSpend}::numeric)
          AND (${maxSpend}::numeric IS NULL OR total_spent <= ${maxSpend}::numeric)
          AND (${minVisits}::integer IS NULL OR total_visits >= ${minVisits}::integer)
          AND (${maxVisits}::integer IS NULL OR total_visits <= ${maxVisits}::integer)
          AND (${lvAfter}::date IS NULL OR last_visit::date >= ${lvAfter}::date)
          AND (${lvBefore}::date IS NULL OR last_visit::date <= ${lvBefore}::date)
          AND (${neverVisitedF} = false OR last_visit IS NULL)
          AND (${bdMonth}::integer IS NULL OR EXTRACT(MONTH FROM birthday::date) = ${bdMonth}::integer)
          AND (${regAfter}::date IS NULL OR created_at::date >= ${regAfter}::date)
          AND (${regBefore}::date IS NULL OR created_at::date <= ${regBefore}::date)
          AND (${hasPhoneYes} = false OR (phone IS NOT NULL AND phone <> ''))
          AND (${hasPhoneNo} = false OR (phone IS NULL OR phone = ''))
        ORDER BY
          CASE WHEN ${sort} = 'loyalty_points_desc' THEN loyalty_points END DESC NULLS LAST,
          CASE WHEN ${sort} = 'total_spent_desc' THEN total_spent END DESC NULLS LAST,
          CASE WHEN ${sort} = 'total_visits_desc' THEN total_visits END DESC NULLS LAST,
          CASE WHEN ${sort} = 'last_visit_desc' THEN last_visit END DESC NULLS LAST,
          CASE WHEN ${sort} = 'recent' THEN created_at END DESC NULLS LAST,
          name ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `;

      const [summaryRow] = await sql`
        SELECT
          SUM(total_spent)    AS total_spent,
          SUM(total_visits)   AS total_visits,
          SUM(loyalty_points) AS total_points,
          COUNT(*) FILTER (WHERE phone IS NULL OR phone = '' OR email IS NULL OR birthday IS NULL OR gender IS NULL OR location IS NULL OR location = '') AS incomplete_count
        FROM clients
        WHERE salon_id = ${user.salon_id}
          AND is_active = true
          AND deleted_at IS NULL
          AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text OR phone ILIKE ${searchPattern}::text)
          AND (${minPts}::integer IS NULL OR loyalty_points >= ${minPts}::integer)
          AND (${genderFilter}::text IS NULL OR gender = ${genderFilter}::text)
          AND (${locationPattern}::text IS NULL OR location ILIKE ${locationPattern}::text)
          AND (${maxPts}::integer IS NULL OR loyalty_points <= ${maxPts}::integer)
          AND (${minSpend}::numeric IS NULL OR total_spent >= ${minSpend}::numeric)
          AND (${maxSpend}::numeric IS NULL OR total_spent <= ${maxSpend}::numeric)
          AND (${minVisits}::integer IS NULL OR total_visits >= ${minVisits}::integer)
          AND (${maxVisits}::integer IS NULL OR total_visits <= ${maxVisits}::integer)
          AND (${lvAfter}::date IS NULL OR last_visit::date >= ${lvAfter}::date)
          AND (${lvBefore}::date IS NULL OR last_visit::date <= ${lvBefore}::date)
          AND (${neverVisitedF} = false OR last_visit IS NULL)
          AND (${bdMonth}::integer IS NULL OR EXTRACT(MONTH FROM birthday::date) = ${bdMonth}::integer)
          AND (${regAfter}::date IS NULL OR created_at::date >= ${regAfter}::date)
          AND (${regBefore}::date IS NULL OR created_at::date <= ${regBefore}::date)
          AND (${hasPhoneYes} = false OR (phone IS NOT NULL AND phone <> ''))
          AND (${hasPhoneNo} = false OR (phone IS NULL OR phone = ''))
      `;

      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      // Attach branch names for last_visit_branch_id and registered_at_branch_id
      let enrichedData: any[] = data as any[];
      const branchIds = [...new Set(
        (data as any[]).flatMap((c: any) => [c.last_visit_branch_id, c.registered_at_branch_id]).filter(Boolean)
      )] as string[];
      if (branchIds.length > 0) {
        const branchRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${branchIds})`;
        const branchMap: Record<string, string> = Object.fromEntries((branchRows as any[]).map(b => [b.id, b.name]));
        enrichedData = (data as any[]).map((c: any) => ({
          ...c,
          last_visit_branch_name:      c.last_visit_branch_id      ? (branchMap[c.last_visit_branch_id]      ?? null) : null,
          registered_at_branch_name:   c.registered_at_branch_id   ? (branchMap[c.registered_at_branch_id]   ?? null) : null,
        }));
      }

      return NextResponse.json({
        data: enrichedData,
        pagination: { page, pageSize, total, totalPages },
        summary: {
          totalClients: total,
          totalSpent: Number(summaryRow?.total_spent ?? 0),
          totalVisits: Number(summaryRow?.total_visits ?? 0),
          totalPoints: Number(summaryRow?.total_points ?? 0),
          incompleteCount: Number(summaryRow?.incomplete_count ?? 0),
        },
      });
    }

    if (referredBy) {
      const data = await sql`
        SELECT * FROM clients
        WHERE salon_id = ${user.salon_id}
          AND is_active = true
          AND deleted_at IS NULL
          AND referred_by_client_id = ${referredBy}
          AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text OR phone ILIKE ${searchPattern}::text)
        ORDER BY name
        LIMIT 50
      `;
      return NextResponse.json(data);
    }

    const data = await sql`
      SELECT * FROM clients
      WHERE salon_id = ${user.salon_id}
        AND is_active = true
        AND deleted_at IS NULL
        AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text OR phone ILIKE ${searchPattern}::text)
        AND (${lastVisitAfter}::timestamptz  IS NULL OR last_visit >= ${lastVisitAfter}::timestamptz)
        AND (${lastVisitBefore}::timestamptz IS NULL OR last_visit <  ${lastVisitBefore}::timestamptz)
        AND (${neverVisited} = false OR last_visit IS NULL)
        AND (${hasPhone} = false OR (phone IS NOT NULL AND phone <> ''))
      ORDER BY last_visit DESC NULLS LAST, name
    `;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Clients GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/clients - Create new client
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role === 'viewer') {
      return NextResponse.json({ error: 'Viewers cannot create clients' }, { status: 403 });
    }

    const body = await request.json();
    const { name, phone, email, birthday, gender, location, referral_source_id, referred_by_client_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Check if client with same phone already exists
    {
      const existing = await sql`
        SELECT id, is_active, deleted_at
        FROM clients
        WHERE salon_id = ${user.salon_id} AND phone = ${phone}
        LIMIT 1
      `;

      if (existing.length > 0) {
        const found = existing[0];
        if (!found.is_active || found.deleted_at) {
          try {
            const [restoredClient] = await sql`
              UPDATE clients
              SET name = ${name}, phone = ${phone}, email = ${email || null},
                  birthday = ${birthday || null}, is_active = true,
                  deleted_at = NULL, updated_at = NOW()
              WHERE id = ${found.id} AND salon_id = ${user.salon_id}
              RETURNING *
            `;
            return NextResponse.json(restoredClient, { status: 200 });
          } catch (err) {
            console.error('Error restoring client:', err);
            return NextResponse.json({ error: 'Failed to restore existing client' }, { status: 500 });
          }
        }
        return NextResponse.json({ error: 'Client with this phone already exists' }, { status: 409 });
      }
    }

    // Resolve registration branch (permanent origin record)
    let registrationBranchId: string | null = user.branch_id;
    if (!registrationBranchId) {
      // Owner on "All Branches" — fall back to salon's first active branch
      const [firstBranch] = await sql`
        SELECT id FROM branches
        WHERE salon_id = ${user.salon_id} AND deleted_at IS NULL
        ORDER BY created_at ASC LIMIT 1`;
      registrationBranchId = firstBranch?.id ?? null;
    }

    // Create client
    let newClient: any;
    try {
      const [row] = await sql`
        INSERT INTO clients
          (salon_id, name, phone, email, birthday, gender, location, referral_source_id,
           referred_by_client_id, loyalty_points, total_visits, total_spent, is_active,
           registered_at_branch_id)
        VALUES
          (${user.salon_id}, ${name}, ${phone}, ${email || null}, ${birthday || null},
           ${gender || null}, ${location || null},
           ${referral_source_id || null}, ${referred_by_client_id || null}, 0, 0, 0, true,
           ${registrationBranchId})
        RETURNING *
      `;
      newClient = row;
    } catch (err: any) {
      console.error('Error creating client:', err);
      if (err.code === '23505') {
        return NextResponse.json(
          { error: `A client with the phone number ${phone} already exists` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
    }

    // Award referral points + notify referrer
    if (referred_by_client_id) {
      try {
        const [[referrer], [salonData]] = await Promise.all([
          sql`
            SELECT id, name, phone, loyalty_points
            FROM clients
            WHERE id = ${referred_by_client_id} AND salon_id = ${user.salon_id}
            LIMIT 1
          `,
          sql`
            SELECT name, referral_points_reward, referral_sms_enabled
            FROM salons
            WHERE id = ${user.salon_id}
            LIMIT 1
          `,
        ]);

        if (referrer && salonData) {
          const reward = salonData.referral_points_reward ?? 50;
          await sql`
            UPDATE clients
            SET loyalty_points = ${(referrer.loyalty_points || 0) + reward}
            WHERE id = ${referrer.id}
          `;
          if (salonData.referral_sms_enabled !== false && referrer.phone) {
            const smsText =
              `You have earned ${reward} loyalty points for referring ${name} to ${salonData.name}! ` +
              `Keep referring friends to earn more rewards.`;
            await smsProvider.sendMessage(normalizePhoneNumber(referrer.phone), smsText);
          }
        }
      } catch (refErr) {
        console.error('Referral reward error (non-fatal):', refErr);
      }
    }

    return NextResponse.json(newClient, { status: 201 });
  } catch (error) {
    console.error('Clients POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
