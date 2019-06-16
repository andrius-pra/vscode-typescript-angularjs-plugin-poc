const selfClosingTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

export enum ngNodeKind {
    Root,         // Enclosing document. No name or attributes, just children.
    SelfClosingTag,
    StartTag,
    Attribute,
    EndTag,
    Text,
    Comment,      // Includes enclosing <!-- & -->
    Interpolation, // Includes enclosing {{ & }}
}

export interface NgNode {
    kind: ngNodeKind;
    fullStartPos: number; // Includes leading whitespace
    startPos: number;
    endPos: number; // Position after final char. Text length = endPos - startPos
    parent: NgTag | undefined;
    getText?: () => string;
}

export interface NgNamedNode extends NgNode {
    name: string | undefined; // Used directly for closing tags
}

export interface NgTag extends NgNamedNode {
    attributes: NgAttrib[];
    children: NgNode[]; // Final child will be closing tag for non-self-closing tags
}

// TODO: Have a flag to indicate if the value is an expression, and maybe an AST property if it is.
export interface NgAttrib extends NgNamedNode {
    value?: string;
    valuePos?: number;
}

interface CodeMapping {
    pointInTemplate: number;
    startRangeInTemplate: number;
    endRangeInTemplate: number;
    pointInGenCode: number;
    startRangeInGenCode: number;
    endRangeInGenCode: number;
}

export interface InterpolationInfo {
    text: string; start: number; end: number;
}

export interface ErrorInfo {
    message: string;
    start: number;
    end: number;
}

export class NgTemplateAST {
    public rootNode: NgTag | undefined;
    public errors: ErrorInfo[] = [];

    constructor() {
        this.errors = [];
    }

    public getAttributes(...attrubuteShortNameList: string[]) {
        if (!this.rootNode) return [];

        const nodes: NgAttrib[] = [];
        visit(this.rootNode);

        function getAttributeShorNameList(node: NgTag | undefined) {
            if (!node) {
                return [];
            }
            return node.attributes.map(attr => {
                let attributeName = attr.name;
                if (attributeName && attributeName.startsWith('data-')) {
                    attributeName = attributeName.substring(5);
                }
                return attributeName;
            });
        }

        function intersection<T>(array1: T[], array2: T[]) {
            return array1.filter(value => -1 !== array2.indexOf(value));
        }

        function visit(node: NgNode) {
            if (node.kind === ngNodeKind.Attribute) {
                const attr = node as NgAttrib;
                const attributes = getAttributeShorNameList(attr.parent);
                let attributeName = attr.name;
                if (attributeName && attributeName.startsWith('data-')) {
                    attributeName = attributeName.substring(5);
                }
                if (attrubuteShortNameList[0] === attributeName &&
                    intersection(attrubuteShortNameList, attributes).length === attrubuteShortNameList.length) {
                    nodes.push(attr);
                }

                // if(attributeName === 'min-date'){
                //     let breakpoint = 10;
                // }
                // ;

                // if(attrubuteShortNameList.filter(a=>a === attributeName).length === attrubuteShortNameList.length){
                //     nodes.push(attr);
                // }
            }
            if ((node as NgTag).children) {
                (node as NgTag).children.forEach(visit);
                (node as NgTag).attributes.forEach(visit);
            }
        }
        return nodes;
    }

    public getAllAttributes() {
        if (!this.rootNode) return [];

        const nodes: NgAttrib[] = [];
        visit(this.rootNode);

        function visit(node: NgNode) {
            if (node.kind === ngNodeKind.StartTag || node.kind === ngNodeKind.EndTag || node.kind === ngNodeKind.SelfClosingTag) {

            } else if (node.kind === ngNodeKind.Attribute) {
                nodes.push(node as NgAttrib);
            }
            if ((node as NgTag).children) {
                (node as NgTag).children.forEach(visit);
                (node as NgTag).attributes.forEach(visit);
            }
        }
        return nodes;
    }

    public getAllTags() {
        if (!this.rootNode) return [];

        const nodes: NgTag[] = [];
        visit(this.rootNode);

        function visit(node: NgNode) {
            if (node.kind === ngNodeKind.StartTag || node.kind === ngNodeKind.EndTag || node.kind === ngNodeKind.SelfClosingTag) {
                nodes.push(node as NgTag);
            } else if (node.kind === ngNodeKind.Attribute) {

            }
            if ((node as NgTag).children) {
                (node as NgTag).children.forEach(visit);
                (node as NgTag).attributes.forEach(visit);
            }
        }
        return nodes;
    }

    public getAllInterpolations() {
        let results: InterpolationInfo[] = [];
        if (!this.rootNode) return results;

        visit(this.rootNode);

        function visit(node: NgNode) {
            if (node.kind === ngNodeKind.StartTag || node.kind === ngNodeKind.EndTag || node.kind === ngNodeKind.SelfClosingTag) {

            } else if (node.kind === ngNodeKind.Attribute) {
                results = results.concat(getInterpolationsFromAttribute(node as NgAttrib));
            } else if (node.kind === ngNodeKind.Interpolation) {
                const ngNode = (node as NgNode);
                if (ngNode && ngNode.getText) {
                    const interpText = ngNode.getText();
                    results.push({
                        text: interpText,
                        start: (node as NgNode).startPos,
                        end: (node as NgNode).endPos,
                    });
                }
            }

            if ((node as NgTag).children) {
                (node as NgTag).children.forEach(visit);
                (node as NgTag).attributes.forEach(visit);
            }
        }
        return results;

        function getInterpolationsFromAttribute(attrib: NgAttrib) {
            const result: InterpolationInfo[] = [];
            let attributeValue = attrib.value;

            if (attributeValue === undefined || attributeValue === '' || attrib.valuePos === undefined) {
                return result;
            }

            let indexStart = -1;
            let indexEnd = -1;
            // tslint:disable-next-line: no-conditional-assignment
            while ((indexEnd = attributeValue.lastIndexOf('}}')) !== -1 && (indexStart = attributeValue.lastIndexOf('{{')) !== -1) {
                const interpolation = attributeValue.substring(indexStart, indexEnd + 2);
                result.push({
                    text: interpolation,
                    start: attrib.valuePos + indexStart + 2,
                    end: attrib.valuePos + indexEnd,
                });
                attributeValue = attributeValue.substring(0, indexStart);
            }
            return result;
        }
    }

    public getNodesOf(tagName: string, attrubuteName?: string) {
        if (!this.rootNode) return [];

        const nodes: NgNode[] = [];
        visit(this.rootNode);

        function visit(node: NgNode) {
            if (node.kind === ngNodeKind.StartTag || node.kind === ngNodeKind.EndTag || node.kind === ngNodeKind.SelfClosingTag) {
                const tag = (node as NgTag);
                if (!attrubuteName && tag.name === tagName) {
                    nodes.push(tag);
                }
            } else if (node.kind === ngNodeKind.Attribute && attrubuteName) {
                let name = attrubuteName;
                if (name.startsWith('data-')) {
                    name = name.substring(5);
                }

                const attr = node as NgAttrib;
                if ((attr.name === name || attr.name === 'data-' + name) && attr.parent && attr.parent.name === tagName) {
                    nodes.push(attr);
                }
            }
            if ((node as NgTag).children) {
                (node as NgTag).children.forEach(visit);
                (node as NgTag).attributes.forEach(visit);
            }
        }
        return nodes;
    }

    public getNodeAtPosition(pos: number): NgNode | undefined {
        if (!this.rootNode) return undefined;

        // The AST is a tree of nodes, where every non-leave Node is an Open tag (incl. Root).
        // Locate the first Node where endPos > pos (or the very last node)
        // Just keep drilling down until there are no more children.
        let lastNode: NgNode = this.rootNode;
        while (true) {
            if (lastNode.kind !== ngNodeKind.StartTag && lastNode.kind !== ngNodeKind.Root) {
                // Doesn't have any children, so this is the Node
                break;
            } else {
                const openTag = (lastNode as NgTag);
                if (openTag.endPos > pos || !openTag.children.length) {
                    break;
                } else {
                    // Move through the children updating lastNode, stopping if one ends after pos.
                    (lastNode as NgTag).children.some(elem => {
                        lastNode = elem;
                        return this.getFullEndPos(elem) > pos;
                    });
                }
            }
        }
        if (lastNode.kind === ngNodeKind.StartTag || lastNode.kind === ngNodeKind.SelfClosingTag) {
            const attrib = this.getAttribAtPosition(lastNode as NgTag, pos);
            if (attrib) {
                lastNode = attrib;
            }
        }
        return lastNode;
    }

    // Utility to work with open tags. Finds the endPos including children (and close tags).
    public getFullEndPos(tag: NgNode) {
        if (tag.kind !== ngNodeKind.StartTag && tag.kind !== ngNodeKind.Root) {
            return tag.endPos;
        } else {
            const openTag = tag as NgTag;
            if (!openTag.children.length) {
                return openTag.endPos;
            } else {
                return openTag.children[openTag.children.length - 1].endPos;
            }
        }
    }

    public getAttribAtPosition(node: NgTag, pos: number): NgAttrib | undefined {
        let result: NgAttrib | undefined;
        node.attributes.forEach(attrib => {
            if (pos >= attrib.startPos && pos <= attrib.endPos) {
                result = attrib;
            }
        });
        return result;
    }
}

export class NgTemplateParser {
    // TODO: Make ascii case-insensitive for element & attribute names
    public currentPos: number;
    public ast: NgTag | undefined;
    public stats = {
        openTags: 0,
        closeTags: 0,
        selfClosingTags: 0,
        attributes: 0,
        comments: 0,
        interpolations: 0,
        textNodes: 0,
        totalNodes() {
            return this.openTags + this.closeTags + this.selfClosingTags +
                this.attributes + this.comments + this.interpolations + this.textNodes;
        },
    };
    private result: NgTemplateAST;

    // Creating a new scanner will automatically populate the AST and error list.
    constructor(public text: string) {
        this.currentPos = 0;
        this.result = new NgTemplateAST();
    }

    public parse() {
        this.currentPos = 0;
        this.result = new NgTemplateAST();
        this.result.rootNode = this.scan();
        return this.result;
    }

    public getNodeText(node: NgNode) {
        return this.text.substring(node.startPos, node.endPos);
    }

    public scan(): NgTag | undefined {
        if (!this.text) {
            return undefined;
        }

        const root: NgTag = {
            kind: ngNodeKind.Root,
            fullStartPos: 0,
            startPos: 0,
            endPos: 0,
            name: '__root__',
            attributes: [],
            children: [],
            parent: undefined,
        };

        // Effectively we start by pushing the root node on the stack, and scanning for children (parseTagChildren).
        // findNextChild iteratively looks for a comment, text, interpolation, or tag, until it reaches an close tag (the parent's) or EOF.
        // findNextChild pushes each child it finds onto the 'childen' array of the current top of stack.
        // Parsing of text simply runs to the next "<", ">" or "{{"
        // Parsing of an interpolation runs until the next "}}"
        // Parsing of a comment runs to the closing "-->"
        // When an tag start is found, parseTag is called.
        // ParseTag pushes itself on the stack, and calls parseTagAttributes until it encounters "/>" or ">".
        // If it encounters "/>", it completes the tag and returns.
        // If it encounters ">", it calls parseTagChildren.

        const stack: NgTag[] = [root];
        let nextChild: NgNode | undefined;
        // tslint:disable-next-line: no-conditional-assignment
        while (nextChild = this.findNextChild()) {
            nextChild.parent = stack[stack.length - 1];
            stack[stack.length - 1].children.push(nextChild);
            // For open or close tags, move up or down the stack
            switch (nextChild.kind) {
                case ngNodeKind.StartTag:
                    const node = nextChild as NgTag;
                    // Start of child tag found, make the top of the stack.
                    stack.push(nextChild as NgTag);
                    break;
                case ngNodeKind.EndTag:
                    if ((nextChild as NgNamedNode).name === (stack[stack.length - 1].name)) {
                        // Close tag for current top of stack. Pop from stack, add as final child, and continue
                        stack.pop();
                    } else {
                        const tag = stack[stack.length - 1];
                        if (!tag.name || selfClosingTags.indexOf(tag.name) !== -1) {
                            const msg = (stack.length > 1) ?
                                `Expected closing tag named "${stack[stack.length - 1].name}"` :
                                `Unexpected closing tag`;

                            this.result.errors.push({
                                message: msg,
                                start: nextChild.startPos,
                                end: this.currentPos,
                            } as ErrorInfo);
                        }
                    }
                    break;
                default:
                    // Add the child node to the current tag on top of stack
                    break;
            }
        }

        // Check for unmatched tags
        while (true) {
            const unmatched = stack.pop();
            if (!unmatched || unmatched === root) break;
            this.result.errors.push({
                message: 'Unmatched opening tag',
                start: unmatched.startPos,
                end: unmatched.endPos,
            } as ErrorInfo);
        }

        return root;
    }

    public findNextChild(): NgNode | undefined {
        const fullStartPos = this.currentPos;
        this.skipWhitespace();
        const ch = this.getChar();
        switch (ch) {
            case '\x00':
                // Did we have trailing text or not?
                if (this.currentPos === fullStartPos) {
                    return undefined;
                } else {
                    this.stats.textNodes++;
                    return {
                        kind: ngNodeKind.Text,
                        fullStartPos,
                        startPos: this.currentPos,
                        endPos: this.currentPos,
                        parent: undefined,
                    };
                }
            case '<':
                if (this.peekChar(0) === '!' && this.peekChar(1) === '-' && this.peekChar(2) === '-') {
                    return this.parseComment(fullStartPos);
                } else if (this.peekChar(0) === '/') {
                    return this.parseCloseTag(fullStartPos);
                } else return this.parseTag(fullStartPos);
            case '{':
                // Check for "{{"
                if (this.peekChar(0) === '{') {
                    return this.parseInterpolation(fullStartPos);
                } else {
                    return this.parseText(fullStartPos);
                }
            default:
                return this.parseText(fullStartPos);
        }
    }

    public parseComment(fullStartPos: number): NgNode {
        const result: NgNode = {
            kind: ngNodeKind.Comment,
            fullStartPos,
            startPos: this.currentPos - 1,
            endPos: 0,
            parent: undefined,
        };

        // Skip the '!--', then scan to closing '-->'
        this.currentPos += 3;

        let ch: string;
        // tslint:disable-next-line: no-conditional-assignment
        while ((ch = this.getChar()) !== '\x00') {
            if (ch === '-' && this.peekChar(0) === '-' && this.peekChar(1) === '>') {
                this.currentPos += 2;
                break;
            }
        }
        result.endPos = this.currentPos;
        this.stats.comments++;
        return result;
    }

    public parseTag(fullStartPos: number): NgTag {
        // Assuming it's an opening to tag to begin, and fix later if wrong.
        const result: NgTag = {
            kind: ngNodeKind.StartTag,
            fullStartPos,
            startPos: this.currentPos - 1,
            endPos: 0,
            parent: undefined,
            name: '',
            attributes: [],
            children: [],
        };

        if (!this.isTagStartChar(this.getChar())) {
            result.endPos = this.currentPos;
            this.result.errors.push({
                message: 'Invalid tag name',
                start: result.startPos,
                end: this.currentPos,
            } as ErrorInfo);
            this.stats.openTags++;
            return result;
        }

        while (this.isTagPartChar(this.peekChar())) this.getChar();
        result.name = this.text.substring(result.startPos + 1, this.currentPos);

        this.parseAttributes(result);
        this.skipWhitespace();

        if (this.peekChar() === '/' && this.peekChar(1) === '>') {
            this.currentPos += 2;
            result.kind = ngNodeKind.SelfClosingTag;

            if (result.name && selfClosingTags.indexOf(result.name) === -1) {
                this.result.errors.push({
                    message: `${result.name} cannot be used as self closing tag`,
                    start: result.startPos,
                    end: this.currentPos,
                } as ErrorInfo);
            }
        } else if (this.peekChar() === '>') {
            this.currentPos++;
        } else {
            this.result.errors.push({
                message: 'Invalid tag end',
                start: result.startPos,
                end: this.currentPos,
            } as ErrorInfo);
        }
        // TODO: Log error if not a well formed closing tag (i.e. doesn't close, whitespace, invalid chars...)

        if (selfClosingTags.find(x => x === result.name)) {
            result.kind = ngNodeKind.SelfClosingTag;
        }

        result.kind === ngNodeKind.SelfClosingTag ? this.stats.selfClosingTags++ : this.stats.openTags++;

        result.endPos = this.currentPos;
        return result;
    }

    public parseAttributes(parent: NgTag) {
        while (true) {
            const attrib = this.parseAttribute();
            if (attrib) {
                attrib.parent = parent;
                parent.attributes.push(attrib);
            } else {
                break;
            }
        }
    }

    public parseAttribute(): NgAttrib | undefined {
        // Note: May be spaces around the '=' sign. Require quoted values for now, and allow any non-quote chars inside.
        // TODO: Make more compliant with the spec: https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
        const result: NgAttrib = {
            kind: ngNodeKind.Attribute,
            fullStartPos: this.currentPos,
            startPos: 0,
            endPos: 0,
            parent: undefined,
            name: undefined,
            value: undefined,
        };

        this.skipWhitespace();
        if (!this.isAttribChar(this.peekChar())) {
            return undefined;
        }

        result.startPos = this.currentPos;

        // Consume the name
        while (this.isAttribChar(this.peekChar())) this.getChar();
        result.name = this.text.substring(result.startPos, this.currentPos);
        this.stats.attributes++;

        this.skipWhitespace();
        // No value given
        if (this.peekChar() !== '=') {
            result.endPos = this.currentPos;
            return result;
        } else {
            this.getChar();
        }

        this.skipWhitespace();

        const valuePos = this.currentPos;
        let valueChar = this.peekChar();
        if (valueChar === '\'' || valueChar === '"' || this.isAttribChar(valueChar)) {
            result.valuePos = this.currentPos;
            let endQuote: string | undefined;
            if (!this.isAttribChar(valueChar)) {
                // Is a quoted string. Store it and skip over it.
                endQuote = valueChar;
                result.valuePos++;
                this.getChar();
            }

            // tslint:disable-next-line: no-conditional-assignment
            while ((valueChar = this.getChar()) !== '\x00') {
                if (endQuote && valueChar === endQuote) {
                    // End of quoted string
                    result.endPos = this.currentPos;
                    result.value = this.text.substring(valuePos + 1, result.endPos - 1);
                    return result;
                } else if (!endQuote && !this.isAttribChar(valueChar)) {
                    // End of unquoted value. Put back whatever extra char was consumed
                    this.currentPos--;
                    result.endPos = this.currentPos;
                    result.value = this.text.substring(valuePos, result.endPos);
                    return result;
                }
            }
            // End of stream
            result.endPos = this.currentPos;
            this.result.errors.push({
                message: 'Incomplete attribute value',
                start: result.startPos,
                end: result.endPos,
            } as ErrorInfo);
        } else {
            // TODO: Allow other forms, such as double quotes or naked. But error for now.
            result.endPos = this.currentPos;
            this.result.errors.push({
                message: 'Unrecognized attribute value',
                start: this.currentPos,
                end: result.endPos,
            } as ErrorInfo);
        }

        return result;
    }

    public parseCloseTag(fullStartPos: number): NgNamedNode {
        const result: NgNamedNode = {
            kind: ngNodeKind.EndTag,
            fullStartPos,
            startPos: this.currentPos - 1,
            endPos: 0,
            parent: undefined,
            name: undefined,
        };
        this.stats.closeTags++;

        let ch = this.getChar(); // Consume the '/', then scan to closing '>'
        // tslint:disable-next-line: no-conditional-assignment
        while ((ch = this.getChar()) !== '\x00') {
            if (ch === '>') {
                // TODO: Log error if not a well formed closing tag (i.e. whitespace, invalid chars...)
                result.name = this.text.substring(result.startPos + 2, this.currentPos - 1);
                result.endPos = this.currentPos;
                return result;
            }
        }

        // Hit the end of the stream before the closing '>'
        result.endPos = this.currentPos;
        this.result.errors.push({
            message: 'Incomplete closing tag',
            start: result.startPos,
            end: result.endPos,
        } as ErrorInfo);

        return result;
    }

    public parseInterpolation(fullStartPos: number): NgNode {
        const result: NgNode = {
            kind: ngNodeKind.Interpolation,
            fullStartPos,
            startPos: this.currentPos - 1,
            endPos: 0,
            parent: undefined,
            getText: () => this.getNodeText(result),
        };
        this.stats.interpolations++;

        let ch = this.getChar(); // Consume the second '{', then scan to closing '}}'
        // tslint:disable-next-line: no-conditional-assignment
        while ((ch = this.getChar()) !== '\x00') {
            if (ch === '}' && this.peekChar() === '}') {
                this.currentPos += 1;
                result.endPos = this.currentPos;
                return result;
            }
        }

        // Hit the end of the stream before the closing '}}'
        result.endPos = this.currentPos;
        this.result.errors.push({
            message: 'Unclosed interpolation',
            start: result.startPos,
            end: result.endPos,
        } as ErrorInfo);
        return result;
    }

    public parseText(fullStartPos: number, stopOnGreaterThan: boolean = false): NgNode {
        const result: NgNode = {
            kind: ngNodeKind.Text,
            fullStartPos,
            startPos: this.currentPos - 1,
            endPos: 0,
            parent: undefined,
        };
        this.stats.textNodes++;

        let ch: string;
        while (true) {
            // Go up to the next char of interest, but don't consume it
            ch = this.peekChar();
            if (ch === '\x00' || ch === '<') break;
            if (ch === '{' && this.peekChar(1) === '{') break;
            if (stopOnGreaterThan && ch === '>') {
                // Consume this one, and finish
                this.getChar();
                break;
            }
            this.getChar();
        }

        result.endPos = this.currentPos;
        return result;
    }

    public skipWhitespace() {
        while (this.currentPos < this.text.length) {
            if (this.isWhiteSpace(this.text[this.currentPos])) {
                this.currentPos++;
            } else {
                return;
            }
        }
    }

    public isWhiteSpace(char: string) {
        return [' ', '\t', '\x0D', '\x0A', '\x0C'].some(ch => ch === char);
    }

    public isTagStartChar(char: string) {
        return (char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z');
    }

    public isTagPartChar(char: string) {
        // See if it's one of the disallowed chars. See https://html.spec.whatwg.org/multipage/syntax.html#tag-name-state
        // Note: Disallowing all control codes here. Some seem to be allowed for tag names, but that seems like a bad idea.
        if (char.charCodeAt(0) < 0x20 || [' ', '/', '>'].some(ch => ch === char)) {
            return false;
        }
        return true;
    }

    public isAttribChar(char: string) {
        // See if it's one of the disallowed chars. See https://html.spec.whatwg.org/multipage/syntax.html#tag-name-state
        if (char.charCodeAt(0) < 0x20 || [' ', '/', '>', '=', '"', '\''].some(ch => ch === char)) {
            return false;
        }
        return true;
    }

    private getChar(offset: number = 0) {
        if (this.currentPos + offset >= this.text.length) {
            return '\x00';
        } else {
            const result = this.text[this.currentPos + offset];
            this.currentPos += (offset + 1);
            return result;
        }
    }

    private peekChar(offset: number = 0) {
        if (this.currentPos + offset >= this.text.length) {
            return '\x00';
        } else {
            return this.text[this.currentPos + offset];
        }
    }
}