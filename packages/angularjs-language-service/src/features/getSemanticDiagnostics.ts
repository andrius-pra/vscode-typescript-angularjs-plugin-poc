import { Context } from '../types/context';
import ts = require('typescript/lib/tsserverlibrary');
import { PLUGIN_ID } from '../core/constants';

export function getSemanticDiagnostics(
    context: Context,
    fileName: string
): ts.Diagnostic[] {

    const result: ts.Diagnostic[] = [];
    if (context.templateAst && context.templateAst.errors) {
        for (const error of context.templateAst.errors) {
            result.push({
                file: undefined,
                start: error.start,
                length: error.end - error.start,
                messageText: error.message,
                category: ts.DiagnosticCategory.Error,
                code: 0,
                source: PLUGIN_ID,
            });
        }
    }
    return result;
}