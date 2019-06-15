import * as ts_module from 'typescript/lib/tsserverlibrary';

import { PLUGIN_ID } from './constants';

export class Logger {
    public static forPlugin(info: ts_module.server.PluginCreateInfo) {
        return new Logger(info.project.projectService.logger);
    }

    private constructor(private readonly _logger: ts_module.server.Logger) { }

    public info(message: string) {
        this._logger.info(`[${PLUGIN_ID}] ${JSON.stringify(message)}`);
    }
}