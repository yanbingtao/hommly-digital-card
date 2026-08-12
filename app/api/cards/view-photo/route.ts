import { NextResponse } from 'next/server';
import { getConnectionErrorMessage } from '@/lib/supabase';
import {
  findPublishedViewForPhoto,
  getPhotoPathForResolvedView,
  verifyViewerPinForResolved,
} from '@/lib/card-photo-access';
import { createPhotoSignedUrl } from '@/lib/card-photo-storage';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { public_token?: string; pin?: string };
    const publicToken = body.public_token?.trim();
    const pin = body.pin?.trim();

    if (!publicToken) {
      return NextResponse.json({ error: 'Missing card token.' }, { status: 400 });
    }

    const { resolved, error: lookupError } = await findPublishedViewForPhoto(publicToken);
    if (lookupError || !resolved) {
      return NextResponse.json({ error: 'Card not available.' }, { status: 404 });
    }

    const pinCheck = await verifyViewerPinForResolved(resolved, pin);
    if (!pinCheck.allowed) {
      return NextResponse.json({ error: 'PIN required or incorrect.' }, { status: 403 });
    }

    const photoPath = getPhotoPathForResolvedView(resolved);
    if (!photoPath) {
      return NextResponse.json({ signedUrl: null });
    }

    const signedUrl = await createPhotoSignedUrl(photoPath);
    if (!signedUrl) {
      return NextResponse.json({ error: 'Could not load photo.' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getConnectionErrorMessage(err) },
      { status: 500 }
    );
  }
}
