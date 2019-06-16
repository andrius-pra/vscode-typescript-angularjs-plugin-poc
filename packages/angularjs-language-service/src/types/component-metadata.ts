import { ComponentBinding } from './component-binding';
import { ComponentKind } from './component-kind';
import { Location } from './location';

export interface ComponentMetata {
    isForElement: boolean;
    isForAttribute: boolean;
    id: number;
    templateFileName?: string;
    kind: ComponentKind;
    location: Location;
    filename: string;
    className: string;
    angularSelector: string;
    angularJSSelector: string;
    originalSelector: string;
    bindings: ComponentBinding[];
    custom?: true;
    description?: string;
}

export interface AngularComponentMetata extends ComponentMetata {
    kind: ComponentKind.Angular;
}

export interface AngularDowngradedComponentMetata extends ComponentMetata {
    kind: ComponentKind.AngularDowngraded;
}

export interface AngularJSComponentMetata extends ComponentMetata {
    kind: ComponentKind.AngularJS;
    controllerAs: string;
}
