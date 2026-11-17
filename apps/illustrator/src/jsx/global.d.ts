// JSON arriva da json2.js (ExtendScript non ha JSON nativo)
declare var JSON: {
  stringify(object: object): string;
  parse(string: string): object;
};

// Presente in Illustrator, assente nei tipi di types-for-adobe usati qui.
declare var ElementPlacement: {
  PLACEATBEGINNING: unknown;
  PLACEATEND: unknown;
  PLACEBEFORE: unknown;
  PLACEAFTER: unknown;
  INSIDE: unknown;
};
