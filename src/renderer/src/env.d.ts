/// <reference types="vite/client" />

interface Window {
  electron: {
    loadVrm(filename: string): Promise<ArrayBuffer>
  }
}
