import { TemplateSource } from './template-source';
import { ComponentMetata } from './component-metadata';
import { MetadataResolver } from '../core/metadata-resolver';
import { NgTemplateAST } from '../utils/template-parser';
import { TemplateRegistry } from '../core/template-registry';

export class Context {

    constructor(
        public template: TemplateSource | undefined,
        public metadataResolver: MetadataResolver,
        public component: ComponentMetata | undefined,
        public templateAst: NgTemplateAST | undefined,
        public templateRegistry: TemplateRegistry) {
    }

    public getText() {
        return this.template!.source;
    }
}