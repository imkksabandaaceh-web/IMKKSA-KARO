// Hook khusus `npm run wa:test`.
//
// Kode server memakai akhiran import .js karena Vercel mengompilasi .ts menjadi
// .js. Node, saat menjalankan file .ts langsung, tidak melakukan penggantian
// akhiran itu. Hook ini memetakan import relatif .js ke sumber .ts yang ada,
// sehingga uji lokal membaca kode asli tanpa perlu proses build.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relatif = specifier.startsWith('./') || specifier.startsWith('../')
    if (relatif && specifier.endsWith('.js') && context.parentURL) {
      const calon = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL)
      if (calon.protocol === 'file:' && existsSync(fileURLToPath(calon))) {
        return nextResolve(calon.href, context)
      }
    }
    return nextResolve(specifier, context)
  },
})
