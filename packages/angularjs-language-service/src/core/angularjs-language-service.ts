import { TypeScriptServiceHost } from './typescript-host';
import { findReferences } from '../features/findReferences';
import { getCompletionsAtPosition } from '../features/getCompletionsAtPosition';
import { getCompletionEntryDetails } from '../features/getCompletionEntryDetails';
import { getDefinitionAndBoundSpan } from '../features/getDefinitionAndBoundSpan';
import { getSemanticDiagnostics } from '../features/getSemanticDiagnostics';
import { getSyntacticDiagnostics } from '../features/getSyntacticDiagnostics';
import { getQuickInfoAtPosition } from '../features/getQuickInfoAtPosition';
import { findRenameLocations } from '../features/findRenameLocations';

export function createAngularJSLanguageService(host: TypeScriptServiceHost): AngularJSLanguageService {
    return new AngularJSLanguageService(host);
}

export class AngularJSLanguageService {
    constructor(public host: TypeScriptServiceHost) { }

    public getCompletionsAtPosition(fileName: string, position: number, options: ts.GetCompletionsAtPositionOptions | undefined): ts.CompletionInfo | undefined {
        const context = this.host.getContext(fileName, position);
        return getCompletionsAtPosition(context, fileName, position, options);
    }

    public getCompletionEntryDetails(fileName: string, position: number, name: string, formatOptions: ts.FormatCodeOptions | ts.FormatCodeSettings | undefined, source: string | undefined, preferences: ts.UserPreferences | undefined): ts.CompletionEntryDetails | undefined {
        const context = this.host.getContext(fileName, position);
        return getCompletionEntryDetails(context, fileName, position, name, formatOptions, source, preferences);
    }

    public getDefinitionAndBoundSpan(fileName: string, position: number): ts.DefinitionInfoAndBoundSpan | undefined {
        const context = this.host.getContext(fileName, position);
        return getDefinitionAndBoundSpan(context, fileName, position);
    }

    public findReferences(fileName: string, position: number): ts.ReferencedSymbol[] | undefined {
        const context = this.host.getContext(fileName, position);
        return findReferences(context, fileName, position);
    }

    public getSemanticDiagnostics(fileName: string): ts.Diagnostic[] {
        const context = this.host.getContext(fileName);
        return getSemanticDiagnostics(context, fileName);
    }

    public getSyntacticDiagnostics(fileName: string): ts.DiagnosticWithLocation[] {
        const context = this.host.getContext(fileName);
        return getSyntacticDiagnostics(context, fileName);
    }

    public getQuickInfoAtPosition(fileName: string, position: number): ts.QuickInfo | undefined {
        const context = this.host.getContext(fileName, position);
        return getQuickInfoAtPosition(context, fileName, position);
    }

    public findRenameLocations(fileName: string, position: number, findInStrings: boolean, findInComments: boolean, providePrefixAndSuffixTextForRename?: boolean): ReadonlyArray<ts.RenameLocation> | undefined {
        const context = this.host.getContext(fileName, position);
        return findRenameLocations(context, fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename);
    }

}