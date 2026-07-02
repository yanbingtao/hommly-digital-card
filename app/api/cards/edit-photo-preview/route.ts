import { NextResponse } from 'next/server';
import { getConnectionErrorMessage } from '@/lib/supabase';
import {
  assertCardEditable,
  findCardByEditToken,
} from '@/lib/card-photo-access';
import { hasCardPhoto } from '@/lib/card-photo';
import { createPhotoSignedUrl } from '@/lib/card-photo-storage';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { edit_token?: string };
    const editToken = body.edit_token?.trim();

    if (!editToken) {
      return NextResponse.json({ error: 'Missing edit token.' }, { status: 400 });
    }

    const { card, error: lookupError } = await findCardByEditToken(editToken);
    if (lookupError || !card) {
      return NextResponse.json({ error: lookupError ?? 'Card not found.' }, { status: 404 });
    }

    const editableError = assertCardEditable(card);
    if (editableError) {
      return NextResponse.json({ error: editableError }, { status: 403 });
    }

    if (!hasCardPhoto(card) || !card.photo_path) {
      return NextResponse.json({ signedUrl: null });
    }

    const signedUrl = await createPhotoSignedUrl(card.photo_path);
    if (!signedUrl) {
      return NextResponse.json({ error: 'Could not load photo preview.' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getConnectionErrorMessage(err) },
      { status: 500 }
    );
  }
}
