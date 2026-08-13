import { NextResponse } from 'next/server';
import { getConnectionErrorMessage, getSupabase } from '@/lib/supabase';
import {
  assertCardEditable,
  findCardByEditToken,
} from '@/lib/card-photo-access';
import { deleteCardPhoto, clearCardPhotoMetadata } from '@/lib/card-photo-storage';
import { assertBuyerEditAuthorized } from '@/lib/edit-pin-auth';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { edit_token?: string };
    const editToken = body.edit_token?.trim();

    if (!editToken) {
      return NextResponse.json({ error: 'Missing edit token.' }, { status: 400 });
    }

    const auth = await assertBuyerEditAuthorized(editToken);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { card, error: lookupError } = await findCardByEditToken(editToken);
    if (lookupError || !card) {
      return NextResponse.json({ error: lookupError ?? 'Card not found.' }, { status: 404 });
    }

    const editableError = assertCardEditable(card);
    if (editableError) {
      return NextResponse.json({ error: editableError }, { status: 403 });
    }

    if (card.photo_path) {
      await deleteCardPhoto(card.photo_path);
    }

    const supabase = getSupabase();
    await clearCardPhotoMetadata(supabase, card.id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getConnectionErrorMessage(err) },
      { status: 500 }
    );
  }
}
