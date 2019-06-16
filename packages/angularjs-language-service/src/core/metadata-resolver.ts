import { ComponentMetata } from '../types/component-metadata';
import { MetadataCollector } from './metadata-collector';
import { ComponentMetataVersion } from '../types/component-metadata-version';
import { HTML_TEMPLATE_EXTENTION, GENERATED_TEMPLATE_EXTENTION } from './constants';
import { getShortName } from './helpers';

export class MetadataResolver {
    private lastProgram: ts.Program | undefined;

    private _components: ComponentMetata[] = [];
    private _componentCache = new Map<string, ComponentMetata>();
    private templateToComponent = new Map<string, ComponentMetata>();
    private _componentResolveCache = new Map<string, ComponentMetataVersion>();
    private fileVersions: Map<string, number> | undefined;
    private templateReferences?: string[];

    constructor(private rootPath: string) { }

    public ensureCacheValid(program?: ts.Program) {
        let update = false;

        if (!program) {
            return;
        }

        const files = program.getSourceFiles().filter(x => !x.fileName.endsWith(HTML_TEMPLATE_EXTENTION) && !x.fileName.endsWith(GENERATED_TEMPLATE_EXTENTION) && !x.fileName.endsWith('.d.ts'));
        if (!this.fileVersions) {
            this.fileVersions = new Map<string, number>();
            for (const sourceFile of files) {
                this.fileVersions.set(sourceFile.fileName, (sourceFile as any).version);
            }
            update = true;
        }

        if (!update && this.fileVersions && program) {
            for (const sourceFile of files) {
                const version = (sourceFile as any).version;
                if (this.fileVersions.get(sourceFile.fileName) !== version) {
                    update = true;
                    this.fileVersions.set(sourceFile.fileName, version);
                }
            }
        }

        if (update && this.lastProgram !== program) {
            this.lastProgram = program;
            this.loadMetadata(program);
        }
    }

    public getAnalyzedModules(program?: ts.Program, updateCache = true): ComponentMetata[] {
        return this._components;
    }

    public getTemplateReferences(program?: ts.Program, updateCache = true): string[] {
        return this.templateReferences || [];
    }

    public getAllComponents() {
        return this._components;
    }

    public getComponentFromTemplateFileName(fileName: string): ComponentMetata | undefined {
        return this.templateToComponent.get(fileName);
    }

    public getDirectivesForHtmlAttribute(exactTagName: string | undefined, containsAttributeName: string | undefined, attributes: string[]) {
        const shortName = getShortName(containsAttributeName);
        const exactAttributeNameList = attributes.map(attr => getShortName(attr) || '');
        const result: ComponentMetata[] = [];
        for (const directive of this._components) {
            if (directive.isForElement && exactTagName !== '' && exactTagName !== undefined && directive.angularJSSelector === exactTagName) {
                result.push(directive);
            } else if (directive.isForAttribute && shortName !== undefined && directive.angularJSSelector.indexOf(shortName) !== -1) {
                result.push(directive);
                continue;
            } else if (directive.isForAttribute && exactAttributeNameList
                .find(attributeName => directive.angularJSSelector === attributeName)) {
                result.push(directive);
                continue;
            }
        }
        return result;
    }

    public getComponentListWithAttributeRestriction(...exactAttributeNameList: string[]) {
        const result: ComponentMetata[] = [];
        const attributes = exactAttributeNameList.map(attr => getShortName(attr) || '');

        for (const directive of this._components) {
            if (directive.isForAttribute) {
                if (attributes.indexOf(directive.angularJSSelector) !== -1) {
                    result.push(directive);
                }
            }
        }
        return result;
    }

    public getDirectivesForHtmlElement(tagName: string, exact: boolean = false) {
        const result: ComponentMetata[] = [];
        for (const directive of this._components) {
            if (exact && directive.isForElement && directive.angularJSSelector === tagName) {
                result.push(directive);
                continue;
            } else if (!exact && directive.isForElement && directive.angularJSSelector.indexOf(tagName) !== -1) {
                result.push(directive);
                continue;
            }
        }
        return result;
    }

    private loadMetadata(program: ts.Program) {
        const collector = new MetadataCollector(program.getTypeChecker(), this.rootPath, this._componentResolveCache);
        this._components = collector.collect(program.getSourceFiles());

        this._componentCache.clear();
        this.templateToComponent.clear();
        this.templateReferences = [];
        for (const component of this._components) {
            this._componentCache.set(component.filename, component);
            if (component.templateFileName) {
                this.templateToComponent.set(component.templateFileName, component);
                this.templateReferences.push(component.templateFileName);
            }
        }
    }
}