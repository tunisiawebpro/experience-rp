<<<<<<< HEAD
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  publicDir: '../publics',
  server: {
    port: 3000,
    strictPort: true,
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
=======
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  publicDir: '../publics',
  server: {
    port: 3000,
    strictPort: true,
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
>>>>>>> 7d0b39aa32d1f195e5e40a3764f308e4a1aaf7de
})