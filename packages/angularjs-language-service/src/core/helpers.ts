import { NgTag } from '../utils/template-parser';

export function kebabToCamel(input: string) {
    return input.replace(/(-\w)/g, m => m[1].toUpperCase());
}

export function camelToKebab(str: string) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function getShortName(selectorValue: string | undefined) {
    if (selectorValue === undefined) {
        return undefined;
    }
    let shortName = selectorValue;
    if (shortName.startsWith('data-')) {
        shortName = shortName.substr(5);
    } else if ((shortName.length < 5 && 'data-'.indexOf(shortName) === 0)) {
        shortName = '';
    }
    return shortName;
}

export function getAttributeNames(tag: NgTag): string[] {
    const result = [];
    for (const attr of tag.attributes) {
        if (attr.name) {
            result.push(getShortName(attr.name)!);
        }
    }
    return result;
}