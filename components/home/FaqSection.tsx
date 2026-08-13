'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ECARD_AVAILABILITY_MONTHS, LANDING_MAX_WIDTH } from './constants';
import { cn } from '@/lib/utils';

const FAQ_ITEMS = [
  {
    question: 'What is a Hommly eCard?',
    answer:
      'A Hommly eCard is a personalised digital message included with selected Hommly gifts. Recipients open it by scanning the QR card that comes with the gift — no app required.',
  },
  {
    question: 'Does the recipient need an app?',
    answer:
      'No. The recipient scans the QR code with their phone camera and your eCard opens directly in their browser.',
  },
  {
    question: 'Can I add a photo?',
    answer:
      'Yes. You can add a photo when you personalise your eCard, along with your message and theme.',
  },
  {
    question: 'Can I edit my eCard later?',
    answer:
      'Yes. After your order is set up, you receive a private edit link. You can update your message, photo, theme, links, and Viewing PIN while the eCard remains available.',
  },
  {
    question: 'How long is my eCard available?',
    answer: `Your Hommly eCard stays available for ${ECARD_AVAILABILITY_MONTHS} months from your order date, unless a different expiry date is set for your card.`,
  },
  {
    question: 'Can I protect my eCard with a PIN?',
    answer:
      'Yes. You can add an optional 4–6 digit Viewing PIN. The recipient will be asked to enter it before opening the eCard.',
  },
  {
    question: 'Can I add my social media or contact links?',
    answer:
      'Yes. You can optionally add WhatsApp, Instagram, LinkedIn, TikTok, website or email links to your eCard. They appear below your message for the recipient to open.',
  },
  {
    question: 'Is the Hommly eCard free?',
    answer:
      'Hommly eCard is free with selected Hommly gifts. When shopping on Hommly.sg, look for gifts that include the eCard experience.',
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 bg-[#fffaf7] px-4 py-16 sm:px-6 sm:py-24">
      <div className={cn('mx-auto max-w-3xl', LANDING_MAX_WIDTH)}>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.25] tracking-[-0.02em] text-stone-900 sm:text-4xl sm:leading-[1.22]">
            Frequently asked questions
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-10">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={item.question} value={`item-${index}`} className="border-stone-200/80">
              <AccordionTrigger className="text-left text-base font-medium text-stone-800 hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-stone-500">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
