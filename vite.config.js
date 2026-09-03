import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        creatorSuite: resolve(root, 'tools/creator-suite.html'),
        constructWorkshop: resolve(root, 'tools/construct-workshop.html'),
        enemyEditor: resolve(root, 'tools/enemy-editor.html'),
        weaponPatternLab: resolve(root, 'tools/weapon-pattern-lab.html'),
        levelEditor: resolve(root, 'tools/level-editor.html'),
        meshVoxelizer: resolve(root, 'tools/mesh-voxelizer.html'),
      },
    },
  },
});
