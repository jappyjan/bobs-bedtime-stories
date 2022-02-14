const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const path = require('path');

module.exports = (config) => {
  const plugins = [
    ...(config.plugins ?? []),
  ];

  if (process.env.NX_WITH_SW === 'YES' || process.env.NODE_ENV === 'production') {
    const swSrc = path.resolve('apps/frontend/web/src/sw.ts');
    plugins.push(
      new WorkboxWebpackPlugin.InjectManifest({
        swSrc,
        swDest: "sw.js",
      }),
    );
  }

  return {
    ...config,
    node: {
      ...(config.node ?? {}),
      global: true,
    },
    resolve: {
      ...(config.resolve ?? {}),
      fallback: {
        ...(config.resolve ?? {fallback: {}}).fallback,
        assert: false,
        stream: false,
      }
    },
    module: {
      ...(config.module ?? {}),
      rules: [
        ...(config.module?.rules ?? []),
        {
          test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: '[name].[ext]',
                outputPath: 'fonts/'
              }
            }
          ]
        }
      ]
    },
    plugins,
  };
};
