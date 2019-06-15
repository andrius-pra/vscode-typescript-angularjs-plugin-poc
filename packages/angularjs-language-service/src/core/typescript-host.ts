import { Context } from "../types/context";
import { AngularJSLanguageService } from "./angularjs-language-service";
import { Logger } from "./logger";
import { ComponentMetata } from "../types/component-metadata";
import { MetadataResolver } from "./metadata-resolver";

export class TypeScriptServiceHost {
    private service!: AngularJSLanguageService;
    private get program() { return this.tsService.getProgram(); }

    private templateReferences?: string[];
    private fileVersions: Map<string, number> = new Map<string, number>();
    private fileToComponent: Map<string, ComponentMetata> = new Map<string, ComponentMetata>();
    private analyzedModules?: ComponentMetata[];
    private lastProgram: ts.Program | undefined;
    private modulesOutOfDate: boolean = true;
    private metadataResolver: MetadataResolver;

    constructor(
        private host: ts.LanguageServiceHost,
        private logger: Logger,
        public tsService: ts.LanguageService,
        private serverHost: ts.server.ServerHost,
        private project: ts.server.Project
    ) {
        this.metadataResolver = new MetadataResolver();
    }

    public setSite(service: AngularJSLanguageService) { this.service = service; }

    public getExternalFiles(): string[] | undefined {
        let list: string[] = [];

        try {
            const program = this.program;
            if (program && program.getRootFileNames().length) {
                this.updateAnalyzedModules();
                list = [...this.getTemplateReferences()];
            }
        } catch (e) {
            this.logger.info(`Failed to getExternalFiles: ${e.toString()}`);
            this.logger.info(`Stack trace: ${e.stack}`);
            return undefined;
        }

        return list;
    }

    public getContext(fileName: string, position?: number): Context {
        return new Context();
    }

    private updateAnalyzedModules(): void {
        this.validate();
        if (this.modulesOutOfDate) {
            this.analyzedModules = undefined;
            this.templateReferences = undefined;
            this.fileToComponent.clear();
            this.ensureAnalyzedModules();
            this.modulesOutOfDate = false;
        }
    }

    private getTemplateReferences(): string[] {
        this.ensureTemplateMap();

        return this.templateReferences || [];
    }

    private ensureTemplateMap() {
        if (!this.fileToComponent || !this.templateReferences) {
            const fileToComponent = new Map<string, ComponentMetata>();
            const analyzedModules = this.getAnalyzedModules();
            const templateReference: string[] = [];
            analyzedModules.forEach(c => {
                if (c.templateFileName) {
                    fileToComponent.set(c.templateFileName, c);
                    templateReference.push(c.templateFileName);
                }
            });
            this.fileToComponent = fileToComponent;
            this.templateReferences = templateReference;
        }
    }

    private getAnalyzedModules(): ComponentMetata[] {
        this.validate();
        if (this.modulesOutOfDate) {
            this.updateAnalyzedModules();
        }

        return this.ensureAnalyzedModules();
    }

    private ensureAnalyzedModules(): ComponentMetata[] {

        const program = this.program;
        if (!this.analyzedModules && program) {
            this.metadataResolver.loadMetadata();
            this.analyzedModules = this.metadataResolver.getAnalyzedModules();
        }
        return this.analyzedModules || [];
    }

    private validate() {
        let update = false;
        const program = this.program;

        if (!program) {
            return;
        }

        if (!update) {
            for (const sourceFile of program.getSourceFiles().filter(x => !x.fileName.endsWith('.html') && !x.fileName.endsWith('.html.ts') && !x.fileName.endsWith('.d.ts'))) {
                const previousVersion = this.fileVersions.get(sourceFile.fileName);
                // TODO: try to find a better way to get file version
                const newVersion = (sourceFile as any).version;

                if (previousVersion === undefined || previousVersion !== newVersion) {
                    this.fileVersions.set(sourceFile.fileName, newVersion);
                }
            }
            update = true;
        }

        if (update && this.lastProgram !== program) {
            this.clearCaches();
            this.lastProgram = program;
        }
    }

    private clearCaches() {
        this.modulesOutOfDate = true;
    }

    private normalizeSlashes(path: string): string {
        return path.replace(/\\/g, "/");
    }
}