import { Context } from '../types/context';
import { ngNodeKind, NgTag, NgAttrib } from '../utils/template-parser';
import ts = require('typescript/lib/tsserverlibrary');
import { getShortName } from '../core/helpers';
import { Location } from '../types/location';

export function getDefinitionAndBoundSpan(
    context: Context,
    fileName: string,
    position: number
): ts.DefinitionInfoAndBoundSpan | undefined {

    let result: ts.DefinitionInfoAndBoundSpan | undefined;

    if (context.templateAst) {
        const currNode = context.templateAst.getNodeAtPosition(position);

        if (currNode === undefined) {
            return undefined;
        }

        switch (currNode.kind) {
            case ngNodeKind.StartTag:
            case ngNodeKind.SelfClosingTag:
                result = getComponentDefinition(currNode as NgTag, context);
                break;
            case ngNodeKind.EndTag:
                result = getComponentDefinition(currNode as NgTag, context);
                break;
            case ngNodeKind.Attribute:
                const node = currNode as NgAttrib;
                if (node.valuePos !== undefined && position >= node.valuePos) {
                    result = getAttributeValueDefinition(currNode as NgAttrib, context);
                } else {
                    result = getAttributeDefinition(currNode as NgAttrib, context);
                }
                break;
            case ngNodeKind.Interpolation:
                break;
        }

    }

    return result;
}

function getComponentDefinition(currNode: NgTag, context: Context): ts.DefinitionInfoAndBoundSpan | undefined {
    if (!currNode || !currNode.name) {
        return undefined;
    }
    const components = context.metadataResolver.getDirectivesForHtmlElement(currNode.name);

    for (const component of components) {
        if (component.isForElement && component.angularJSSelector === currNode.name) {
            if (component.location) {
                return createDefinitionInfo(component.location);
            } else {
                return undefined;
            }
        }
    }
    return undefined;
}

function createDefinitionInfo(location: Location): ts.DefinitionInfoAndBoundSpan | undefined {
    return {
        definitions: [
            {
                fileName: location.fileName,
                textSpan: {
                    start: location.span!.start,
                    length: location.span!.end - location.span!.start,
                },
                name: '',
                kind: ts.ScriptElementKind.unknown,
                containerName: location.fileName,
                containerKind: ts.ScriptElementKind.unknown,
            },
        ],
        textSpan: {
            start: location.span!.start,
            length: location.span!.end - location.span!.start,
        },
    };
}

function getAttributeDefinition(currNode: NgAttrib, context: Context): ts.DefinitionInfoAndBoundSpan | undefined {
    if (!currNode || !currNode.parent) {
        return undefined;
    }

    const shortAttributeNameList = getAttributeNames(currNode.parent);

    const components = context.metadataResolver.getDirectivesForHtmlAttribute(currNode.parent.name, undefined, shortAttributeNameList);

    const name = getShortName(currNode.name);

    for (const component of components) {
        if (component.isForElement && component.angularJSSelector === currNode.parent.name) {
            for (const attribute of component.bindings) {
                if (attribute.angularJSSelector === name) {
                    if (attribute.location) {
                        return createDefinitionInfo(attribute.location);
                    } else {
                        return undefined;
                    }
                }
            }
        }
        if (component.isForAttribute && component.angularJSSelector === name) {
            if (component.location) {
                return createDefinitionInfo(component.location);
            } else {
                return undefined;
            }
        }

        if (component.isForAttribute && shortAttributeNameList.indexOf(component.angularJSSelector) !== -1) {
            for (const attribute of component.bindings) {
                if (attribute.angularJSSelector === name) {
                    if (attribute.location) {
                        return createDefinitionInfo(attribute.location);
                    } else {
                        return undefined;
                    }
                }
            }
        }
    }
    return undefined;
}

function getAttributeValueDefinition(currNode: NgAttrib, context: Context): ts.DefinitionInfoAndBoundSpan | undefined {
    return undefined;
}

function getAttributeNames(tag: NgTag): string[] {
    const result = [];
    for (const attr of tag.attributes) {
        if (attr.name) {
            result.push(getShortName(attr.name)!);
        }
    }
    return result;
}