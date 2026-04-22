import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    server: {
      headers: {
        // Allow loading MediaPipe WASM from CDN and webcam access
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob: data:"
      }
    }
  }
})
