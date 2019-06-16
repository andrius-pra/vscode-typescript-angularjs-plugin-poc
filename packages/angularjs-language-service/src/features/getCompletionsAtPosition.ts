import { Context } from '../types/context';
import ts = require('typescript/lib/tsserverlibrary');
import { ngNodeKind, NgTag, NgAttrib } from '../utils/template-parser';
import { getShortName } from '../core/helpers';

export function getCompletionsAtPosition(
    context: Context,
    fileName: string,
    position: number,
    options: ts.GetCompletionsAtPositionOptions | undefined
): ts.CompletionInfo | undefined {

    const result: ts.CompletionInfo = {
        entries: [],
        isGlobalCompletion: false,
        isMemberCompletion: false,
        isNewIdentifierLocation: false,
    };

    if (context.templateAst) {
        const currNode = context.templateAst.getNodeAtPosition(position);

        if (currNode === undefined) {
            return undefined;
        }

        switch (currNode.kind) {
            case ngNodeKind.StartTag:
            case ngNodeKind.SelfClosingTag:
                const tag = currNode as NgTag;
                if (position - tag.startPos - tag.name!.length > 1) {
                    result.entries = attributeCompletions(tag, '', context);
                } else {
                    result.entries = getElementCompletions(tag, context);
                }
                break;
            case ngNodeKind.Attribute:
                const ngAttr = (currNode as NgAttrib);

                if (ngAttr.valuePos !== undefined && ngAttr.value !== undefined && position >= ngAttr.valuePos) {
                    // getExpressionCompletions
                } else if (ngAttr.valuePos === undefined && ngAttr.endPos < position && ngAttr.parent && ngAttr.parent.attributes) {
                    result.entries = attributeCompletions(currNode.parent!, '', context);
                } else {
                    let attribNameValue = ngAttr.name || '';
                    const attribPos = position - ngAttr.startPos;
                    attribNameValue = attribNameValue.substr(0, attribPos);
                    result.entries = attributeCompletions(currNode.parent!, attribNameValue, context);
                }
                break;
            case ngNodeKind.Interpolation:
                // queryGeneratedCode
                break;

            case ngNodeKind.EndTag:
                break;
        }

    }

    return result;
}

function getElementCompletions(currNode: NgTag, context: Context): ts.CompletionEntry[] {
    const result: Array<ts.CompletionEntry & ts.CompletionEntryDetails> = [];
    if (context.component) {
        const components = context.metadataResolver.getAllComponents();
        for (const component of components) {
            result.push(createCompletionEntry(component.angularJSSelector, ts.ScriptElementKind.classElement, component.description, !!component.custom));
        }
        return result;
    }
    return result;
}

function attributeCompletions(tag: NgTag, attributeName: string, context: Context): ts.CompletionEntry[] {
    const result: Array<ts.CompletionEntry & ts.CompletionEntryDetails> = [];
    const attributes = getAttributeNames(tag);
    const components = context.metadataResolver.getDirectivesForHtmlAttribute(tag.name, attributeName, attributes);
    for (const component of components) {

        if (component.isForElement && component.angularJSSelector === tag.name) {
            for (const attribute of component.bindings) {
                result.push(createCompletionEntry(attribute.angularJSSelector, ts.ScriptElementKind.functionElement, attribute.description, !!component.custom));
            }
        }

        if (component.isForAttribute && component.angularJSSelector === attributeName) {
            if (component.location) {
                result.push(createCompletionEntry(component.angularJSSelector, ts.ScriptElementKind.functionElement, component.description, !!component.custom));
            }
        }

        if (component.isForAttribute && attributes.indexOf(component.angularJSSelector) !== -1) {
            for (const attribute of component.bindings) {
                if (attribute.angularJSSelector === attributeName) {
                    result.push(createCompletionEntry(attribute.angularJSSelector, ts.ScriptElementKind.functionElement, attribute.description, !!component.custom));
                }
            }
        }

    }
    return result;
}

function createCompletionEntry(selector: string, kind: ts.ScriptElementKind, description: string | undefined, custom: boolean) {
    const completion: ts.CompletionEntry & ts.CompletionEntryDetails = {
        name: selector,
        kind,
        kindModifiers: '',
        sortText: selector,
        isRecommended: true,
        documentation: [],
        displayParts: [],
    };

    if (description) {
        completion.documentation!.push({
            text: description,
            kind: 'typescript',
        });
    }
    if (custom && kind === ts.ScriptElementKind.functionElement) {
        completion.name = 'data-' + selector;
        completion.sortText = '5data-' + selector;
        completion.insertText = `data-${selector}=""`;
    }

    return completion;
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