import { Span } from './span';
export interface Location {
    version: number;
    fileName: string;
    span?: Span;
    offset?: number;
}
