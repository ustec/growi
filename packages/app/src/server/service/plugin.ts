import path from 'path';

import { GrowiPlugin, GrowiPluginOrigin } from '~/interfaces/plugin';
import loggerFactory from '~/utils/logger';
import { resolveFromRoot } from '~/utils/project-dir-utils';

const logger = loggerFactory('growi:service:PluginService');


const pluginStoringPath = resolveFromRoot('tmp/plugins');

export class PluginService {

  static async install(origin: GrowiPluginOrigin): Promise<void> {
    // TODO: download
    // TODO: detect plugins
    // TODO: save documents
    return;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  static async detectPlugins(origin: GrowiPluginOrigin, installedPath: string, parentPackageJson?: any): Promise<GrowiPlugin[]> {
    const packageJsonPath = path.resolve(pluginStoringPath, installedPath, 'package.json');
    const packageJson = await import(packageJsonPath);

    const { growiPlugin } = packageJson;
    const {
      name: packageName, description: packageDesc, author: packageAuthor,
    } = parentPackageJson ?? packageJson;


    if (growiPlugin == null) {
      throw new Error('This package does not include \'growiPlugin\' section.');
    }

    // detect sub plugins for monorepo
    if (growiPlugin.isMonorepo && growiPlugin.packages != null) {
      const plugins = await Promise.all(
        growiPlugin.packages.map(async(subPackagePath) => {
          const subPackageInstalledPath = path.join(installedPath, subPackagePath);
          return this.detectPlugins(origin, subPackageInstalledPath, packageJson);
        }),
      );
      return plugins.flat();
    }

    if (growiPlugin.types == null) {
      throw new Error('\'growiPlugin\' section must have a \'types\' property.');
    }

    const plugin = {
      isEnabled: true,
      installedPath,
      origin,
      meta: {
        name: growiPlugin.name ?? packageName,
        desc: growiPlugin.desc ?? packageDesc,
        author: growiPlugin.author ?? packageAuthor,
        types: growiPlugin.types,
      },
    };

    logger.info('Plugin detected => ', plugin);

    return [plugin];
  }

  // /**
  //  * list plugin module objects
  //  *  that starts with 'growi-plugin-' or 'crowi-plugin-'
  //  * borrowing from: https://github.com/hexojs/hexo/blob/d1db459c92a4765620343b95789361cbbc6414c5/lib/hexo/load_plugins.js#L17
  //  *
  //  * @returns array of objects
  //  *   [
  //  *     { name: 'growi-plugin-...', requiredVersion: '^1.0.0', installedVersion: '1.0.0' },
  //  *     { name: 'growi-plugin-...', requiredVersion: '^1.0.0', installedVersion: '1.0.0' },
  //  *     ...
  //  *   ]
  //  *
  //  * @memberOf PluginService
  //  */
  // listPlugins() {
  //   const packagePath = resolveFromRoot('package.json');

  //   // Make sure package.json exists
  //   if (!fs.existsSync(packagePath)) {
  //     return [];
  //   }

  //   // Read package.json and find dependencies
  //   const content = fs.readFileSync(packagePath);
  //   const json = JSON.parse(content);
  //   const deps = json.dependencies || {};

  //   const pluginNames = Object.keys(deps).filter((name) => {
  //     return /^@growi\/plugin-/.test(name);
  //   });

  //   return pluginNames.map((name) => {
  //     return {
  //       name,
  //       requiredVersion: deps[name],
  //       installedVersion: this.getVersion(name),
  //     };
  //   });
  // }

  // /**
  //  * list plugin module names that starts with 'crowi-plugin-'
  //  *
  //  * @returns array of plugin names
  //  *
  //  * @memberOf PluginService
  //  */
  // listPluginNames() {
  //   const plugins = this.listPlugins();
  //   return plugins.map((plugin) => { return plugin.name });
  // }

  // getVersion(packageName) {
  //   const packagePath = resolveFromRoot(`../../node_modules/${packageName}/package.json`);

  //   // Read package.json and find version
  //   const content = fs.readFileSync(packagePath);
  //   const json = JSON.parse(content);
  //   return json.version || '';
  // }

}