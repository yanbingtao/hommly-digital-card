import { NextResponse } from 'next/server';
import { getConnectionErrorMessage, getSupabase } from '@/lib/supabase';
import {
  assertCardEditable,
  findCardByEditToken,
} from '@/lib/card-photo-access';
import { validateProcessedImageBuffer } from '@/lib/card-photo';
import { assertAllowedImageBinary } from '@/lib/image-signature';
import {
  createPhotoSignedUrl,
  deleteCardPhoto,
  promoteSharedCardPhotoCandidate,
  uploadSharedCardPhotoCandidate,
} from '@/lib/card-photo-storage';

export async function POST(request: Request) {
  let candidatePath: string | null = null;

  try {
    const formData = await request.formData();
    const editToken = String(formData.get('edit_token') ?? '').trim();
    const file = formData.get('file');

    if (!editToken) {
      return NextResponse.json({ error: 'Missing edit token.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Please choose an image to upload.' }, { status: 400 });
    }

    const { card, error: lookupError } = await findCardByEditToken(editToken);
    if (lookupError || !card) {
      return NextResponse.json({ error: lookupError ?? 'Card not found.' }, { status: 404 });
    }

    const editableError = assertCardEditable(card);
    if (editableError) {
      return NextResponse.json({ error: editableError }, { status: 403 });
    }

    const validation = validateProcessedImageBuffer(file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const signature = assertAllowedImageBinary(buffer, file.type);
    if (!signature.ok) {
      return NextResponse.json({ error: signature.error }, { status: 400 });
    }

    const mimeType = signature.mime;

    // Upload to a temporary object first so a failed replacement cannot destroy the old photo.
    candidatePath = await uploadSharedCardPhotoCandidate(card.id, buffer, mimeType);
    const photoPath = await promoteSharedCardPhotoCandidate(card.id, candidatePath, mimeType);
    candidatePath = null;

    const uploadedAt = new Date().toISOString();

    const supabase = getSupabase();
    const { data: updated, error: updateError } = await supabase
      .from('digital_cards')
      .update({
        photo_path: photoPath,
        photo_original_name: file.name,
        photo_mime_type: mimeType,
        photo_size_bytes: buffer.byteLength,
        photo_uploaded_at: uploadedAt,
        updated_at: uploadedAt,
      })
      .eq('id', card.id)
      .select('id, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, photo_uploaded_at')
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? 'Failed to save photo metadata.' },
        { status: 500 }
      );
    }

    const previewUrl = await createPhotoSignedUrl(photoPath);

    return NextResponse.json({
      card: updated,
      previewUrl,
    });
  } catch (err: unknown) {
    if (candidatePath) {
      await deleteCardPhoto(candidatePath);
    }
    return NextResponse.json(
      { error: getConnectionErrorMessage(err) },
      { status: 500 }
    );
  }
}
