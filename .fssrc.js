// vim: set ft=javascript fdm=marker et ff=unix tw=80 sw=2:
// author: allex_wang <http://iallex.com>

import path from 'path'

import { version, name, author, license, description, dependencies, peerDependencies } from './package.json'

const banner = (name, short = false) => {
  let s
  if (short) {
    s = `/*! ${name} v${version} | ${license} licensed | ${author.name || author} */`
  } else {
    s = `/**
 * ${name} v${version} - ${description}
 *
 * @author ${author}
 * Released under the ${license} license.
 */`
  }
  return s
}

const resolve = p => path.resolve(__dirname, '.', p)

const sourceDir = resolve('./src')
const utilPrefix = resolve('./lib/utils/')

const resolveUtils = () => ({
  resolveId (id, importer, options) {
    const currDir = importer ? path.dirname(importer) : sourceDir
    const rePath = path.relative(sourceDir, path.resolve(currDir, id))
    if (rePath.startsWith('utils/')) {
      return { id, external: true }
    }
    return null
  },
})

const plugins = [
  'node-builtins',
  resolveUtils(),
  'resolve',
  'typescript',
  'babel',
  'commonjs',
  'globals',
  'postcss'
]

export default {
  vue: true,
  dependencies: { events: true, ...dependencies, ...peerDependencies },
  compress: false,
  plugins: {
    typescript: {
      tsconfig: resolve('./src/tsconfig.json')
    }
  },
  entry: [
    {
      input: resolve('src/index.tsx'),
      plugins,
      external: (id, format, next) => {
        return next(id, true)
      },
      output: [
        { dir: './lib', format: 'es', banner: banner(name, true), entryFileNames: '[name].[format].js' }
      ]
    }
  ]
}
