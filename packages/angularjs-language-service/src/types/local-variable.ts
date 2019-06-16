import { Location } from './location';

export interface LocalVariable {
    name: string;
    type?: string;
    location?: Location;
    imports: Array<{
        name: string;
        location: string;
    }>;
}