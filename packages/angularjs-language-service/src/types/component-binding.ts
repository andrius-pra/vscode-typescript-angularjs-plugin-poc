import { Location } from './location';
import { ComponentBindingKind } from './component-binding-kind';
import { LocalVariable } from './local-variable';

export interface ComponentBinding {
    angularSelector: string;
    angularJSSelector: string;
    originalSelector: string;
    description: string;
    location: Location;
    localVariables: LocalVariable[];
    kind: ComponentBindingKind;
    valueType?: string;
    imports: string[];
}