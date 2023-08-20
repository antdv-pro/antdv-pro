import dirTree from 'directory-tree'
import treeify from 'treeify'

const filteredTree = dirTree(process.cwd(), {
  exclude: [/node_modules/, /\.git/, /\.vscode/, /\.idea/],
})

const children = filteredTree.children ?? []

const genObj = (children: any[]) => {
  const obj: Record<string, any> = {}
  for (const child of children)
    obj[child.name] = (child?.children && child.children.length > 0) ? genObj(child.children) : null

  return obj
}

const obj = genObj(children)

const md = treeify.asTree(obj, true, null)

console.log(md)
