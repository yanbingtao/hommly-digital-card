const USE_CASES = [
  { title: 'Teacher Appreciation', emoji: '🍎' },
  { title: 'Farewell Gifts', emoji: '🌿' },
  { title: 'Birthday Gifts', emoji: '🎂' },
  { title: 'Corporate Thank You', emoji: '🤝' },
  { title: 'Team Bonding', emoji: '✨' },
  { title: 'Event Door Gifts', emoji: '🎀' },
];

export function UseCases() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-rose-500">
            Perfect For
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-800 sm:text-4xl">
            Thoughtful moments, beautifully delivered
          </h2>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((item) => (
            <li
              key={item.title}
              className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-white to-stone-50/80 px-5 py-4 shadow-sm ring-1 ring-stone-200/70"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-2xl"
                aria-hidden
              >
                {item.emoji}
              </span>
              <span className="font-medium text-stone-700">{item.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
