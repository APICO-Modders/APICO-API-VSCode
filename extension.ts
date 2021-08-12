"use strict";

import * as vscode from 'vscode';

const LUA_MODE: vscode.DocumentFilter = { language: 'lua', scheme: 'file' };
const EXT_TAG = "APICO-API-VSCode";

// api method list
const api = {
  "functions": [
    {
      "description": "Toggle devmode.",
      "name": "api_set_devmode",
      "variants": [{
        "arguments": [{
          "description": "Whether to set devmode to true or false.",
          "name": "bool",
          "type": "boolean"
        }]
      }]
    }
  ]
}

// handle suggestions
function getSuggestions(line: string, currentWord: string) {
  var results: vscode.CompletionItem[] = [];

  // check as long as not blank
  if (currentWord == "") {

    // find all functions
    let funcs = api.functions;
    for (let i = 0; i < funcs.length; i++) {
      let newItem = new vscode.CompletionItem(funcs[i].name, vscode.CompletionItemKind.Function);
      newItem.detail = EXT_TAG;
      newItem.documentation = funcs[i].description;
      results.push(newItem);
    }
    return results;

  } else {
    results = [];
    return results;
  }
}

// handle signatures
class APISignatureHelpProvider implements vscode.SignatureHelpProvider {

  public provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.SignatureHelp | null> {
      let theCall = this.walkBackwardsToBeginningOfCall(document, position);
      if (theCall == null) {
          return Promise.resolve(null);
      }

      // Find the name of the function that's being called
      let functionNameRange = this.previousTokenPosition(document, theCall.openParen);
      let functionName = document.getText(functionNameRange!);

      // Find the full method call
      let currentLine = document.lineAt(position.line).text.substring(0, position.character);
      let fullMethodCall = currentLine.trim().split('(')[0];

      let result = new vscode.SignatureHelp();
      let si: vscode.SignatureInformation;

      result.activeParameter = theCall.commas.length;
      
      let functionData = this.getFunctionData(functionName, api.functions);
      si = new vscode.SignatureInformation(functionName);
      si.documentation = functionData.description;

      let params: vscode.ParameterInformation[] = [];
      si.parameters = params;

      console.log("Result:", result);
      result.signatures.push(si);
      result.activeSignature = 0;
      result.activeParameter = Math.min(theCall.commas.length, si.parameters.length - 1);
      result.activeSignature = 0;
      return Promise.resolve(result);
  }

  // return the matching function from the api
  private getFunctionData(targetFunction: string, functions: any) {
    for (let i = 0; i < functions.length; i++) {
      if (targetFunction == functions[i].name) {
        return functions[i];
      }
    }
  }

  // helper to get token position
  private previousTokenPosition(document: vscode.TextDocument, position: vscode.Position): Range|null {
    while (position.character > 0) {
      let word = document.getWordRangeAtPosition(position);
      if (word) {
        return word;
      }
      position = position.translate(0, -1);
    }
    return null; 
  }

  // helper to get start of suggestion
  private walkBackwardsToBeginningOfCall(document: vscode.TextDocument, position: vscode.Position): { openParen: vscode.Position, commas: vscode.Position[] }|null {
    let currentLine = document.lineAt(position.line).text.substring(0, position.character);
    let parenBalance = 0;
    let commas = [];
    for (let char = position.character; char >= 0; char--) {
      switch (currentLine[char]) {
        case '(':
          parenBalance--;
          if (parenBalance < 0) {
            return {
              openParen: new vscode.Position(position.line, char),
              commas: commas
            };
          }
          break;
        case ')':
          parenBalance++;
          break;
        case ',':
          if (parenBalance === 0) {
            commas.push(new vscode.Position(position.line, char));
          }
      }
    }
    return null;
  }

}

// handle completion suggestions
const completionProvider = vscode.languages.registerCompletionItemProvider(LUA_MODE, {
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
      // let filename = document.fileName;
      let lineText = document.lineAt(position.line).text;
      // let lineTillCurrentPosition = lineText.substr(0, position.character);
      let wordAtPosition = document.getWordRangeAtPosition(position);
      let currentWord = '';
      if (wordAtPosition && wordAtPosition.start.character < position.character) {
          let word = document.getText(wordAtPosition);
          currentWord = word.substr(0, position.character - wordAtPosition.start.character);
      }
      // Check through the list of functions that are included in this file and see if any match
      // the starting letter of the word we have so far
      let suggestions: vscode.CompletionItem[] = getSuggestions(lineText, currentWord);
      return suggestions;
  }
}, '.')

// handle function suggestions
const signatureProvider = vscode.languages.registerSignatureHelpProvider(LUA_MODE,
	new APISignatureHelpProvider(vscode.workspace.getConfiguration('lua')['docsTool']),
'(', ',');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // register stuff
  context.subscriptions.push(signatureProvider, completionProvider)
}

// this method is called when your extension is deactivated
export function deactivate() {}
