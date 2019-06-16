import { Context } from '../types/context';
import { AngularJSLanguageService } from './angularjs-language-service';
import { Logger } from './logger';
import { MetadataResolver } from './metadata-resolver';
import { TemplateSource } from '../types/template-source';
import { TemplateRegistry } from './template-registry';

export class TypeScriptServiceHost {
    private service!: AngularJSLanguageService;
    private get program() { return this.tsService.getProgram(); }

    private metadataResolver: MetadataResolver;
    private templateRegistry: TemplateRegistry;

    constructor(
        private host: ts.LanguageServiceHost,
        private logger: Logger,
        public tsService: ts.LanguageService,
        private serverHost: ts.server.ServerHost,
        private project: ts.server.Project
    ) {
        this.metadataResolver = new MetadataResolver(this.normalizeSlashes(this.serverHost.resolvePath('.')) + '/');
        this.templateRegistry = new TemplateRegistry(this);
    }

    public setSite(service: AngularJSLanguageService) { this.service = service; }

    public getExternalFiles(): string[] | undefined {
        let list: string[] | undefined;

        try {
            const program = this.program;
            this.metadataResolver.ensureCacheValid(program);
            list = [...this.metadataResolver.getTemplateReferences(program)];
        } catch (e) {
            this.logger.info(`Failed to getExternalFiles: ${e.toString()}`);
            this.logger.info(`Stack trace: ${e.stack}`);
            return undefined;
        }

        return list;
    }

    public getContext(fileName: string, position?: number): Context {
        this.metadataResolver.ensureCacheValid();
        const template = this.getTemplateAt(fileName, position);

        const component = this.metadataResolver.getComponentFromTemplateFileName(fileName);
        if (component) {
            const templateAst = this.templateRegistry.getTemplateAST(template);
            return new Context(template, this.metadataResolver, component, templateAst, this.templateRegistry);
        } else {
            return new Context(template, this.metadataResolver, component, undefined, this.templateRegistry);
        }

    }
    public getTemplateAt(filename: string, position?: number): TemplateSource | undefined {
        const componentType = this.metadataResolver.getComponentFromTemplateFileName(filename);

        if (componentType) {
            const snapshot = this.host.getScriptSnapshot(filename);
            if (componentType && snapshot) {
                const source = snapshot.getText(0, snapshot.getLength());
                return {
                    source,
                    span: { start: 0, end: source.length },
                    version: this.host.getScriptVersion(filename),
                    filename,
                };
            }
        } else {
            const sourceFile = this.getSourceFile(filename);
            if (sourceFile) {
                const snapshot = this.host.getScriptSnapshot(filename);
                if (snapshot) {
                    const source = snapshot.getText(0, snapshot.getLength());
                    return {
                        source,
                        span: { start: 0, end: source.length },
                        version: this.host.getScriptVersion(sourceFile.fileName),
                        filename,
                    };
                }

            }
        }
    }

    private normalizeSlashes(path: string): string {
        return path.replace(/\\/g, '/');
    }

    private getSourceFile(fileName: string): ts.SourceFile | undefined {
        const program = this.program;
        if (program) {
            return program.getSourceFile(fileName);
        }
        return undefined;
    }
}