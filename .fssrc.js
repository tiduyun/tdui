// vim: set ft=javascript fdm=marker et ff=unix tw=80 sw=2:
// author: allex_wang <http://iallex.com>

import path from 'path'

import { version, name, author, license, description, dependencies } from './package.json'

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

const utilPrefix = resolve('./lib/utils/')

const resolveDistUtils = () => ({
  resolveId (id) {
    return id.indexOf('@/utils/') === 0
      ? `${utilPrefix}${id.replace('@/utils', '')}`
      : null
  }
})

const plugins = [
  'node-builtins',
  resolveDistUtils(),
  'resolve',
  'typescript',
  'babel',
  'commonjs',
  'globals',
  'postcss'
]

export default {
  destDir: resolve('lib'),
  vue: true,
  dependencies: { events: true, ...dependencies },
  compress: false,
  entry: [
    {
      input: resolve('src/index.tsx'),
      plugins,
      external: (id, format, next) => {
        return id.indexOf(utilPrefix) === 0 || next(id, true)
      },
      output: [
        { format: 'es', file: 'tdui.esm.js', banner: banner(name, true) }
      ]
    }
  ]
}
