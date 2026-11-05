/**
 * Remotion CLI config (studio / still / render). The Node APIs ignore this file.
 *
 * The video renders the REAL CRM views from ../client/src, so the bundler must:
 *  - resolve `@crm/*` to ../client/src;
 *  - give client/src files THIS package's react, router, query, dnd-kit, lucide and date-fns
 *    (otherwise they resolve ../client/node_modules: two Reacts → «Invalid hook call», two
 *    routers → NavLink outside the MemoryRouter context);
 *  - swap lib/api for a throwing stub (a scene that pulls it in transitively is a bug, but the
 *    bundle must not drag fetch/JWT code and `import.meta.env` along);
 *  - define `import.meta.env` (Vite-only syntax) as an empty object.
 *
 * Browser: never hardcode a path here — npm scripts pass `--browser-executable=$REMOTION_BROWSER`.
 */
import path from 'node:path';
import { Config } from '@remotion/cli/config';
import { webpack } from '@remotion/bundler';

// The CLI always runs from video/ (npm scripts); __dirname is not reliable in the bundled config.
const root = process.cwd();
const nm = (p: string) => path.join(root, 'node_modules', p);

const DEDUPED = [
  'react-dom',
  'react-router-dom',
  'react-router',
  '@tanstack/react-query',
  'lucide-react',
  'date-fns',
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  '@dnd-kit/utilities',
] as const;

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

Config.overrideWebpackConfig((config) => {
  const prevAlias = config.resolve?.alias;
  if (Array.isArray(prevAlias)) throw new Error('remotion.config.ts: expected object resolve.alias');
  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...(prevAlias ?? {}),
        '@crm': path.resolve(root, '../client/src'),
        'react/jsx-runtime': nm('react/jsx-runtime.js'),
        'react/jsx-dev-runtime': nm('react/jsx-dev-runtime.js'),
        react: nm('react'),
        ...Object.fromEntries(DEDUPED.map((p) => [p, nm(p)])),
      },
    },
    plugins: [
      ...(config.plugins ?? []),
      new webpack.NormalModuleReplacementPlugin(
        /client[\\/]src[\\/]lib[\\/]api(\.ts)?$/,
        path.join(root, 'src/providers/mockApi.ts'),
      ),
      new webpack.DefinePlugin({ 'import.meta.env': '{}' }),
    ],
  };
});
