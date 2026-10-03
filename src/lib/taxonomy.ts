export function taxonomy<C extends string, G extends string>(genres: Record<C, readonly G[]>) {
  const categories = Object.keys(genres) as C[];
  return {
    categories,
    allGenres: categories.flatMap((c) => genres[c]),
    categoryOf: (genre: G) => categories.find((c) => genres[c].includes(genre))!,
  };
}
