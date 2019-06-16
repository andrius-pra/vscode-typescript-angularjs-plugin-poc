import { Context } from '../types/context';
import { ngNodeKind, NgAttrib, NgTag } from '../utils/template-parser';
import { getAttributeNames, getShortName } from '../core/helpers';
import ts = require('typescript/lib/tsserverlibrary');
import { GENERATED_TEMPLATE_EXTENTION } from '../core/constants';
import { ComponentMetata } from '../types/component-metadata';

export function findReferences(
    context: Context,
    fileName: string,
    position: number
): ts.ReferencedSymbol[] | undefined {
    let result: ts.ReferencedSymbol[] | undefined;

    if (context.templateAst) {
        const currNode = context.templateAst.getNodeAtPosition(position);

        if (currNode === undefined) {
            return result;
        }

        switch (currNode.kind) {
            case ngNodeKind.StartTag:
            case ngNodeKind.SelfClosingTag:
            case ngNodeKind.EndTag:
                const node = currNode as NgTag;
                if (node && node.name) {
                    result = getHtmlElementReferences(node.name, context);
                }
                break;
            case ngNodeKind.Attribute:
                const ngAttr = (currNode as NgAttrib);
                if (ngAttr.valuePos !== undefined && ngAttr.value !== undefined && position >= ngAttr.valuePos) {
                    result = getInterpolationReferences(context);
                } else {
                    result = getHtmlAttributeReferences(currNode as NgAttrib, context, true);
                }
                break;
            case ngNodeKind.Interpolation:
                result = getInterpolationReferences(context);
                break;
        }
    }

    return result;
}

function getHtmlElementReferences(htmlTagName: string, context: Context): ts.ReferencedSymbol[] | undefined {
    const componentList = context.metadataResolver.getDirectivesForHtmlElement(htmlTagName, true);
    const result: ts.ReferencedSymbol[] = [];

    for (const component of componentList) {
        const item: ts.ReferencedSymbol = {
            references: [],
            definition: {
                displayParts: [{
                    kind: 'typescript',
                    text: component.className,
                }],
                kind: ts.ScriptElementKind.classElement,
                name: component.className,
                containerKind: ts.ScriptElementKind.unknown,
                containerName: component.location.fileName,
                fileName: component.location.fileName,
                textSpan: {
                    start: component.location.span!.start,
                    length: component.location.span!.end - component.location.span!.start,
                },
            },
        };

        const files = context.metadataResolver.getTemplateReferences();
        files.forEach(file => {
            const html = context.templateRegistry.getTemplateASTByFilename(file);

            if (html) {
                html.getNodesOf(htmlTagName).forEach(node => {

                    const offset = node.kind === ngNodeKind.EndTag ? 2 : 1;
                    const end = node.startPos + offset + ((node as NgTag).name || '').length;
                    item.references.push({
                        fileName: file,
                        textSpan: {
                            start: node.startPos + offset,
                            length: end - node.startPos - offset,
                        },
                        isDefinition: false,
                        isWriteAccess: true,
                    });
                });
            }
        });

        result.push(item);
    }

    if (result && result.length) {
        return result;
    }

    return result;
}

function getInterpolationReferences(context: Context): ts.ReferencedSymbol[] | undefined {
    return undefined;
}

function getHtmlAttributeReferences(currNode: NgAttrib, context: Context, includeTSReferences: boolean): ts.ReferencedSymbol[] | undefined {
    const result: ts.ReferencedSymbol[] = [];

    if ((!currNode.name || !currNode || !currNode.parent)) {
        return result;
    }

    const attributes = getAttributeNames(currNode.parent);
    const componentList = context.metadataResolver.getDirectivesForHtmlAttribute(currNode.parent.name, undefined, attributes);
    for (const component of componentList) {
        const references = findComponentBindingReferences(component, currNode.parent.name || '', currNode.name, context, includeTSReferences);
        for (const item of references) {
            if (!item.definition.fileName.endsWith(GENERATED_TEMPLATE_EXTENTION)) {
                result.push(item);
            }
        }
    }
    return result;
}

function findComponentBindingReferences(component: ComponentMetata, componentName: string, bindingName: string, context: Context, includeTSReferences: boolean = false) {
    const name = getShortName(bindingName);

    const result: ts.ReferencedSymbol[] = [];
    if (component) {
        const item: ts.ReferencedSymbol = {
            references: [],
            definition: {
                displayParts: [{
                    kind: 'typescript',
                    text: component.className,
                }],
                kind: ts.ScriptElementKind.classElement,
                name: component.className,
                containerKind: ts.ScriptElementKind.unknown,
                containerName: component.location.fileName,
                fileName: component.location.fileName,
                textSpan: {
                    start: component.location.span!.start,
                    length: component.location.span!.end - component.location.span!.start,
                },
            },
        };

        if (component.isForElement && componentName === component.angularJSSelector) {
            const htmlElementComponentAttribute = component.bindings.find(x => x.angularJSSelector === name);
            if (htmlElementComponentAttribute) {

                // if (includeTSReferences && htmlElementComponentAttribute.location.span !== undefined) {
                //     const tsReferences = host.tsService.getReferencesAtPosition(htmlElementComponentAttribute.location.fileName, htmlElementComponentAttribute.location.span.start);
                //     if (tsReferences) {
                //         for (const ref of tsReferences) {
                //             if (!ref.fileName.endsWith(".html.ts")) {
                //                 result.push({
                //                     fileName: ref.fileName,
                //                     span: {
                //                         start: ref.textSpan.start,
                //                         end: ref.textSpan.start + ref.textSpan.length
                //                     }
                //                 })
                //             }
                //         }
                //     }
                // }

                item.references.push({
                    fileName: htmlElementComponentAttribute.location.fileName,
                    textSpan: {
                        start: htmlElementComponentAttribute.location.span!.start,
                        length: htmlElementComponentAttribute.location.span!.start - htmlElementComponentAttribute.location.span!.start,
                    },
                    isDefinition: true,
                    isWriteAccess: true,
                });

                result.push(item);

                const files = context.metadataResolver.getTemplateReferences();
                files.forEach(file => {

                    const html = context.templateRegistry.getTemplateASTByFilename(file);
                    if (html) {
                        html.getNodesOf(component.angularJSSelector, htmlElementComponentAttribute.angularJSSelector).forEach(node => {

                            const end = node.startPos + ((node as NgAttrib).name || '').length;
                            item.references.push({
                                fileName: file,
                                textSpan: {
                                    start: node.startPos,
                                    length: end - node.startPos,
                                },
                                isDefinition: true,
                                isWriteAccess: true,
                            });
                        });
                    }
                });
            }
        }

        if (
            (component.isForAttribute && component.angularJSSelector === name) ||
            (component.isForAttribute && component.angularJSSelector !== name && component.bindings.find(x => x.angularJSSelector === name) != null)
        ) {
            // result = getHtmlAttributeReferencesWithAttributeRestriction(context, component.angularJSSelector, name);

            // const htmlAttributeComponentAttribute = component.bindings.find(x => x.angularJSSelector === name);
            // let location = component.location;
            // if (htmlAttributeComponentAttribute && htmlAttributeComponentAttribute.location) {
            //     location = htmlAttributeComponentAttribute.location
            // }
            // result.push(location);
        }
        // if (component.restrictAttribute && component.angularJSSelector !== name && component.bindings.find(x => x.angularJSSelector == name) != null) {
        //     result = getHtmlAttributeReferencesWithAttributeRestriction(context, name, component.angularJSSelector);
        // }

    }
    return result;
}