import { Context } from "../types/context";

export function findRenameLocations(
    context: Context,
    fileName: string,
    position: number,
    findInStrings: boolean,
    findInComments: boolean,
    providePrefixAndSuffixTextForRename?: boolean
): ReadonlyArray<ts.RenameLocation> | undefined {

    return undefined;
}