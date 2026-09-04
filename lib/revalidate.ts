import { revalidatePath } from "next/cache";

/**
 * Every route that renders workspace data.
 *
 * `/` is the desk, `/companies` is the company list, `/deals` is the deal
 * list, and all three read overlapping slices of the same tables: a deal
 * created on the desk changes a count on the company list, picking a
 * prospect on the company list changes the desk, deleting a company
 * changes all three.
 *
 * They are listed once and refreshed together on purpose. The alternative
 * is each action reasoning about which pages its change could possibly
 * reach, and getting it wrong the first time a page starts showing
 * something new. Marking three cache entries stale costs nothing; a stale
 * count that only goes away on a hard reload costs an afternoon of
 * wondering whether the write landed.
 */
const WORKSPACE_ROUTES = ["/", "/companies", "/deals"];

export function revalidateWorkspace(): void {
  for (const route of WORKSPACE_ROUTES) {
    revalidatePath(route);
  }
}
