export function extractParamNames(params: string[]) {
  // Regex explained:
  // :             -> matches the literal colon
  // ([a-zA-Z0-9]+) -> captures one or more alphanumeric characters (this is the name we want)
  // /g            -> g flag ensures we find ALL matches in the string
  const paramRegex = /:([a-zA-Z0-9]+)/g;
  const uniqueNames = [];

  for (const param of params) {
    let match;
    // matchAll/exec is used to iterate over all matches in the string
    while ((match = paramRegex.exec(param)) !== null) {
      // match[1] contains the captured group (the parameter name)
      const paramName = match[1];
      uniqueNames.push(paramName);
    }
  }
  return uniqueNames;
}
