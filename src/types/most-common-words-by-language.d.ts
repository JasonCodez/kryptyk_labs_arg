declare module "most-common-words-by-language" {
  export function getWordsList(language: string, count?: number): string[];
  export function findWord(word: string): Record<string, number>;
}
