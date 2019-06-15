export function kebabToCamel(input: string) {
    return input.replace(/(-\w)/g, m => m[1].toUpperCase());
}

export function camelToKebab(str: string) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}