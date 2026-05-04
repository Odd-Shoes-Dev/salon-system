-- Efficient birthday lookup: filters by month using EXTRACT server-side
CREATE OR REPLACE FUNCTION get_birthday_clients(p_salon_id uuid, p_month integer)
RETURNS TABLE (
  id             uuid,
  name           varchar,
  phone          varchar,
  birthday       date,
  loyalty_points integer,
  total_visits   integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, phone, birthday, loyalty_points, total_visits
  FROM   clients
  WHERE  salon_id    = p_salon_id
    AND  is_active   = true
    AND  deleted_at  IS NULL
    AND  birthday    IS NOT NULL
    AND  EXTRACT(MONTH FROM birthday) = p_month
  ORDER  BY EXTRACT(DAY FROM birthday);
$$;
