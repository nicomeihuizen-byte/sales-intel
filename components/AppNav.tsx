import Link from "next/link";
import { signOut } from "@/app/login/actions";

/**
 * The three workspace routes and the way out, in one place.
 *
 * Three pages each writing their own header is three chances for them to
 * disagree about what the other two are called, which is how "all deals"
 * ended up meaning the same page as "deals" on one screen and something
 * else on another.
 *
 * The current page is shown but not linked. A link to where you already
 * are is a small lie, and it costs a click to find that out.
 */
export default function AppNav({
  current,
}: {
  current: "desk" | "companies" | "deals";
}) {
  const items = [
    { key: "desk", href: "/", label: "desk" },
    { key: "companies", href: "/companies", label: "companies" },
    { key: "deals", href: "/deals", label: "deals" },
  ] as const;

  return (
    <nav className="flex items-center gap-4">
      {items.map((item) =>
        item.key === current ? (
          <span key={item.key} className="font-mono text-sm text-accent">
            {item.label}
          </span>
        ) : (
          <Link
            key={item.key}
            href={item.href}
            className="font-mono text-sm text-muted transition-colors hover:text-accent"
          >
            {item.label}
          </Link>
        ),
      )}

      <form action={signOut}>
        <button
          type="submit"
          className="font-mono text-sm text-muted transition-colors hover:text-accent"
        >
          log out
        </button>
      </form>
    </nav>
  );
}
