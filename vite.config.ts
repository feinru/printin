import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		// bun:* are native Bun modules — must not be bundled by Vite/Node
		external: ['bun:sqlite', 'bun:ffi', 'bun:jsc', 'bun:test']
	}
});
