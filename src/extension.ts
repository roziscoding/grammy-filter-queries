import * as vscode from "vscode";
import { Disposable } from "vscode";
import { generate } from "./doc";
import groupBy = require("lodash.groupby");

const queryDocs = generate();
const l1Groups = groupBy(queryDocs, (qd) => qd.query.split(":")[0]);
const l2Groups = Object.entries(l1Groups).reduce(
  (groups, [l1, qds]) => {
    groups[l1] = groupBy(qds, (qd) => {
      const [l1, l2, l3] = qd.query.split(":");
      if (l3) return `${l1}:${l2}`;
      return `${l1}:${l2}`;
    });
    return groups;
  },
  Object.fromEntries(
    Object.keys(l1Groups).map((group) => [group, {}]),
  ) as Record<string, Record<string, typeof queryDocs>>,
);

class FilterQuery extends vscode.TreeItem {
  public readonly children: FilterQuery[] = [];

  constructor(
    public readonly label: string,
    public readonly tooltip: string,
  ) {
    const [l1, l2, l3] = label.split(":");

    const hasChildren = l3 ? false : l2 ? l2Groups[l1][label].length > 1 : true;

    super(
      label,
      hasChildren
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
  }
}

const root = Object.keys(l1Groups)
  .filter(Boolean)
  .map((l1Query) =>
    new FilterQuery(
      l1Query,
      l2Groups[l1Query][`${l1Query}:undefined`][0].description,
    )
  );

class FilterQueriesProvider implements vscode.TreeDataProvider<FilterQuery> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    FilterQuery | undefined | void
  > = new vscode.EventEmitter<FilterQuery | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<FilterQuery | undefined | void> =
    this._onDidChangeTreeData.event;

  getTreeItem(
    element: FilterQuery,
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(
    element?: FilterQuery | undefined,
  ): vscode.ProviderResult<FilterQuery[]> {
    if (!element) {
      return root;
    }

    const [l1, l2, l3] = element.label.split(":");

    if (l3) return null;

    const filterKey = l2 ? `${l1}:${l2}:` : `${l1}:`;

    return queryDocs.filter(({ query }) => query.startsWith(filterKey)).map(
      (queryDoc) => new FilterQuery(queryDoc.query, queryDoc.description),
    );
  }
}

const disposables: Disposable[] = [];

export async function activate(context: vscode.ExtensionContext) {
  const treeView = vscode.window.createTreeView("filterQueries", {
    canSelectMany: false,
    showCollapseAll: true,
    treeDataProvider: new FilterQueriesProvider(),
  });
  disposables.push(treeView);

  disposables.push(
    vscode.commands.registerTextEditorCommand(
      "grammyFilterQueries.insert",
      (editor, edit, ...[query]) => {
        if (!query) throw new Error("trying to insert empty query");
        const snippet = new vscode.SnippetString([
          `\${1:bot}.on("${query}", (\${2:ctx, next}) => {`,
          "$0",
          "}",
        ].join("\n"));

        editor.selections.forEach((selection) => {
          editor.insertSnippet(snippet, selection.active);
        });
      },
    ),
  );
}

export function deactivate() {
  disposables.forEach((d) => d.dispose());
}
