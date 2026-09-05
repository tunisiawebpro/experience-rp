import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  publicDir: '../publics',
  server: {
    port: 3000,
    strictPort: false,
    open: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        rules: 'rules.html',
        storyline: 'storyline.html'
      }
    }
  }
})