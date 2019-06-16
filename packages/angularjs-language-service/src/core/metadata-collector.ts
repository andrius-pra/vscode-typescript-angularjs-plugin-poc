import { ComponentMetata, AngularJSComponentMetata } from '../types/component-metadata';
import { ComponentMetataVersion } from '../types/component-metadata-version';
import ts = require('typescript/lib/tsserverlibrary');
import { kebabToCamel, camelToKebab } from './helpers';
import { GENERATED_TEMPLATE_EXTENTION, HTML_TEMPLATE_EXTENTION, ONE_WAY_BINDING, TWO_WAY_BINDING, ATTRIBUTE_BINDING, EXPRESSION_BINDING } from './constants';
import { ComponentKind } from '../types/component-kind';
import { ComponentBinding } from '../types/component-binding';
import { ComponentBindingKind } from '../types/component-binding-kind';
import { LocalVariable } from '../types/local-variable';

export class MetadataCollector {
    private components: ComponentMetata[] = [];
    private partialComponents: { [id: number]: Partial<ComponentMetata> };

    constructor(private checker: ts.TypeChecker, private rootPath: string, private resolveCache: Map<string, ComponentMetataVersion>) {
        this.components = [];
        this.partialComponents = {};
    }

    public collect(sourceFiles: ReadonlyArray<ts.SourceFile>): ComponentMetata[] {
        for (const file of sourceFiles) {
            if (file.fileName.endsWith(GENERATED_TEMPLATE_EXTENTION) || file.fileName.endsWith(HTML_TEMPLATE_EXTENTION)) {
                continue;
            }

            const oldC = this.resolveCache.get(file.fileName);
            const version = ((file as any).version) || -1;
            if (oldC && oldC.version === version) {
                if (oldC.component) {
                    this.components.push(oldC.component);
                }
                continue;
            } else {
                this.resolveCache.set(file.fileName, { version });
            }

            ts.forEachChild(file, x => this.visitNode(x));
        }

        // tslint:disable-next-line: forin
        for (const key in this.partialComponents) {
            const component = this.partialComponents[key];

            if (component.bindings != null &&
                component.id != null &&
                component.angularSelector != null &&
                component.angularJSSelector != null &&
                component.originalSelector != null &&
                component.className != null &&
                component.filename != null &&
                component.kind != null &&
                component.className != null &&
                component.location != null) {

                const fullComponent: ComponentMetata | AngularJSComponentMetata = {
                    isForAttribute: !!component.isForAttribute,
                    isForElement: !!component.isForElement,
                    id: component.id,
                    bindings: component.bindings,
                    angularSelector: component.angularSelector,
                    angularJSSelector: component.angularJSSelector,
                    originalSelector: component.originalSelector,
                    className: component.className,
                    filename: component.filename,
                    kind: component.kind,
                    location: component.location,
                    templateFileName: component.templateFileName,
                    custom: component.custom,
                };

                if (fullComponent.kind === ComponentKind.AngularJS) {
                    (fullComponent as any).controllerAs = (component as any).controllerAs;
                }

                this.components.push(fullComponent);
                this.resolveCache.get(fullComponent.filename)!.component = fullComponent;
            }
        }

        return this.components;
    }

    protected IsAngularJSDirectiveDecorator(decorator: ts.Decorator) {
        return this.isMatch(decorator, 'angular-ts-decorators/types/directive.d.ts', 'Directive');
    }

    protected IsAngularJSComponentDecorator(decorator: ts.Decorator): boolean {
        return this.isMatch(decorator, 'angular-ts-decorators/types/component.d.ts', 'Component');
    }

    protected IsAngularJSInjectableDecorator(decorator: ts.Decorator): boolean {
        return this.isMatch(decorator, 'angular-ts-decorators/types/injectable.d.ts', 'Injectable');
    }

    private visitNode(node: ts.Node) {
        if (!node) {
            return;
        }

        switch (node.kind) {
            case ts.SyntaxKind.CallExpression:
                this.visitCallExpression(node as ts.CallExpression);
                break;
            case ts.SyntaxKind.Decorator:
                this.visitDecorator(node as ts.Decorator);
                break;
        }
        ts.forEachChild(node, x => this.visitNode(x));
    }

    private visitDecorator(node: ts.Decorator) {
        if (this.IsAngularJSComponentDecorator(node) || this.IsAngularJSDirectiveDecorator(node)) {
            this.visitAngularJSComponentDecorator(node as ts.Decorator);
        }
    }

    private visitCallExpression(node: ts.CallExpression) {

    }

    private visitAngularJSComponentDecorator(decorator: ts.Decorator) {
        const expression = decorator.expression as ts.CallExpression;
        const obj = expression.arguments[0] as ts.ObjectLiteralExpression;
        const type = this.checker.getTypeAtLocation(decorator.parent);
        const id = (type.symbol as any).id; // todo change to other solution;

        const component: Partial<AngularJSComponentMetata> = {
            id,
            isForAttribute: this.IsAngularJSDirectiveDecorator(decorator),
            isForElement: this.IsAngularJSComponentDecorator(decorator),
            bindings: [],
            kind: ComponentKind.AngularJS,
            controllerAs: '$ctrl',
            custom: true,
        };

        for (const x of obj.properties.filter(y => y.name)) {
            if (x.name!.getText() === 'selector' && x.kind === ts.SyntaxKind.PropertyAssignment) {
                const assignment = x as ts.PropertyAssignment;
                component.originalSelector = assignment.initializer.getText().slice(1, -1);
                component.angularJSSelector = camelToKebab(component.originalSelector);
                component.angularSelector = kebabToCamel(component.originalSelector);
                component.className = type.symbol.name;
                component.filename = type.symbol.valueDeclaration.getSourceFile().fileName;
                component.location = {
                    fileName: type.symbol.valueDeclaration.getSourceFile().fileName,
                    version: (type.symbol.valueDeclaration.getSourceFile() as any).version,
                    span: {
                        start: assignment.initializer.getStart() + 1,
                        end: assignment.initializer.getEnd() - 1,
                    },
                };
            } else if (x.name!.getText() === 'template') {
                const assignment = x as ts.PropertyAssignment;
                if (assignment.initializer.kind === ts.SyntaxKind.CallExpression) {
                    const requiredExpression = assignment.initializer as ts.CallExpression;
                    let templateFilename = requiredExpression.arguments[0].getText().slice(1, -1);
                    if (templateFilename.startsWith('./')) {
                        templateFilename = templateFilename.slice(2);
                    }
                    const src = decorator.getSourceFile();
                    component.templateFileName = src.fileName.substr(0, src.fileName.lastIndexOf('/') + 1) + templateFilename;
                }
            } else if (x.name!.getText() === 'restrict') {
                const assignment = x as ts.PropertyAssignment;
                const restrict = assignment.initializer.getText().slice(1, -1);
                component.isForAttribute = restrict.indexOf('A') !== -1;
                component.isForElement = restrict.indexOf('E') !== -1;
            }
        }

        const properties = this.checker.getPropertiesOfType(type);
        for (const componentProperty of properties) {
            // input <, output &
            if (componentProperty.valueDeclaration && componentProperty.valueDeclaration.decorators && componentProperty.valueDeclaration.decorators.length) {
                const propDecorator = componentProperty.valueDeclaration.decorators[0];
                const expression2 = propDecorator.expression as ts.CallExpression;
                const type2 = this.checker.getTypeAtLocation(expression2.expression);

                if (!type2 || !type2.symbol || !type2.symbol.valueDeclaration) {
                    continue;
                }
                const decoratorDeclaration = type2.symbol.valueDeclaration;
                if (decoratorDeclaration.kind === ts.SyntaxKind.FunctionDeclaration) {
                    const decoratorFn = decoratorDeclaration as ts.FunctionDeclaration;

                    if (decoratorFn.name === undefined || (decoratorFn.name.getText() !== 'Input' && decoratorFn.name.getText() !== 'Output')) {
                        continue;
                    }

                    const { start, end, locals }: { start: number; end: number; locals: LocalVariable[]; } = this.tryParseLocals(componentProperty);

                    const propertyDeclaration = componentProperty.valueDeclaration as ts.PropertyDeclaration;
                    const info: ComponentBinding = {
                        description: '',
                        angularSelector: camelToKebab(componentProperty.getName()),
                        angularJSSelector: kebabToCamel(componentProperty.getName()),
                        originalSelector: componentProperty.getName(),
                        kind: decoratorFn.name.getText() === 'Input' ? ComponentBindingKind.OneWayBinding : ComponentBindingKind.ExpressiomBinding,
                        location: {
                            fileName: propertyDeclaration.getSourceFile().fileName,
                            version: (type2.symbol.valueDeclaration.getSourceFile() as any).version,
                            span: {
                                start,
                                end,
                            },
                        },
                        localVariables: locals,
                        imports: [],
                    };

                    if (expression2.arguments.length && expression2.arguments[0].kind === ts.SyntaxKind.StringLiteral) {
                        const argument = expression2.arguments[0];
                        const stringLiteral = argument as ts.StringLiteral;

                        if (stringLiteral.text[0] === ONE_WAY_BINDING) {
                            info.kind = ComponentBindingKind.OneWayBinding;
                        } else if (stringLiteral.text[0] === ONE_WAY_BINDING) {
                            info.kind = ComponentBindingKind.OneWayBinding;
                        } else if (stringLiteral.text[0] === TWO_WAY_BINDING) {
                            info.kind = ComponentBindingKind.TwoWayBinding;
                        } else if (stringLiteral.text[0] === ATTRIBUTE_BINDING) {
                            info.kind = ComponentBindingKind.AttrbuteBinding;
                        } else if (stringLiteral.text[0] === EXPRESSION_BINDING) {
                            info.kind = ComponentBindingKind.ExpressiomBinding;
                        }
                    }

                    try {
                        info.valueType = ((type2 as any).symbol.members[info.originalSelector].valueDeclaration).type.getText();
                    } catch (w) {
                        info.valueType = undefined;
                    }

                    if (propertyDeclaration.type && propertyDeclaration.type && propertyDeclaration.type.getText() /*&& propertyDeclaration.type.kind ==  ts.SyntaxKind.UnionType*/) {
                        info.valueType = propertyDeclaration.type.getText();
                        // info.imports = this.TryParseImports(propertyDeclaration.type);
                    }
                    component.bindings!.push(info);
                }
            }
        }

        this.partialComponents[id] = component;
    }

    private isMatch(decorator: ts.Decorator, filename: string, name: string): boolean {
        if (!decorator || decorator.expression.kind !== ts.SyntaxKind.CallExpression) {
            return false;
        }

        const expression = decorator.expression as ts.CallExpression;
        const typeAtLocation = this.checker.getTypeAtLocation(expression.expression);

        if (!typeAtLocation || !typeAtLocation.symbol) {
            return false;
        }

        const sourcefile = typeAtLocation.symbol.declarations[0].getSourceFile();
        if (sourcefile.fileName.endsWith(filename) && typeAtLocation.symbol.getEscapedName() === name) {
            return true;
        }

        return false;
    }

    private tryParseLocals(ssss: ts.Symbol) {
        let start = ssss.valueDeclaration.getStart();
        let end = ssss.valueDeclaration.getEnd();
        const locals: LocalVariable[] = [];
        if (ssss.valueDeclaration === undefined || ssss.valueDeclaration.kind !== ts.SyntaxKind.PropertyDeclaration) {
            return { start, end, locals };
        }

        const propertyDeclaration = ssss.valueDeclaration as ts.PropertyDeclaration;
        start = propertyDeclaration.name.getStart();
        end = propertyDeclaration.name.getEnd();

        if (propertyDeclaration.type && propertyDeclaration.type.kind === ts.SyntaxKind.TypeReference) {
            const functionType = propertyDeclaration.type as ts.TypeReferenceNode;
            if (functionType.typeName.getText() === 'EventEmitter') {
                if (!functionType || !functionType.typeArguments || functionType.typeArguments.length !== 1) {
                    return { start, end, locals };
                }

                const obj = {
                    name: '$event',
                    type: functionType.typeArguments[0].getText(),
                    location: {
                        fileName: functionType.typeArguments[0].getSourceFile().fileName,
                        span: {
                            start: functionType.typeArguments[0].getStart(),
                            end: functionType.typeArguments[0].getEnd(),
                        },
                    },
                } as LocalVariable;
                locals.push(obj);
            }
            return { start, end, locals };
        } else {
            return { start, end, locals };
        }
    }
}