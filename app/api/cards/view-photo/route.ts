import { NextResponse } from 'next/server';
import { getConnectionErrorMessage } from '@/lib/supabase';
import {
  findPublishedCardByPublicToken,
  verifyViewerPinIfRequired,
} from '@/lib/card-photo-access';
import { hasCardPhoto } from '@/lib/card-photo';
import { createPhotoSignedUrl } from '@/lib/card-photo-storage';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { public_token?: string; pin?: string };
    const publicToken = body.public_token?.trim();
    const pin = body.pin?.trim();

    if (!publicToken) {
      return NextResponse.json({ error: 'Missing card token.' }, { status: 400 });
    }

    const { card, error: lookupError } = await findPublishedCardByPublicToken(publicToken);
    if (lookupError || !card) {
      return NextResponse.json({ error: 'Card not available.' }, { status: 404 });
    }

    const pinCheck = await verifyViewerPinIfRequired(card, pin);
    if (!pinCheck.allowed) {
      return NextResponse.json({ error: 'PIN required or incorrect.' }, { status: 403 });
    }

    if (!hasCardPhoto(card) || !card.photo_path) {
      return NextResponse.json({ signedUrl: null });
    }

    const signedUrl = await createPhotoSignedUrl(card.photo_path);
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
