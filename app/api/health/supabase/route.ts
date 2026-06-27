import { NextResponse } from 'next/server';
import { getConnectionErrorMessage, getSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('digital_cards').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getConnectionErrorMessage(error) },
      { status: 500 }
    );
  }
}
