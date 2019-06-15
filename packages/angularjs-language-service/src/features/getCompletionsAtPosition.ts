import { Context } from "../types/context";

export function getCompletionsAtPosition(
    context: Context,
    fileName: string,
    position: number,
    options: ts.GetCompletionsAtPositionOptions | undefined
): ts.CompletionInfo | undefined {

    let result: ts.CompletionInfo | undefined;

    return result;
}