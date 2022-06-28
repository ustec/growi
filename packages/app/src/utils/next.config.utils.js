// workaround by https://github.com/martpie/next-transpile-modules/issues/143#issuecomment-817467144

const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.resolve(__dirname, '../../../../node_modules');


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const listScopedPackages = (scopes) => {
  const scopedPackages = [];

  fs.readdirSync(nodeModulesPath)
    .filter(name => scopes.includes(name))
    .forEach((scope) => {
      fs.readdirSync(path.resolve(nodeModulesPath, scope))
        .filter(name => !name.startsWith('.'))
        .forEach((folderName) => {
          const { name, ignoreTranspileModules } = require(path.resolve(
            nodeModulesPath,
            scope,
            folderName,
            'package.json',
          ));
          if (!ignoreTranspileModules) {
            scopedPackages.push(name);
          }
        });
    });

  return scopedPackages;
};