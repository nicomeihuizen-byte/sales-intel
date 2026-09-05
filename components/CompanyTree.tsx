"use client";

import type { CompanyIndexEntry } from "@/lib/companies";

/**
 * The whole corporate group one company sits in, drawn as a tree.
 *
 * Not "this company's subsidiaries". The question a rep actually has is
 * "what is this thing part of", and the answer is only useful with the
 * siblings and the top of the chain in view. Ober-Haus on its own tells
 * you nothing; Ober-Haus under a twelve-person Finnish franchisor, beside
 * two other companies you are also working, tells you who signs and
 * whether you are about to spend three slots on one group.
 *
 * So this climbs to the root first and renders down from there, with the
 * company you opened marked.
 */

/** Walks up to the top of the group. Returns the id of the root. */
function rootOf(
  startId: string,
  byId: Map<string, CompanyIndexEntry>,
): string {
  let current = startId;
  const seen = new Set<string>([current]);

  for (;;) {
    const parentId = byId.get(current)?.parent_id;

    // Stops on: no parent, a parent that is not in the index (another
    // tenant's row reached through a stale id), or a cycle. The cycle guard
    // is in lib/companies.ts and this is the second one, because a tree
    // renderer that can be made to recurse forever by a bad row is a
    // renderer that takes the tab with it.
    if (!parentId || !byId.has(parentId) || seen.has(parentId)) {
      return current;
    }

    seen.add(parentId);
    current = parentId;
  }
}

function Branch({
  entry,
  childrenOf,
  currentId,
  depth,
  seen,
}: {
  entry: CompanyIndexEntry;
  childrenOf: Map<string | null, CompanyIndexEntry[]>;
  currentId: string;
  depth: number;
  /** Ids already drawn on this path, so a cycle cannot recurse forever. */
  seen: Set<string>;
}) {
  const isCurrent = entry.id === currentId;
  const isProspect = Boolean(entry.prospect_since);
  const children = (childrenOf.get(entry.id) ?? []).filter(
    (child) => !seen.has(child.id),
  );

  return (
    <li>
      <div
        className={`flex items-baseline gap-2 py-0.5 ${
          isCurrent ? "text-foreground" : "text-muted"
        }`}
        style={{ paddingLeft: `${depth * 1.1}rem` }}
      >
        {/* A monospace elbow rather than a border trick: it lines up with
            everything else on this screen and it survives a name wrapping
            onto a second line. */}
        {depth > 0 && (
          <span aria-hidden className="font-mono text-xs text-dim">
            └
          </span>
        )}
        <span
          className={`text-sm ${isCurrent ? "font-medium" : ""}`}
          aria-current={isCurrent ? "true" : undefined}
        >
          {entry.name}
        </span>
        {isProspect && (
          // The reason the tree is worth drawing at all. Three of your five
          // in one group is the thing the cap exists to prevent, and
          // nothing else on the screen would say a word about it.
          <span
            title="One of your five"
            className="shrink-0 rounded border border-accent-dim px-1 font-mono text-[10px] uppercase text-accent"
          >
            in your five
          </span>
        )}
      </div>

      {children.length > 0 && (
        <ul>
          {children.map((child) => (
            <Branch
              key={child.id}
              entry={child}
              childrenOf={childrenOf}
              currentId={currentId}
              depth={depth + 1}
              seen={new Set([...seen, child.id])}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function CompanyTree({
  companyId,
  index,
}: {
  companyId: string;
  index: CompanyIndexEntry[];
}) {
  const byId = new Map(index.map((entry) => [entry.id, entry]));
  const self = byId.get(companyId);

  if (!self) {
    return null;
  }

  const childrenOf = new Map<string | null, CompanyIndexEntry[]>();

  for (const entry of index) {
    const key = entry.parent_id;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), entry]);
  }

  const rootId = rootOf(companyId, byId);
  const root = byId.get(rootId);

  if (!root) {
    return null;
  }

  // A company on its own is not a group, and one line saying so under a
  // heading called "group" is worse than no heading at all.
  const alone =
    rootId === companyId && (childrenOf.get(companyId) ?? []).length === 0;

  if (alone) {
    return null;
  }

  // Counted over the whole group rather than the visible branch, so the
  // warning is about the group and not about where you happened to open it.
  const inFive = index.filter(
    (entry) => entry.prospect_since && rootOf(entry.id, byId) === rootId,
  ).length;

  return (
    <div>
      <h4 className="font-mono text-xs text-accent2">{"// group"}</h4>

      <ul className="mt-2">
        <Branch
          entry={root}
          childrenOf={childrenOf}
          currentId={companyId}
          depth={0}
          seen={new Set([root.id])}
        />
      </ul>

      {inFive > 1 && (
        <p className="mt-2 font-mono text-[11px] text-warn">
          {inFive} of your five are in this group.
        </p>
      )}
    </div>
  );
}
