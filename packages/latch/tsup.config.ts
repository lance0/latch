import { defineConfig, Options } from 'tsup';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

export default defineConfig((options): Options[] => [
  // Server-side code (no 'use client' directive)
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    external: ['react', 'react-dom', 'next'],
    outDir: 'dist',
  },
  // OBO subpath export (server-side only)
  {
    entry: {
      'obo/index': 'src/obo/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
    treeshake: true,
    external: ['react', 'react-dom', 'next'],
    outDir: 'dist',
  },
  // Client-side React code (needs 'use client' directive)
  {
    entry: {
      'react/index': 'src/react/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false, // Don't clean since we have multiple configs
    splitting: false,
    treeshake: true,
    external: ['react', 'react-dom', 'next'],
    outDir: 'dist',
    async onSuccess() {
      // Add 'use client' directive and React import to bundled files
      const files = [
        { path: 'dist/react/index.js', reactImport: "import React from 'react';" },
        { path: 'dist/react/index.cjs', reactImport: "const React = require('react');" },
      ];
      for (const file of files) {
        try {
          const content = readFileSync(file.path, 'utf-8');
          let newContent = content;

          // Add 'use client' at the very top if not present
          if (!newContent.startsWith("'use client'")) {
            newContent = `'use client';\n${newContent}`;
          }

          // For CJS, add React import after 'use strict'
          if (file.path.endsWith('.cjs')) {
            newContent = newContent.replace(
              "'use strict';",
              `'use strict';\n${file.reactImport}`
            );
          } else {
            // For ESM, add React import after 'use client'
            newContent = newContent.replace(
              "'use client';",
              `'use client';\n${file.reactImport}`
            );
          }

          writeFileSync(file.path, newContent);
        } catch (error) {
          console.warn(`Failed to process ${file.path}:`, error);
        }
      }
    },
  },
]);
