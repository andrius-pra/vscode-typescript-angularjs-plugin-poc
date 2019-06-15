import { Context } from "../types/context";

export function getCompletionEntryDetails(
    context: Context,
    fileName: string,
    position: number,
    name: string,
    formatOptions: ts.FormatCodeOptions | ts.FormatCodeSettings | undefined,
    source: string | undefined, preferences: ts.UserPreferences | undefined
): ts.CompletionEntryDetails | undefined {

    return undefined;
}