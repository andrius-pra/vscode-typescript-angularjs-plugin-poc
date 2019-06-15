import { ComponentMetata } from "../types/component-metadata";

export class MetadataResolver {
    private _components: ComponentMetata[] = [];

    constructor() { }

    loadMetadata() {
        this._components = []
    }

    public getAnalyzedModules(): ComponentMetata[] {
        return this._components;
    }
}