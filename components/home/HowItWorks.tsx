const STEPS = [
  {
    number: '01',
    title: 'Choose a thoughtful gift',
    description: 'Browse Hommly.sg and pick a gift for someone special.',
    emoji: '🛍️',
  },
  {
    number: '02',
    title: 'Add a digital surprise card',
    description:
      'Your gift can include a QR code that opens a personalized message, photo, and animation.',
    emoji: '💌',
  },
  {
    number: '03',
    title: 'They scan and smile',
    description:
      'The recipient scans the QR code and opens a heartfelt digital card made just for them.',
    emoji: '📱',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-rose-500">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-800 sm:text-4xl">
            From gift to surprise in three simple steps
          </h2>
        </div>

        <ol className="mt-14 grid gap-6 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step) => (
            <li
              key={step.number}
              className="relative rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-stone-200/80 transition hover:shadow-md"
            >
              <span className="text-3xl" aria-hidden>
                {step.emoji}
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rose-400">
                Step {step.number}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-stone-800">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
