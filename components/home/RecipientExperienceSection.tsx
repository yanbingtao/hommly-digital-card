import { Check, Lock } from 'lucide-react';
import { HomeAssetImage } from '@/components/home/HomeAssetImage';
import { PhoneEcardMockup } from '@/components/home/PhoneEcardMockup';
import { HOME_ASSETS, type HomeAssetAvailability } from '@/lib/home-assets';
import { LANDING_MAX_WIDTH } from './constants';
import { cn } from '@/lib/utils';

const FEATURES = [
  'Personal message',
  'Photos & eCard themes',
  'Social & web links',
  'Optional PIN protection',
  'No app required',
];

type RecipientExperienceSectionProps = {
  assets: HomeAssetAvailability;
};

export function RecipientExperienceSection({ assets }: RecipientExperienceSectionProps) {
  return (
    <section id="preview" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
      <div className={cn('mx-auto', LANDING_MAX_WIDTH)}>
        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#fff1eb] via-[#fff8f4] to-[#f3e8ff]/35 px-6 py-12 shadow-[0_24px_60px_-36px_rgba(28,25,23,0.35)] ring-1 ring-rose-100/80 sm:px-10 sm:py-16 lg:px-14">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
            <div>
              {assets.ecardPreview ? (
                <div className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-[1.75rem] shadow-[0_28px_60px_-28px_rgba(28,25,23,0.45)] ring-1 ring-white/80">
                  <HomeAssetImage
                    src={HOME_ASSETS.ecardPreview}
                    available
                    alt="Phone showing a Hommly eCard beside a Hommly gift — the experience recipients open after scanning"
                    placeholderLabel="Add /home/ecard-preview.webp"
                    sizes="(max-width: 1024px) 90vw, 420px"
                    aspectClassName="aspect-[4/5]"
                    imageClassName="object-cover object-center"
                  />
                </div>
              ) : (
                <PhoneEcardMockup size="lg" />
              )}
              <p className="mt-6 text-center text-sm font-medium text-stone-500">
                Preview an eCard — this is the experience recipients open after scanning.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
                Recipient experience
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.25] tracking-[-0.02em] text-stone-900 sm:text-4xl sm:leading-[1.22]">
                Simple to open.
                <br />
                Beautiful to remember.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-stone-600">
                Recipients simply scan the QR code and instantly open your personalised digital
                surprise — no app, no login.
              </p>

              <ul className="mt-8 space-y-3">
                {FEATURES.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-stone-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-rose-500 shadow-sm ring-1 ring-rose-100">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className="text-sm font-medium">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-rose-100/80">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                  <Lock className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-stone-800">Optional PIN protection</p>
                  <p className="mt-0.5 font-mono text-xs tracking-[0.35em] text-stone-400" aria-hidden>
                    ••••
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
