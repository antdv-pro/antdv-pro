interface Tree {
  children?: Tree[]
}
/**
 * 递归查找树节点
 * @param pred 查找条件函数
 * @returns 树节点
 */
export function deepFind(pred: (o: any) => boolean) {
  return ([x, ...xs] = [] as Tree[]): Tree =>
    x && (pred(x) ? x : deepFind(pred)(x.children) || deepFind(pred)(xs))
}
