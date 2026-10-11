import { defineConfig } from 'vite';
export default defineConfig({ base:'./',publicDir:'.build/public', build:{ target:'es2022', modulePreload:{polyfill:false}, sourcemap:false }, test:{ maxWorkers:1,minWorkers:1,environment:'jsdom', include:['tests/**/*.test.js'],exclude:['tests/support/**'] } });
