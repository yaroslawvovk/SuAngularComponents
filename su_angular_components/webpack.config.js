const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const mf = require("@angular-architects/module-federation/webpack");
const path = require("path");
const share = mf.share;

const sharedMappings = new mf.SharedMappings();
sharedMappings.register(
  path.join(__dirname, 'tsconfig.json'),
  []);

module.exports = {
  output: {
    uniqueName: "su_angular_components",
    publicPath: "auto",
    scriptType: 'text/javascript'
  },
  optimization: {
    runtimeChunk: false
  },   
  resolve: {
    alias: {
      ...sharedMappings.getAliases(),
        lodash: 'lodash-es',
    }
  },
  plugins: [
    new ModuleFederationPlugin({
        name: "su_angular_components",
        filename: "remoteEntry.js",
        exposes: {
            './RemoteEntry': './/src/main.ts',
        },
        shared: share({
          ...sharedMappings.getDescriptors()
        })
    }),
    sharedMappings.getPlugin()
  ],
};
