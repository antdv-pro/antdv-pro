export function deepFind(pred) {
  return ([x, ...xs] = []) => x && (pred(x) ? x : deepFind(pred)(x.children) || deepFind(pred)(xs))
}
