/// <reference types="vite/client" />

// rhino3dm ships an ES-module build without its own typings; it is the same API
declare module 'rhino3dm/rhino3dm.module.js' {
  export { default } from 'rhino3dm'
}
