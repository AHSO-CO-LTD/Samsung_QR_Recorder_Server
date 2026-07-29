export function pairItems<T>(items: readonly T[]) {
  const pairs: T[][] = [];

  for (let index = 0; index < items.length; index += 2) {
    pairs.push(items.slice(index, index + 2));
  }

  return pairs;
}
