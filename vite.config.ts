import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// The footer shows which commit and branch a build came from, so a deploy
// preview can be told apart from prod. Netlify sets COMMIT_REF, and HEAD to
// the branch name (BRANCH is pull/<n>/head on a deploy preview); local
// builds ask git.
const git = (args: string) => {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}
const buildCommit = (process.env.COMMIT_REF || git('rev-parse HEAD')).slice(0, 7)
const buildBranch = process.env.HEAD || git('rev-parse --abbrev-ref HEAD')

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
    __BUILD_BRANCH__: JSON.stringify(buildBranch),
  },
  build: {
    outDir: 'build', // matches Netlify publish dir
    target: 'es2020', // browser floor, see vite-migration-plan.md decisions
    sourcemap: true, // CRA parity; Vite defaults to false
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import'], // 28 files still use Sass @import
      },
    },
  },
  server: { port: 3000 }, // CRA parity; firebase authorizes all localhost ports
  preview: { port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true, // App.test.tsx uses bare test/expect
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'], // keep vitest out of functions/
    // react-loader-spinner 8 imports styled-components' default export, which
    // Node's ESM loader hands back as a namespace object. Inlining lets Vite
    // resolve it the way the production build does.
    server: { deps: { inline: ['react-loader-spinner'] } },
  },
})
