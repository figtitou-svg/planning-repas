// Reconstruit le payload `databases.create` d'une base à partir des propriétés renvoyées par `databases.retrieve`.
export function copyDatabaseSchema(properties: Record<string, any>): Record<string, any> {
  const copy: Record<string, any> = {};
  // Ordre sûr pour un seul appel de création : un rollup référence une relation par son nom,
  // et une formule peut référencer un rollup. Tri stable : simples/relations, puis rollup, puis formula.
  const rank = (type: string) => (type === "formula" ? 2 : type === "rollup" ? 1 : 0);
  const entries = Object.entries<any>(properties).sort(([, a], [, b]) => rank(a.type) - rank(b.type));
  for (const [name, prop] of entries) {
    switch (prop.type) {
      case "title":
        copy[name] = { title: {} };
        break;
      case "number":
        copy[name] = { number: { format: prop.number.format } };
        break;
      case "date":
        copy[name] = { date: {} };
        break;
      case "checkbox":
        copy[name] = { checkbox: {} };
        break;
      case "formula":
        copy[name] = { formula: { expression: prop.formula.expression } };
        break;
      case "rollup":
        copy[name] = {
          rollup: {
            relation_property_name: prop.rollup.relation_property_name,
            rollup_property_name: prop.rollup.rollup_property_name,
            function: prop.rollup.function,
          },
        };
        break;
      case "relation":
        // Relation à sens unique : pas de propriété miroir créée dans les bases communes.
        copy[name] = { relation: { database_id: prop.relation.database_id, single_property: {} } };
        break;
      default:
        throw new Error(`Type de propriété non géré pour « ${name} » : ${prop.type}`);
    }
  }
  return copy;
}

// Sépare le schéma en deux : ce qui se crée avec la base (`create`) et les formules (`formulas`),
// à ajouter ensuite par `databases.update` : Notion valide une formule dès la création, avant que
// les rollups/relations qu'elle référence n'existent dans la nouvelle base.
export function splitDatabaseSchema(properties: Record<string, any>): {
  create: Record<string, any>;
  formulas: Record<string, any>;
} {
  const isFormula = ([, prop]: [string, any]) => prop.type === "formula";
  const entries = Object.entries<any>(properties);
  return {
    create: copyDatabaseSchema(Object.fromEntries(entries.filter((e) => !isFormula(e)))),
    formulas: copyDatabaseSchema(Object.fromEntries(entries.filter(isFormula))),
  };
}
