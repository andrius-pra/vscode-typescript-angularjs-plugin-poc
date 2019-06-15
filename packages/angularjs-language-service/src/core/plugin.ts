import * as mockRequire from 'mock-require';
import * as ts_module from 'typescript/lib/tsserverlibrary';
import { Logger } from './logger';
import { PLUGIN_MARKER } from './constants';
import { AngularJSLanguageService, createAngularJSLanguageService } from './angularjs-language-service';
import { TypeScriptServiceHost } from './typescript-host';

const isAngularJSLanguageServiceMarker = Symbol(PLUGIN_MARKER);
const projectHostMap = new WeakMap<any, TypeScriptServiceHost>();

export function init({ typescript }: { typescript: typeof ts_module }) {
    let logger: Logger | undefined;

    mockRequire('typescript', typescript);

    return { create, getExternalFiles };

    function getExternalFiles(project: any): string[] | undefined {
        logger!.info('getExternalFiles');
        let list: string[] | undefined;
        const host = projectHostMap.get(project);
        if (host) {
            list = host.getExternalFiles();
        }
        return list;
    }

    function create(info: ts.server.PluginCreateInfo) {
        try {
            logger = Logger.forPlugin(info);
            logger.info('Create');

            const serviceHost = new TypeScriptServiceHost(info.languageServiceHost, logger, info.languageService, info.serverHost, info.project);
            const ls = createAngularJSLanguageService(serviceHost as any);
            serviceHost.setSite(ls);
            projectHostMap.set(info.project, serviceHost);
            return new AngularJSPlugin(typescript, serviceHost, ls, logger, info.project, info.languageService).decorate();
        }
        catch (e) {
            throw e;
        }
    }
}

export class AngularJSPlugin {

    constructor(
        private readonly ts: typeof ts_module,
        private readonly typeScriptServiceHost: TypeScriptServiceHost,
        private readonly languageService: AngularJSLanguageService,
        private readonly logger: Logger,
        private readonly project: ts_module.server.Project,
        private readonly originalLanguageService: ts_module.LanguageService
    ) {
        this.logger.info('AngularJSPlugin loaded');
    }

    public decorate() {
        if ((this.originalLanguageService as any)[isAngularJSLanguageServiceMarker]) {
            // Already decorated
            return;
        }

        const intercept: Partial<ts.LanguageService> = {
            getSemanticDiagnostics: (...args) => this.getSemanticDiagnostics(...args),
            getSyntacticDiagnostics: (...args) => this.getSyntacticDiagnostics(...args),
            getCompletionsAtPosition: (...args) => this.getCompletionsAtPosition(...args),
            getApplicableRefactors: (...args) => this.getApplicableRefactors(...args),
            getSignatureHelpItems: (...args) => this.getSignatureHelpItems(...args),
            getCompletionEntryDetails: (...args) => this.getCompletionEntryDetails(...args),
            getQuickInfoAtPosition: (...args) => this.getQuickInfoAtPosition(...args),
            findReferences: (...args) => this.findReferences(...args),
            getDocumentHighlights: (...args) => this.getDocumentHighlights(...args),
            getDefinitionAndBoundSpan: (...args) => this.getDefinitionAndBoundSpan(...args),
            getTypeDefinitionAtPosition: (...args) => this.getTypeDefinitionAtPosition(...args),
            getDefinitionAtPosition: (...args) => this.getDefinitionAtPosition(...args),
            findRenameLocations: (...args) => this.findRenameLocations(...args),
            organizeImports: (...args) => this.organizeImports(...args)
        }

        return new Proxy(this.originalLanguageService, {
            get: (target: any, property: PropertyKey) => {
                if (property === isAngularJSLanguageServiceMarker) {
                    return true;
                }
                return Reflect.get(intercept, property) || Reflect.get(target, property);
            },
        });
    }

    private isValidSourceFile(fileName: string): boolean {
        const program = this.typeScriptServiceHost.tsService.getProgram();
        const sourceFile = program && program.getSourceFile(fileName);
        return !!sourceFile;
    }

    private getCompletionsAtPosition(
        fileName: string,
        position: number,
        options: ts.GetCompletionsAtPositionOptions | undefined
    ): ts.WithMetadata<ts.CompletionInfo> | undefined {
        const emptyResult = {
            isGlobalCompletion: false,
            isMemberCompletion: false,
            isNewIdentifierLocation: false,
            entries: []
        };

        let result: ts.WithMetadata<ts.CompletionInfo> | undefined = emptyResult;
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.getCompletionsAtPosition(fileName, position, options) || emptyResult;
        }

        const ours = this.languageService.getCompletionsAtPosition(fileName, position, options);

        if (ours && ours.entries.length) {
            result.entries.push(...ours.entries);
        }

        return result;
    }

    private getSemanticDiagnostics(fileName: string): ts_module.Diagnostic[] {

        let result: ts_module.Diagnostic[] = [];
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.getSemanticDiagnostics(fileName);
        }

        const ours = this.languageService.getSemanticDiagnostics(fileName);
        result.push(...ours)

        return result;
    }

    private getSyntacticDiagnostics(fileName: string): ts_module.DiagnosticWithLocation[] {

        let result: ts_module.DiagnosticWithLocation[] = [];
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.getSyntacticDiagnostics(fileName);
        }

        const ours = this.languageService.getSyntacticDiagnostics(fileName);
        result.push(...ours)

        return result;
    }

    private findReferences(
        fileName: string,
        position: number
    ): ts_module.ReferencedSymbol[] | undefined {

        let result: ts_module.ReferencedSymbol[] = [];
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.findReferences(fileName, position) || [];
        }

        const ours = this.languageService.findReferences(fileName, position) || [];
        result.push(...ours);

        return result;
    }

    private getDefinitionAndBoundSpan(
        fileName: string,
        position: number
    ): ts_module.DefinitionInfoAndBoundSpan | undefined {

        let base: ts_module.DefinitionInfoAndBoundSpan | undefined;
        if (this.isValidSourceFile(fileName)) {
            base = this.originalLanguageService.getDefinitionAndBoundSpan(fileName, position);
        }

        const ours = this.languageService.getDefinitionAndBoundSpan(fileName, position);

        if (!base || !base.definitions) {
            return ours;
        } else if (!ours || !ours.definitions) {
            return base;
        } else {
            const result: ts_module.DefinitionInfoAndBoundSpan | undefined = {
                definitions: [...ours.definitions, ...base.definitions],
                textSpan: base.textSpan
            }
            return result;
        }
    }

    private getQuickInfoAtPosition(
        fileName: string,
        position: number
    ): ts_module.QuickInfo | undefined {

        let result: ts_module.QuickInfo | undefined;
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.getQuickInfoAtPosition(fileName, position);
            if (result) {
                return result
            }
        }

        result = this.languageService.getQuickInfoAtPosition(fileName, position);

        return result;
    }

    private findRenameLocations(
        fileName: string,
        position: number,
        findInStrings: boolean,
        findInComments: boolean,
        providePrefixAndSuffixTextForRename?: boolean
    ): ReadonlyArray<ts_module.RenameLocation> | undefined {

        let result: ReadonlyArray<ts_module.RenameLocation> = [];
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.findRenameLocations(fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename) || [];
        }
        const ours = this.languageService.findRenameLocations(fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename) || [];

        return [...result, ...ours];
    }

    private getApplicableRefactors(
        fileName: string,
        positionOrRange: number | ts_module.TextRange,
        preferences: ts_module.UserPreferences | undefined
    ): ts_module.ApplicableRefactorInfo[] {

        let result: ts_module.ApplicableRefactorInfo[] = [];
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.getApplicableRefactors(fileName, positionOrRange, preferences);
        }

        return result;
    }

    private getSignatureHelpItems(
        fileName: string,
        position: number,
        options: ts_module.SignatureHelpItemsOptions | undefined
    ): ts_module.SignatureHelpItems | undefined {

        let result: ts_module.SignatureHelpItems | undefined;
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.getSignatureHelpItems(fileName, position, options);
        }

        return result;
    }

    private getCompletionEntryDetails(
        fileName: string,
        position: number,
        name: string,
        formatOptions: ts_module.FormatCodeOptions | ts_module.FormatCodeSettings | undefined, source: string | undefined, preferences: ts_module.UserPreferences | undefined
    ): ts_module.CompletionEntryDetails | undefined {

        let result: ts_module.CompletionEntryDetails | undefined;
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.getCompletionEntryDetails(fileName, position, name, formatOptions, source, preferences);
        }

        return result;
    }

    private getDocumentHighlights(
        fileName: string,
        position: number,
        filesToSearch: string[]
    ): ts_module.DocumentHighlights[] | undefined {

        let result: ts_module.DocumentHighlights[] | undefined | undefined;
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.getDocumentHighlights(fileName, position, filesToSearch);
        }

        return result;
    }

    private getTypeDefinitionAtPosition(
        fileName: string,
        position: number
    ): ReadonlyArray<ts_module.DefinitionInfo> | undefined {

        let result: ReadonlyArray<ts_module.DefinitionInfo> | undefined;
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.getTypeDefinitionAtPosition(fileName, position);
        }

        return result;
    }

    private getDefinitionAtPosition(
        fileName: string,
        position: number
    ): ReadonlyArray<ts_module.DefinitionInfo> | undefined {

        let result: ReadonlyArray<ts_module.DefinitionInfo> | undefined;
        if (this.isValidSourceFile(fileName)) {
            result = this.originalLanguageService.getDefinitionAtPosition(fileName, position);
        }

        return result;
    }

    private organizeImports(
        scope: ts_module.OrganizeImportsScope,
        formatOptions: ts_module.FormatCodeSettings,
        preferences: ts_module.UserPreferences | undefined
    ): ReadonlyArray<ts_module.FileTextChanges> {

        let result: ReadonlyArray<ts_module.FileTextChanges> = [];
        if (this.isValidSourceFile(scope.fileName)) {
            result = this.originalLanguageService.organizeImports(scope, formatOptions, preferences);
        }

        return result;
    }
}
