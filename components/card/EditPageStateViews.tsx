import { CalendarClock } from 'lucide-react';

export function EditPageNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="text-center">
        <p className="text-lg font-medium text-stone-700">Card not found</p>
        <p className="mt-1 text-sm text-stone-500">This link may be invalid or expired.</p>
      </div>
    </div>
  );
}

export function EditPageExpired({ expiredOn }: { expiredOn: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <CalendarClock className="h-6 w-6" />
        </div>
        <p className="text-lg font-medium text-stone-700">This card has expired</p>
        <p className="mt-2 text-sm text-stone-500">
          The edit and viewing links are no longer active
          {expiredOn ? (
            <>
              {' '}
              as of <span className="font-medium text-stone-600">{expiredOn}</span>
            </>
          ) : (
            ''
          )}
          .
        </p>
        <p className="mt-3 text-sm text-stone-500">
          Please contact Hommly if you need this card reactivated.
        </p>
      </div>
    </div>
  );
}

export function EditPageIndividualLoadError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="max-w-sm text-center">
        <p className="text-lg font-medium text-stone-700">We couldn&apos;t load the gift list.</p>
        <p className="mt-2 text-sm text-stone-500">Please try again later.</p>
      </div>
    </div>
  );
}
