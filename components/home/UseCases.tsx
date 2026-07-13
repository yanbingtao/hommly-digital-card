const USE_CASES = [
  {
    title: 'Teacher Appreciation',
    emoji: '🍎',
    gradient: 'from-red-100 via-rose-50 to-orange-50',
    accent: 'bg-rose-400',
  },
  {
    title: 'Farewell Gifts',
    emoji: '✈️',
    gradient: 'from-sky-100 via-blue-50 to-indigo-50',
    accent: 'bg-blue-400',
  },
  {
    title: 'Birthdays',
    emoji: '🎂',
    gradient: 'from-amber-100 via-yellow-50 to-orange-50',
    accent: 'bg-amber-400',
  },
  {
    title: 'Office Gifts',
    emoji: '💼',
    gradient: 'from-stone-200 via-stone-100 to-stone-50',
    accent: 'bg-stone-500',
  },
  {
    title: 'Team Bonding',
    emoji: '🤝',
    gradient: 'from-emerald-100 via-green-50 to-teal-50',
    accent: 'bg-emerald-400',
  },
  {
    title: 'Housewarming',
    emoji: '🏠',
    gradient: 'from-orange-100 via-amber-50 to-yellow-50',
    accent: 'bg-orange-400',
  },
];

export function UseCases() {
  return (
    <section className="bg-white px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-stone-400">Occasions</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Perfect for
          </h2>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((useCase) => (
            <div
              key={useCase.title}
              className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${useCase.gradient} p-8 ring-1 ring-stone-200/50 transition hover:shadow-lg hover:shadow-stone-200/60`}
            >
              <div
                aria-hidden
                className={`absolute -right-6 -top-6 h-24 w-24 rounded-full ${useCase.accent} opacity-10 blur-2xl transition group-hover:opacity-20`}
              />
              <div className="relative">
                <span className="text-4xl" aria-hidden>
                  {useCase.emoji}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-stone-900">{useCase.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
