import { Span } from './span';

export interface TemplateSource {
    readonly filename: string;
    readonly source: string;
    readonly version: string | number;
    readonly span: Span;
}
