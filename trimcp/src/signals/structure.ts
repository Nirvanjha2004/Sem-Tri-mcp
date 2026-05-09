import { Project, SyntaxKind } from "ts-morph";

export function getStructuralMatches(projectPath: string, keywords: string[]) {
  const project = new Project();
  project.addSourceFilesAtPaths(`${projectPath}/src/**/*.ts`);
  
  const matches: any[] = [];
  
  project.getSourceFiles().forEach(file => {
    // Find classes or functions matching keywords
    file.getDescendantsOfKind(SyntaxKind.Identifier).forEach(node => {
      if (keywords.some(k => node.getText().toLowerCase().includes(k.toLowerCase()))) {
        const parent = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) || 
                       node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
        if (parent) {
          matches.push({
            file: file.getFilePath(),
            line: parent.getStartLineNumber(),
            name: node.getText()
          });
        }
      }
    });
  });
  
  return matches;
}