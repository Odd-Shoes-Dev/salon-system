import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

const BUCKET = 'salon-logos';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can upload a logo' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, WebP, SVG and GIF images are allowed' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be smaller than 2 MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${user.salon_id}/logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Use service role client so we bypass RLS on storage
    const serviceClient = createServiceClient();

    // Ensure bucket exists (creates it if not yet present)
    const { data: buckets } = await serviceClient.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET)) {
      await serviceClient.storage.createBucket(BUCKET, { public: true });
    }

    // Upload (upsert so re-uploads overwrite)
    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
    }

    // Get permanent public URL
    const { data: { publicUrl } } = serviceClient.storage.from(BUCKET).getPublicUrl(path);

    // Bust cache by appending a timestamp query param
    const logoUrl = `${publicUrl}?t=${Date.now()}`;

    // Persist on the salon record
    const supabase = await createClient();
    await supabase
      .from('salons')
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq('id', user.salon_id);

    return NextResponse.json({ logo_url: logoUrl });
  } catch (err) {
    console.error('Logo upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
