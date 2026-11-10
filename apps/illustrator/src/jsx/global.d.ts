// JSON arriva da json2.js (ExtendScript non ha JSON nativo)
declare var JSON: {
  stringify(object: object): string;
  parse(string: string): object;
};
