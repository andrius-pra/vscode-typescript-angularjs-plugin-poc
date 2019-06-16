import { ComponentMetata } from './component-metadata';

export interface ComponentMetataVersion {
    version: number | string;
    component?: ComponentMetata;
}