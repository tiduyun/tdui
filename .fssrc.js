// vim: set ft=javascript fdm=marker et ff=unix tw=80 sw=2:
// author: allex_wang <http://iallex.com>

import path from 'path'

import { version, name, author, license, description } from './package.json'

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

const resolveUtils = () => ({
  async load(id) {
    const repath = path.relative(sourceDir, id)
    if (repath.startsWith('utils/')) {
      this.emitFile({
        type: 'chunk',
        id,
        fileName: repath.replace(/.ts$/, '.js')
      })
    }
  }
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
  plugins: {
    typescript: {
      tsconfig: resolve('./src/tsconfig.json')
    }
  },
  entry: [
    {
      input: resolve('src/index.tsx'),
      plugins,
      output: [
        { dir: 'lib', format: 'es', banner: banner(name, true), entryFileNames: '[name].[format].js' }
      ]
    }
  ]
}
