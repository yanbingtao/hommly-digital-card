'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQ_ITEMS = [
  {
    question: 'Can I edit my message later?',
    answer:
      'Yes. After you place your order, you receive a private link to personalise your eCard. You can update your message and photos anytime before the recipient scans the QR code.',
  },
  {
    question: 'How long is the QR valid?',
    answer:
      'Your QR code remains active so the recipient can open your eCard whenever they are ready. There is no rush — the surprise is always waiting.',
  },
  {
    question: 'Does the recipient need an app?',
    answer:
      'No app required. The recipient simply scans the QR code with their phone camera and your personalised eCard opens instantly in their browser.',
  },
  {
    question: 'Is it free?',
    answer:
      'Hommly eCard is included free with selected Hommly gifts. When you shop on Hommly, look for gifts that include the eCard experience.',
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="bg-stone-50 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-stone-400">Questions</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-12">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={item.question} value={`item-${index}`}>
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
