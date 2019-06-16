import { NgTemplateAST, NgTemplateParser } from '../utils/template-parser';
import { TemplateSource } from '../types/template-source';
import { TypeScriptServiceHost } from './typescript-host';

export class TemplateRegistry {
    private templateVersions = new Map<string, number | string>();
    private templateAST = new Map<string, NgTemplateAST>();

    constructor(private host: TypeScriptServiceHost) { }

    public getTemplateAST(templateSource: TemplateSource | undefined): NgTemplateAST | undefined {
        if (!templateSource) {
            return undefined;
        }

        const cachedVersion = this.templateVersions.get(templateSource.filename);

        if (cachedVersion === templateSource.version) {
            return this.templateAST.get(templateSource.filename);
        }

        const ast = new NgTemplateParser(templateSource.source).parse();
        this.templateVersions.set(templateSource.filename, templateSource.version);
        this.templateAST.set(templateSource.filename, ast);

        return ast;
    }

    public getTemplateASTByFilename(filename: string, position?: number): NgTemplateAST | undefined {
        return this.getTemplateAST(this.host.getTemplateAt(filename, position));
    }
}